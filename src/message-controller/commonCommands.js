const supabase = require('../supabaseClient');
const { formatResponseWithHeaderFooter } = require('../utils/utils');
const axios = require('axios');
const https = require('https');
const { enableAntiDelete, disableAntiDelete } = require('./protection'); // Import the enable and disable functions
const config = require('../config/config'); // Import the config to get the bot owner ID
const { startBot } = require('../bot/bot');
const { getPrefix } = require('../utils/configUtils'); // Import getPrefix function
const { sendHelpMenu } = require('./helpMenu'); 
const cron = require('node-cron');

// Store cron jobs to stop them later
const cronJobs = {};

// Function to show all group statistics
const showAllGroupStats = async (sock, chatId) => {
    try {
        console.log('Fetching group metadata...');
        const groupMetadata = await sock.groupMetadata(chatId);
        console.log('Group metadata fetched:', groupMetadata);

        const totalMembers = groupMetadata.participants.length;
        const memberList = groupMetadata.participants.map(p => `👤 @${p.id.split('@')[0]}`).join('\n');

        // Fetch activity statistics from the database
        console.log('Fetching chat stats...');
        const { data: chatStats, error: chatError } = await supabase
            .from('chat_stats')
            .select('user_id, message_count')
            .eq('group_id', chatId)
            .order('message_count', { ascending: false })
            .limit(5);

        console.log('Fetching command stats...');
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

        console.log('Sending stats message...');
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

const sendQuote = async (sock, chatId) => {
    try {
        const response = await axios.get('https://qapi.vercel.app/api/random');
        console.log('Quote API response:', response.data); // Log the response data
        const quote = response.data.quote; // Correctly access the 'quote' property
        const author = response.data.author;

        if (!quote || !author) {
            throw new Error('Invalid response structure');
        }

        const formattedQuote = `
✦ ✦ ✦ *QUOTE OF THE DAY* ✦ ✦ ✦

❝ *${quote}* ❞

— _${author}_ ✨
        `;

        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(formattedQuote) });
    } catch (error) {
        console.error('Error fetching quote:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Could not fetch a quote at this time.') });
    }
};

// Function to validate cron expressions
const isValidCronExpression = (expression) => {
    const cronRegex = /^(\*|([0-5]?\d)) (\*|([01]?\d|2[0-3])) (\*|([01]?\d|2[0-3])) (\*|([1-9]|[12]\d|3[01])) (\*|([1-9]|1[0-2])) (\*|([0-6]))$/;
    return cronRegex.test(expression);
};

// Function to convert time to cron expression
const convertTimeToCron = (time) => {
    const [hour, minute] = time.split(':');
    return `${minute} ${hour} * * *`;
};

// Function to schedule a single quote
const scheduleQuote = async (sock, chatId, time) => {
    try {
        // Convert time to cron expression
        const cronTime = convertTimeToCron(time);

        // Validate cron expression
        if (!isValidCronExpression(cronTime)) {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`⚠️ Invalid cron expression: ${cronTime}`) });
            return;
        }

        // Save schedule to database
        const { data, error } = await supabase
            .from('quote_schedules')
            .insert([{ group_id: chatId, schedule_type: 'quote', times: JSON.stringify([cronTime]) }]);

        if (error) {
            throw new Error('Error saving schedule to database');
        }

        // Schedule the quote
        const job = cron.schedule(cronTime, async () => {
            await sendQuote(sock, chatId);
        });

        // Store the cron job
        cronJobs[chatId] = job;

        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`✅ Quote schedule has been set for ${time}. Quotes will be posted daily at this time until the schedule is stopped.`) });
    } catch (error) {
        console.error('Error scheduling quote:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error scheduling quote.') });
    }
};

// Function to stop scheduled quotes
const stopScheduledQuotes = async (sock, chatId) => {
    try {
        // Remove schedule from database
        const { error } = await supabase
            .from('quote_schedules')
            .delete()
            .eq('group_id', chatId)
            .eq('schedule_type', 'quote');

        if (error) {
            throw new Error('Error removing schedule from database');
        }

        // Stop the cron job
        if (cronJobs[chatId]) {
            cronJobs[chatId].stop();
            delete cronJobs[chatId];
        }

        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('✅ Quote schedule has been stopped. No more quotes will be posted.') });
    } catch (error) {
        console.error('Error stopping scheduled quotes:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error stopping scheduled quotes.') });
    }
};

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

// Function to list all bots in the group
const listBotsInGroup = async (sock, chatId) => {
    try {
        const groupMetadata = await sock.groupMetadata(chatId);
        const bots = groupMetadata.participants.filter(p => p.id.includes('bot') || p.id.includes('g.us')).map(b => `@${b.id.split('@')[0]}`);

        const botsMessage = `
🤖 *Bots in Group:*
${bots.length > 0 ? bots.join('\n') : "No bots found"}
        `;

        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(botsMessage), mentions: bots });
    } catch (error) {
        console.error('Error listing bots in group:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error listing bots in group.') });
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
    disableAntiDeleteCommand,
    listBotsInGroup,
    scheduleQuote,
    stopScheduledQuotes
};