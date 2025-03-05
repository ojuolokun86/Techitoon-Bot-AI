const supabase = require('../supabaseClient');

async function getCommunityName(sock, chatId) {
    try {
        const groupMetadata = await sock.groupMetadata(chatId);
        if (groupMetadata.community) {
            const communityMetadata = await sock.groupMetadata(groupMetadata.community);
            return communityMetadata.subject;
        }
        return groupMetadata.subject;
    } catch (error) {
        console.error('Error fetching community name:', error);
        return 'Unknown Community';
    }
}

async function isAdmin(sock, chatId, userId) {
    try {
        const groupMetadata = await sock.groupMetadata(chatId);
        const participant = groupMetadata.participants.find(p => p.id === userId);
        return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
}

async function addWinner(sock, chatId, sender, league, team, username) {
    try {
        const communityName = await getCommunityName(sock, chatId);

        // Check if the user is the bot owner or an admin
        const isUserAdmin = await isAdmin(sock, chatId, sender);
        if (sender !== config.botOwnerId && !isUserAdmin) {
            await sock.sendMessage(chatId, { text: '❌ Only the bot owner or admins can add a winner.' });
            return;
        }

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

module.exports = { addWinner, showHallOfFame };