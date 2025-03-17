const Tesseract = require('tesseract.js');
const { createClient } = require('@supabase/supabase-js');
const { sendMessage } = require('../utils/messageUtils');
const { exec } = require('child_process');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

let autoCheckResult = false;

async function extractTextFromImage(imagePath) {
    const { data: { text } } = await Tesseract.recognize(imagePath, 'eng');
    return text;
}

function extractWithPaddleOCR(imagePath) {
    return new Promise((resolve, reject) => {
        exec(`python ocr.py "${imagePath}"`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error: ${error.message}`);
                reject("OCR failed.");
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

async function updateGoals(playerName, goals) {
    const { data, error } = await supabase
        .from('players')
        .update({ goals: goals })
        .match({ player_name: playerName });

    if (error) console.error('Error updating goals:', error);
}

async function handleNewImage(sock, message) {
    if (message.message.imageMessage) {
        const imagePath = await downloadImage(message);
        const text = await extractTextFromImage(imagePath); // Changed from extractWithPaddleOCR to extractTextFromImage

        await sendMessage(sock, message.key.remoteJid, `Extracted Results:\n${text}`);

        if (autoCheckResult) {
            await uploadResult(sock, message.key.remoteJid, imagePath);
        }
    }
}

async function startTournament(sock, chatId, communityName, messageText) {
    await sendMessage(sock, chatId, `Started tracking tournament for community: ${communityName}`);

    const teamsAndUsers = parseTeamsAndUsers(messageText);
    for (const { team, user } of teamsAndUsers) {
        await addPlayer(sock, chatId, user, team, communityName);
    }

    await sendMessage(sock, chatId, '✅ Teams and players registered successfully! 📌 All goals will now be tracked automatically.');
}

function parseTeamsAndUsers(messageText) {
    const lines = messageText.split('\n');
    const teamsAndUsers = [];

    for (const line of lines) {
        const match = line.match(/🇦🇷|🇦🇺|🇧🇪|🇧🇷|🇨🇲|🇨🇦|🇨🇷|🇭🇷|🇩🇰|🇪🇨|🇬🇧|🇫🇷|🇩🇪|🇮🇷|🇯🇵|🇲🇽|🇲🇦|🇳🇱|🇳🇬|🇵🇱|🇵🇹|🇶🇦|🇸🇦|🇸🇳|🇷🇸|🇰🇷|🇪🇸|🇨🇭|🇹🇳|🇺🇸|🇺🇾|🏴\s+(\w+)\s+@(.+)/);
        if (match) {
            const [, team, user] = match;
            teamsAndUsers.push({ team, user });
        }
    }

    return teamsAndUsers;
}

async function showTopScorers(sock, chatId, communityName) {
    const { data, error } = await supabase
        .from('players')
        .select('player_name, team, goals')
        .eq('community', communityName)
        .order('goals', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error fetching top scorers:', error);
        await sendMessage(sock, chatId, 'Error fetching top scorers.');
        return;
    }

    if (!data.length) {
        await sendMessage(sock, chatId, `📌 No goal records found for *${communityName}* yet.`);
        return;
    }

    let message = `🏆 *EFOOTBALL DYNASTY - BEST ATTACKERS* 🏆\n━━━━━━━━━━━━━━━━━━━━━\n`;
    data.forEach((player, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '⭐';
        message += `${medal} *${player.player_name} (${player.team})* → **${player.goals} Goals**\n`;
    });
    message += `━━━━━━━━━━━━━━━━━━━━━\n🔥 *Keep scoring and make history!* 🔥\n🔹 *POWERED BY TECHITOON BOT*`;

    await sendMessage(sock, chatId, message);
}

async function showLeaderboard(sock, chatId) {
    const { data, error } = await supabase
        .from('players')
        .select('player_name, team, goals')
        .order('goals', { ascending: false });

    if (error) {
        console.error('Error fetching leaderboard:', error);
        await sendMessage(sock, chatId, 'Error fetching leaderboard.');
        return;
    }

    let message = `Leaderboard Ranking:\n`;
    data.forEach((player, index) => {
        message += `${index + 1}. ${player.player_name} - ${player.goals} goals\n`;
    });

    await sendMessage(sock, chatId, message);
}

async function addGoal(sock, chatId, playerName, goals) {
    const { data, error } = await supabase
        .from('players')
        .select('goals')
        .eq('player_name', playerName)
        .single();

    if (error) {
        console.error('Error fetching player:', error);
        await sendMessage(sock, chatId, 'Error fetching player.');
        return;
    }

    const newGoals = data.goals + goals;

    const { updateError } = await supabase
        .from('players')
        .update({ goals: newGoals })
        .eq('player_name', playerName);

    if (updateError) {
        console.error('Error updating goals:', updateError);
        await sendMessage(sock, chatId, 'Error updating goals.');
        return;
    }

    await sendMessage(sock, chatId, `${playerName} now has ${newGoals} goals.`);
}

async function setGoal(sock, chatId, playerName, goals) {
    const { error } = await supabase
        .from('players')
        .update({ goals: goals })
        .eq('player_name', playerName);

    if (error) {
        console.error('Error setting goals:', error);
        await sendMessage(sock, chatId, 'Error setting goals.');
        return;
    }

    await sendMessage(sock, chatId, `${playerName}'s goal count is now set to ${goals}.`);
}

async function endTournament(sock, chatId) {
    await sendMessage(sock, chatId, `Tournament ended. Final results stored.`);
}

async function addPlayer(sock, chatId, playerName, team, community) {
    const { data, error } = await supabase
        .from('players')
        .insert([{ player_name: playerName, team: team, community: community, goals: 0 }]);

    if (error) {
        console.error('Error adding player:', error);
        await sendMessage(sock, chatId, 'Error adding player.');
        return;
    }

    await sendMessage(sock, chatId, `Player ${playerName} added to team ${team} in community ${community}.`);
}

async function removePlayer(sock, chatId, playerName, community) {
    const { error } = await supabase
        .from('players')
        .delete()
        .eq('player_name', playerName)
        .eq('community', community);

    if (error) {
        console.error('Error removing player:', error);
        await sendMessage(sock, chatId, 'Error removing player.');
        return;
    }

    await sendMessage(sock, chatId, `Player ${playerName} removed from community ${community}.`);
}

async function listPlayers(sock, chatId, community) {
    const { data, error } = await supabase
        .from('players')
        .select('player_name, team')
        .eq('community', community);

    if (error) {
        console.error('Error listing players:', error);
        await sendMessage(sock, chatId, 'Error listing players.');
        return;
    }

    if (!data.length) {
        await sendMessage(sock, chatId, `📌 No players found for community *${community}*.`);
        return;
    }

    let message = `Players in community ${community}:\n`;
    data.forEach((player) => {
        message += `- ${player.player_name} (${player.team})\n`;
    });

    await sendMessage(sock, chatId, message);
}

async function uploadResult(sock, chatId, imagePath) {
    const text = await extractWithPaddleOCR(imagePath);
    const results = parseMatchResults(text);

    for (const result of results) {
        const { team, goals } = result;
        const { data, error } = await supabase
            .from('players')
            .select('player_name')
            .eq('team', team);

        if (error) {
            console.error('Error fetching players:', error);
            await sendMessage(sock, chatId, 'Error fetching players.');
            return;
        }

        for (const player of data) {
            await updateGoals(player.player_name, goals);
        }
    }

    await sendMessage(sock, chatId, '🏆 **GOALS UPDATED!** 🏆\n━━━━━━━━━━━━━━━━━━━━━\n🔹 Leaderboard has been updated!');
}

function parseMatchResults(text) {
    const lines = text.split('\n');
    const results = [];

    for (const line of lines) {
        const match = line.match(/(\w+)\s+(\d+)-(\d+)\s+(\w+)/);
        if (match) {
            const [, team1, goals1, goals2, team2] = match;
            results.push({ team: team1, goals: parseInt(goals1) });
            results.push({ team: team2, goals: parseInt(goals2) });
        }
    }

    return results;
}

async function enableAutoCheckResult(sock, chatId) {
    autoCheckResult = true;
    await sendMessage(sock, chatId, '✅ Auto result checking is now *ACTIVE*! 📌 All uploaded match result images will be scanned automatically. 📊 Leaderboard updates will happen in real-time!');
}

async function disableAutoCheckResult(sock, chatId) {
    autoCheckResult = false;
    await sendMessage(sock, chatId, '🚫 Auto result checking is now *DISABLED*! 📌 Match results must be entered manually.');
}

module.exports = {
    handleNewImage,
    startTournament,
    showTopScorers,
    showLeaderboard,
    addGoal,
    setGoal,
    endTournament,
    addPlayer,
    removePlayer,
    listPlayers,
    uploadResult,
    enableAutoCheckResult,
    disableAutoCheckResult
};