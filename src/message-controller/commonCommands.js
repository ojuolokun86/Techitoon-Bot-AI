const supabase = require('../supabaseClient');
const { formatResponseWithHeaderFooter } = require('../utils/utils');
const axios = require('axios');
const { enableAntiDelete, disableAntiDelete } = require('./protection'); // Import the enable and disable functions
const config = require('../config/config'); // Import the config to get the bot owner ID
const { startBot } = require('../bot/bot');
const { getPrefix } = require('../utils/configUtils'); // Import getPrefix function
const { sendHelpMenu } = require('./helpMenu'); 

// Function to show all group statistics
const showAllGroupStats = async (sock, chatId) => {
    try {
        const groupMetadata = await sock.groupMetadata(chatId);
        const totalMembers = groupMetadata.participants.length;
        const memberList = groupMetadata.participants.map(p => `👤 @${p.id.split('@')[0]}`).join('\n');

        // Fetch activity statistics from the database
        const { data: chatStats, error: chatError } = await supabase
            .from('chat_stats')
            .select('user_id, message_count')
            .eq('group_id', chatId)
            .order('message_count', { ascending: false })
            .limit(5);

        const { data: commandStats, error: commandError } = await supabase
            .from('command_stats')
            .select('user_id, command_count')
            .eq('group_id', chatId)
            .order('command_count', { ascending: false })
            .limit(5);

        if (chatError || commandError) {
            throw new Error('Error fetching activity statistics');
        }

        const mostActiveMembers = chatStats.map(stat => `👤 @${stat.user_id.split('@')[0]}: ${stat.message_count} messages`).join('\n');
        const mostCommandUsers = commandStats.map(stat => `👤 @${stat.user_id.split('@')[0]}: ${stat.command_count} commands`).join('\n');

        const statsMessage = `
📊 *Group Statistics:*

👥 *Total Members:* ${totalMembers}

${memberList}

🔥 *Most Active Members:*
${mostActiveMembers}

⚙️ *Most Command Usage:*
${mostCommandUsers}
        `;

        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(statsMessage), mentions: groupMetadata.participants.map(p => p.id) });
    } catch (error) {
        console.error('Error fetching group stats:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error fetching group statistics.') });
    }
};

// Function to update user statistics
const updateUserStats = async (userId, groupId, statName) => {
    try {
        // First, try to increment the existing value
        const { error: incrementError } = await supabase
            .from('group_stats')
            .update({ value: supabase.raw('value + 1') })
            .eq('user_id', userId)
            .eq('group_id', groupId)
            .eq('name', statName);

        if (incrementError) {
            // If increment fails, try to insert a new row
            const { error: upsertError } = await supabase
                .from('group_stats')
                .upsert({ user_id: userId, group_id: groupId, name: statName, value: 1 }, { onConflict: ['user_id', 'group_id', 'name'] });

            if (upsertError) {
                console.error('Error upserting user stats:', upsertError);
            }
        }
    } catch (error) {
        console.error('Error updating user stats:', error);
    }
};

async function sendJoke(sock, chatId) {
    try {
        const response = await axios.get('https://official-joke-api.appspot.com/random_joke');
        const joke = `${response.data.setup}\n\n${response.data.punchline}`;
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(joke) });
    } catch (error) {
        console.error('Error fetching joke:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Could not fetch a joke at this time.') });
    }
}

async function sendQuote(sock, chatId) {
    try {
        const response = await axios.get('https://api.quotable.io/random');
        const quote = `${response.data.content} — ${response.data.author}`;
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(quote) });
    } catch (error) {
        console.error('Error fetching quote:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Could not fetch a quote at this time.') });
    }
}

const sendGroupRules = async (sock, chatId) => {
    const { data, error } = await supabase
        .from('group_settings')
        .select('group_rules')
        .eq('group_id', chatId)
        .single();

    if (error || !data.group_rules) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('No group rules set.') });
    } else {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`📜 *Group Rules*:\n${data.group_rules}`) });
    }
};

const listAdmins = async (sock, chatId) => {
    const groupMetadata = await sock.groupMetadata(chatId);
    const admins = groupMetadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
    const adminList = admins.map(admin => `@${admin.id.split('@')[0]}`).join('\n');
    await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`👑 *Group Admins*:\n${adminList}`), mentions: admins.map(admin => admin.id) });
};

const sendGroupInfo = async (sock, chatId, botNumber) => {
    try {
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants;

        // Extracting members, admins, and bots
        const members = participants.map(p => `@${p.id.split('@')[0]}`);
        const admins = participants.filter(p => p.admin).map(a => `@${a.id.split('@')[0]}`);
        const bots = participants.filter(p => p.id.includes('g.us') || p.id.includes('bot')).map(b => `@${b.id.split('@')[0]}`);

        // Check if bot is active in the group
        const botActive = participants.some(p => p.id.includes(botNumber)) ? "✅ *Yes*" : "❌ *No*";

        // Format created date nicely
        const createdAt = new Date(groupMetadata.creation * 1000).toLocaleString();

        // Stylish & well-formatted group info message
        const groupInfo = `
╔══════════════════════════╗
║ 🎉 *GROUP INFORMATION* 🎉  ║
╠══════════════════════════╣
║ 📌 *Name:* ${groupMetadata.subject}
║ 📝 *Description:* ${groupMetadata.desc || "No description available"}
║ 📅 *Created At:* ${createdAt}
╠══════════════════════════╣
║ 👥 *Total Members:* ${members.length}
║ 🔰 *Total Admins:* ${admins.length}
║ 🤖 *Total Bots:* ${bots.length}
║ 🚀 *Is Bot Active?* ${botActive}
╠══════════════════════════╣
║ 🏅 *Group Admins:*  
║ ${admins.length > 0 ? admins.join(', ') : "No admins found"}
╠══════════════════════════╣
║ 🤖 *Bots in Group:*  
║ ${bots.length > 0 ? bots.join(', ') : "No bots found"}
╚══════════════════════════╝
        `;

        // Send formatted response with mentions
        await sock.sendMessage(chatId, { 
            text: formatResponseWithHeaderFooter(groupInfo), 
            mentions: [...members, ...admins, ...bots] 
        });

    } catch (error) {
        console.error("❌ Error fetching group metadata:", error);
        await sock.sendMessage(chatId, { text: "⚠️ *Failed to fetch group info. Please try again later.*" });
    }
};


// Function to enable anti-delete
const enableAntiDeleteCommand = async (sock, chatId, sender) => {
    if (sender !== config.botOwnerId) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ Only the bot owner can enable the anti-delete feature.') });
        console.log(`Unauthorized attempt to enable anti-delete by ${sender}`);
        return;
    }
    await enableAntiDelete(chatId);
    await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('🔓 Anti-delete feature has been enabled.') });
};

// Function to disable anti-delete
const disableAntiDeleteCommand = async (sock, chatId, sender) => {
    if (sender !== config.botOwnerId) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ Only the bot owner can disable the anti-delete feature.') });
        console.log(`Unauthorized attempt to disable anti-delete by ${sender}`);
        return;
    }
    await disableAntiDelete(chatId);
    await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('🔓 Anti-delete feature has been disabled.') });
};

module.exports = {
    showAllGroupStats,
    sendGroupRules,
    listAdmins,
    sendGroupInfo,
    sendHelpMenu,
    updateUserStats,
    sendJoke,
    sendQuote,
    enableAntiDeleteCommand,
    disableAntiDeleteCommand
};