const supabase = require('../supabaseClient');
const { formatResponseWithHeaderFooter } = require('../utils/utils');
const axios = require('axios');
const { enableAntiDelete, disableAntiDelete } = require('./protection'); // Import the enable and disable functions
const config = require('../config/config'); // Import the config to get the bot owner ID
const { startBot } = require('../bot/bot');
const { getPrefix } = require('../utils/configUtils'); // Import getPrefix function

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

const sendHelpMenu = async (sock, chatId, isGroup, isAdmin) => {
    const currentPrefix = await getPrefix(); // Get the current prefix dynamically
    const helpText = `
📜✨ 𝙏𝙚𝙘𝙝𝙞𝙩𝙤𝙤𝙣 𝘽𝙤𝙩 𝙈𝙚𝙣𝙪 ✨📜
🔹 Your friendly AI assistant, here to serve! 🤖

💡 General Commands:
📍 ${currentPrefix}ping – Am I alive? Let’s find out! ⚡
📍 ${currentPrefix}menu – Shows this awesome menu! 📜
📍 ${currentPrefix}joke – Need a laugh? I got you! 😂
📍 ${currentPrefix}quote – Get inspired with a random quote! ✨
📍 ${currentPrefix}weather <city> – Check the skies before you step out! ☁️🌦️
📍 ${currentPrefix}translate <text> – Lost in translation? I’ll help! 🈶➡️🇬🇧

👑 Admin Commands (Boss Mode Activated!):
🛠️ ${currentPrefix}admin – See who’s running the show! 🏆
📊 ${currentPrefix}info – Get group details in one click! 🕵️‍♂️
📜 ${currentPrefix}rules – Read the sacred laws of the group! 📖
🧹 ${currentPrefix}clear – Wipe the chat clean! 🚮 (Admin Only)
🚫 ${currentPrefix}ban @user – Send someone to exile! 👋 (Admin Only)
🎤 ${currentPrefix}tagall – Summon all group members! 🏟️ (Admin Only)
🔇 ${currentPrefix}mute – Silence! Only admins can speak! 🤫 (Admin Only)
🔊 ${currentPrefix}unmute – Let the people speak again! 🎙️ (Admin Only)
📢 ${currentPrefix}announce <message> – Make a grand announcement! 📡 (Admin Only)
🚫 ${currentPrefix}stopannounce – End announcement mode! ❌ (Admin Only)

🔗 Anti-Link Commands:
🔗 ${currentPrefix}antilink on – Enable anti-link feature! 🔒 (Admin Only)
🔗 ${currentPrefix}antilink off – Disable anti-link feature! 🔓 (Admin Only)
🔗 ${currentPrefix}antilink permit @user – Allow a user to post links. ✅ (Admin Only)
🔗 ${currentPrefix}antilink nopermit @user – Revoke a user's permission to post links. ❌ (Admin Only)
🔗 ${currentPrefix}antilink permitnot – Remove all link permissions in the group. 🔄 (Admin Only)

🛍️ Anti-Sales Commands:
🛍️ ${currentPrefix}antisales on – Enable anti-sales feature! 🔒 (Admin Only)
🛍️ ${currentPrefix}antisales off – Disable anti-sales feature! 🔓 (Admin Only)
🛍️ ${currentPrefix}antisales permit @user – Allow a user to post sales content. ✅ (Admin Only)
🛍️ ${currentPrefix}antisales nopermit @user – Revoke a user's permission to post sales content. ❌ (Admin Only)
🛍️ ${currentPrefix}antisales permitnot – Remove all sales permissions in the group. 🔄 (Admin Only)

⚙️ Group & Bot Settings:
📝 ${currentPrefix}setgrouprules <rules> – Set the laws of the land! 📜 (Admin Only)
📜 ${currentPrefix}settournamentrules <rules> – Define tournament rules! ⚽ (Admin Only)
🈯 ${currentPrefix}setlanguage <language> – Change the bot’s language! 🌍 (Admin Only)
📊 ${currentPrefix}showstats – Who’s been the most active? 📈 (Admin Only)
❌ ${currentPrefix}delete – Erase unwanted messages! 🔥 (Admin Only)
🚀 ${currentPrefix}enable – Power up the bot! ⚡
🛑 ${currentPrefix}disable – Shut me down… but why? 😢
🎉 ${currentPrefix}startwelcome – Activate welcome messages! 🎊 (Admin Only)
🚫 ${currentPrefix}stopwelcome – No more welcome hugs! 🙅‍♂️ (Admin Only)

⚠️ Warnings & Moderation:
🚨 ${currentPrefix}warn @user <reason> – Issue a formal warning! ⚠️ (Admin Only)
📜 ${currentPrefix}listwarn – Check the troublemakers! 👀 (Admin Only)
❌ ${currentPrefix}resetwarn @user – Forgive and forget! ✝️ (Admin Only)

🔒 Anti-Delete:
🔓 ${currentPrefix}antidelete on – Enable anti-delete feature! 🔒 (Admin Only)
🔓 ${currentPrefix}antidelete off – Disable anti-delete feature! 🔓 (Admin Only)

🏆 Hall of Fame:
📜 ${currentPrefix}fame – Show the Hall of Fame! 🏆

💡 Use commands wisely! Or the bot might just develop a mind of its own… 🤖💀

🚀 𝙏𝙚𝙘𝙝𝙞𝙩𝙤𝙤𝙣 - Making WhatsApp Chats Smarter! 🚀
    `;
    await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(helpText) });
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