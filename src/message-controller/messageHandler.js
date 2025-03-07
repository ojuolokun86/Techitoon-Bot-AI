const { sendMessage, sendReaction } = require('../utils/messageUtils');
const supabase = require('../supabaseClient');
const { issueWarning, resetWarnings, listWarnings } = require('../message-controller/warning');
const config = require('../config/config');
const { updateUserStats } = require('../utils/utils');
const commonCommands = require('../message-controller/commonCommands');
const adminCommands = require('../message-controller/adminActions');
const botCommands = require('../message-controller/botCommands');
const scheduleCommands = require('../message-controller/scheduleMessage');
const pollCommands = require('../message-controller/polls');
const tournamentCommands = require('../message-controller/tournament');
const { handleProtectionMessages, handleAntiDelete, enableAntiDelete, disableAntiDelete } = require('../message-controller/protection');
const { exec } = require("child_process");
const { removedMessages, leftMessages } = require('../utils/goodbyeMessages');
const { formatResponseWithHeaderFooter, welcomeMessage } = require('../utils/utils');
const { startBot } = require('../bot/bot');

const showAllGroupStats = async (sock, chatId) => {
    try {
        // Fetch group stats from Supabase
        const { data: stats, error } = await supabase
            .from('group_stats')
            .select('*')
            .eq('group_id', chatId);

        if (error) {
            console.error('Error fetching group stats:', error);
            await sendMessage(sock, chatId, '❌ Error fetching group stats.');
            return;
        }

        if (!stats || stats.length === 0) {
            await sendMessage(sock, chatId, '📊 No stats available for this group.');
            return;
        }

        // Format the stats into a readable message
        let message = '📊 *Group Stats* 📊\n\n';
        stats.forEach(stat => {
            message += `👤 *User*: @${stat.user_id.split('@')[0]}\n`;
            message += `📈 *Messages*: ${stat.message_count}\n\n`;
        });

        await sendMessage(sock, chatId, message);
    } catch (error) {
        console.error('Error fetching group stats:', error);
        await sendMessage(sock, chatId, '❌ Error fetching group stats.');
    }
};

const handleCommand = async (sock, msg) => {
    const chatId = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

    if (messageText.startsWith('.antidelete on')) {
        await enableAntiDelete(chatId);
        await sendMessage(sock, chatId, '✅ Anti-delete has been enabled for this group.');
    } else if (messageText.startsWith('.antidelete off')) {
        await disableAntiDelete(chatId);
        await sendMessage(sock, chatId, '❌ Anti-delete has been disabled for this group.');
    } else if (messageText.startsWith('.tagall')) {
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants.map(p => p.id);
        const mentions = participants.map(id => ({ id }));

        let text = `📌 *Group:* 『 ${groupMetadata.subject} 』\n`;
        text += `👤 *User:* 『 @${sender.split('@')[0]} 』\n`;
        text += `📝 *Message:* 『 ${messageText.replace('.tagall', '').trim()} 』\n\n`;

        // Add mentions to the message text with usernames in a single line
        text += participants.map(id => `@${id.split('@')[0]}`).join(' ');

        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(text), mentions });
    }
    // ...other command handling...
};

const handleIncomingMessages = async (sock, m) => {
    try {
        const message = m.messages[0];
        if (!message.message) return;

        const msgText = message.message.conversation || message.message.extendedTextMessage?.text || message.message.imageMessage?.caption || message.message.videoMessage?.caption || '';
        const chatId = message.key.remoteJid;
        const sender = message.key.participant || message.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        const isChannel = chatId.endsWith('@broadcast');
        const isPrivateChat = !isGroup && !isChannel;
        const isBackupNumber = sender === config.backupNumber;

        console.log(`Received message: ${msgText} from ${sender} in ${chatId}`);

        // Fetch group/channel settings from Supabase
        let groupSettings = null;
        if (isGroup || isChannel) {
            const { data, error } = await supabase
                .from('group_settings')
                .select('bot_enabled')
                .eq('group_id', chatId)
                .single();
            groupSettings = data;
            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching group settings:', error);
            }
        }

        // Check if the bot is enabled in the group/channel
        if ((isGroup || isChannel) && (!groupSettings || !groupSettings.bot_enabled)) {
            if (msgText.trim().startsWith(config.botSettings.commandPrefix)) {
                const args = msgText.trim().split(/ +/);
                const command = args.shift().slice(config.botSettings.commandPrefix.length).toLowerCase();
                if (command === 'enable' && sender === config.botOwnerId) {
                    await adminCommands.enableBot(sock, chatId, sender);
                } else if (command === 'disable' && sender === config.botOwnerId) {
                    await adminCommands.disableBot(sock, chatId, sender);
                } else {
                    console.log('Bot is disabled, cannot send message.');
                    await sendMessage(sock, chatId, 'Oops! 🤖 The bot is currently disabled in this group/channel. Don\'t worry, the bot owner can enable it soon! 😊 Please try again later! 🙏');
                }
            }
            console.log('🛑 Bot is disabled in this group/channel.');
            return;
        }

        if (isPrivateChat) {
            console.log('📩 Processing private chat message');
        } else if (isGroup || isChannel) {
            console.log('📩 Processing group/channel message');
        }

        if (!msgText.trim().startsWith(config.botSettings.commandPrefix)) {
            console.log('🛑 Ignoring non-command message');
            await handleProtectionMessages(sock, message);
            return;
        }

        const args = msgText.trim().split(/ +/);
        const command = args.shift().slice(config.botSettings.commandPrefix.length).toLowerCase();
        console.log(`🛠 Extracted Command: ${command}`);

        // React to the command
        await sendReaction(sock, chatId, message.key.id, command);

        // Handle the command
        await handleCommand(sock, message);

        // Update user statistics for commands
        updateUserStats(sender, command);
    } catch (error) {
        console.error("❌ Error in command processing:", error);

        // Handle session errors
        if (error.message.includes('Bad MAC') || error.message.includes('No matching sessions found for message')) {
            console.error('Session error:', error);
            await sendMessage(sock, chatId, '⚠️ *Session error occurred. Please try again later.*');
        } else if (error.message.includes('Timed Out')) {
            console.error('Error fetching group metadata:', error);
            await sendMessage(sock, chatId, '⚠️ *Request timed out. Please try again later.*');
        } else {
            await sendMessage(sock, chatId, '⚠️ *An unexpected error occurred. Please try again later.*');
        }
    }
};

const callCommand = async (sock, chatId, command) => {
    try {
        const { data, error } = await supabase
            .from('commands')
            .select('response')
            .eq('command_name', command)
            .single();

        if (error || !data) {
            await sendMessage(sock, chatId, '❌ Command not found.');
            return;
        }

        await sendMessage(sock, chatId, data.response);
    } catch (error) {
        console.error('Error executing custom command:', error);
        await sendMessage(sock, chatId, '⚠️ Error executing command.');
    }
};

// Handle new participants joining the group
const handleNewParticipants = async (sock, chatId, participants) => {
    try {
        for (const participant of participants) {
            const welcomeMessage = `👋 Welcome @${participant.split('@')[0]} to the group! Please read the group rules.`;
            await sendMessage(sock, chatId, welcomeMessage, [participant]);
            console.log(`👋 Sent welcome message to ${participant}`);
        }
    } catch (error) {
        console.error('Error sending welcome message:', error);
    }
};

const checkIfAdmin = async (sock, chatId, userId, retries = 3, delay = 2000) => {
    for (let i = 0; i < retries; i++) {
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            return groupMetadata.participants.some(p => p.id === userId && (p.admin === 'admin' || p.admin === 'superadmin'));
        } catch (error) {
            if (i === retries - 1) {
                console.error('Error checking admin status:', error);
                return false;
            }
            console.log(`Retrying checkIfAdmin (${i + 1}/${retries})...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

const handleGroupParticipantsUpdate = async (sock, update) => {
    try {
        console.log('👥 Group participants update:', update);
        const chat = await sock.groupMetadata(update.id);
        const contact = update.participants[0];
        const user = contact.split('@')[0];
        const { data: groupSettings, error } = await supabase
            .from('group_settings')
            .select('welcome_messages_enabled, goodbye_messages_enabled')
            .eq('group_id', update.id)
            .single();

        if (error) {
            console.error('Error fetching group settings:', error);
            return;
        }

        if (update.action === 'add' && groupSettings && groupSettings.welcome_messages_enabled) {
            await sock.sendMessage(chat.id, { text: formatResponseWithHeaderFooter(welcomeMessage(chat.subject, user)) });
            console.log(`👋 Sent welcome message to ${user}`);
        }

        if ((update.action === 'remove' || update.action === 'leave') && groupSettings && groupSettings.goodbye_messages_enabled) {
            let goodbyeMessage;
            if (update.action === 'remove') {
                // Select a random removed message
                const randomIndex = Math.floor(Math.random() * removedMessages.length);
                goodbyeMessage = removedMessages[randomIndex].replace('${participant}', user);
            } else if (update.action === 'leave') {
                // Select a random left message
                const randomIndex = Math.floor(Math.random() * leftMessages.length);
                goodbyeMessage = leftMessages[randomIndex].replace('${participant}', user);
            }

            // Send the goodbye message
            await sock.sendMessage(chat.id, {
                text: goodbyeMessage,
                mentions: [contact]
            });
            console.log(`👋 Sent goodbye message to ${contact}`);
        }
    } catch (error) {
        console.error('Error handling group participants update:', error);
    }
};

// Debugging with Baileys events
const setupDebugging = (sock) => {
    sock.ev.on('messages.upsert', async (chat) => {
        for (const msg of chat.messages) {
            if (!msg.key.fromMe) {  // Ignore bot's own messages
                await handleAntiDelete(sock, msg, sock.user.id);
            }
        }
    });
    sock.ev.on('messages.update', async (m) => {
        for (const message of m) {
            if (message.update.messageStubType === 68) { // Check if the update is a message deletion
                await handleAntiDelete(sock, message.update, sock.user.id);
            }
        }
    });
    sock.ev.on('connection.update', (update) => {
        console.log("Connection update:", JSON.stringify(update, null, 2));
    });
};

async function getCommunityName(sock, chatId) {
    try {
        const groupMetadata = await sock.groupMetadata(chatId);
        return groupMetadata.subject;
    } catch (error) {
        console.error('Error fetching community name:', error);
        return 'Unknown Community';
    }
}

async function addWinner(sock, chatId, sender, league, team, username) {
    try {
        const communityName = await getCommunityName(sock, chatId);

        // Check if the user already exists in the specified league and community
        let { data: existingWinner, error } = await supabase
            .from('hall_of_fame')
            .select('*')
            .eq('username', username)
            .eq('league', league)
            .eq('community_name', communityName)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        if (existingWinner) {
            // Update the existing winner's trophies count
            const { data, error } = await supabase
                .from('hall_of_fame')
                .update({ trophies: existingWinner.trophies + 1 })
                .eq('username', username)
                .eq('league', league)
                .eq('community_name', communityName);

            if (error) throw error;
        } else {
            // Insert a new winner
            const { data, error } = await supabase
                .from('hall_of_fame')
                .insert([{ username, team, league, community_name: communityName, trophies: 1 }]);

            if (error) throw error;
        }

        await sock.sendMessage(chatId, { text: `🏆 Winner added: ${username} (${team}, ${league}) in ${communityName}` });
    } catch (error) {
        console.error('Error adding winner:', error);
        await sock.sendMessage(chatId, { text: '❌ Error adding winner. Please try again.' });
    }
}

async function showHallOfFame(sock, chatId) {
    try {
        const communityName = await getCommunityName(sock, chatId);

        const { data: winners, error } = await supabase
            .from('hall_of_fame')
            .select('*')
            .eq('community_name', communityName)
            .order('trophies', { ascending: false });

        if (error) throw error;

        if (!winners || winners.length === 0) {
            await sock.sendMessage(chatId, { text: `📜 No winners found in the Hall of Fame for ${communityName}.` });
            return;
        }

        let message = `🏆 **HALL OF FAME - ${communityName}** 🏆\n`;
        message += '━━━━━━━━━━━━━━━━━━━━━\n';
        winners.forEach((winner) => {
            message += `🥇 **${winner.league}** → ${winner.username} (${winner.team}) ${'🏆'.repeat(winner.trophies)}\n`;
        });
        message += '━━━━━━━━━━━━━━━━━━━━━\n';
        message += '🔥 **Legendary Players** keep making history!\n';
        message += '📌 *Powered by Techitoon Bot*\n';

        await sock.sendMessage(chatId, { text: message });
    } catch (error) {
        console.error('Error fetching Hall of Fame:', error);
        await sock.sendMessage(chatId, { text: '❌ Error fetching Hall of Fame. Please try again.' });
    }
}

const handlePollCommand = async (sock, msg) => {
    const chatId = msg.key.remoteJid;
    
    // Log the entire message structure for debugging
    console.log("📩 Received message:", JSON.stringify(msg, null, 2));

    // Extract sender correctly
    const senderJid = msg.key.participant || msg.key.remoteJid;
    const sender = senderJid.includes(":") ? senderJid.split(":")[0] : senderJid.split("@")[0];

    console.log("📩 Extracted Poll Creator:", sender);

    if (!sender || sender.trim() === "") {
        console.error("❌ Poll creator extraction failed.");
        await sock.sendMessage(chatId, { text: '⚠️ Error: Poll creator information is missing.' });
        return;
    }

    // Extract command and message body
    let messageText = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    let lines = messageText.split("\n"); // Split by new lines

    if (lines.length < 3) {
        await sock.sendMessage(chatId, { text: "⚠️ Usage: `.poll <question>` (on first line)\n<option1>\n<option2>\n[More options if needed]" });
        return;
    }

    // Extract poll question and options
    const question = lines[0].replace('.poll ', '').trim(); // First line (removing `.poll`)
    const options = lines.slice(1).map(opt => opt.trim()); // Remaining lines as options

    // Call createPoll function
    await pollCommands.createPoll(sock, chatId, question, options, sender);
};

module.exports = { handleIncomingMessages, handleNewParticipants, checkIfAdmin, handleGroupParticipantsUpdate, setupDebugging, addWinner, showHallOfFame, handlePollCommand };