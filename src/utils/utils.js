const supabase = require('../supabaseClient');
const { getVersion } = require('../version'); // Import the version

// This file contains utility functions that assist with various tasks, such as formatting messages, logging errors, and managing user statistics.

function formatMessage(message) {
    return message.trim().charAt(0).toUpperCase() + message.slice(1);
}

function logError(error) {
    console.error(`[ERROR] ${new Date().toISOString()}: ${error}`);
}

function isOwner(userId) {
    const ownerId = '2348026977793';
    return userId === ownerId;
}

function manageUserStats(userId, action) {
    // Placeholder for user statistics management logic
    // This could include incrementing message counts, tracking activity, etc.
}

const formatResponseWithHeaderFooter = (message) => {
    const version = getVersion(); // Get the current version
    return `
🚀 𝙏𝙚𝙘𝙝𝙞𝙩𝙤𝙤𝙣 𝘽𝙤𝙩 🚀

${message}

━━━━━━━━━━━━━━━
  🤖 𝙏𝙚𝙘𝙝𝙞𝙩𝙤𝙤𝙣 𝘼𝙄
  🌟 Version: ${version}
━━━━━━━━━━━━━━━
`;
};

const welcomeMessage = async (sock, groupName, user, chatId) => {
    // Debugging logs
    console.log('🔍 Full sock object in welcomeMessage:', sock);
    console.log('🔍 Type of sock:', typeof sock);
    console.log('🔍 Type of sock.sendMessage:', typeof sock.sendMessage);

    // Fetch custom welcome message from Supabase
    let customMessage = null;
    try {
        const { data, error } = await supabase
            .from('group_settings')
            .select('welcome_message')
            .eq('group_id', chatId)
            .single();

        if (error) {
            console.error('❌ Error fetching custom welcome message from Supabase:', error);
        } else {
            customMessage = data?.welcome_message;
        }
    } catch (error) {
        console.error('❌ Error querying Supabase for custom welcome message:', error);
    }

    // Use custom message if available, otherwise fallback to default
    const welcomeText = customMessage
        ? customMessage.replace('{user}', `@${user.split('@')[0]}`).replace('{group}', groupName)
        : `🔥 Welcome to ${groupName}, @${user.split('@')[0]}! 🔥

🏆 This is where legends rise, champions battle, and history is made! ⚽💥 Get ready for intense competitions, thrilling matches, and unforgettable moments on the pitch.

🚀 Rules are simple: Respect, Play Fair & Enjoy the Game! 💪🎮

🔹 Tournaments? Leagues? Need Info? – DM the admin.
🔹 Stay active, stay competitive, and most importantly… HAVE FUN!

👑 Welcome to the ${groupName}! Now, let’s make history! 🔥⚽`;

    const formattedMessage = formatResponseWithHeaderFooter(welcomeText);

    // Send the message with proper WhatsApp mention
    if (sock && typeof sock.sendMessage === 'function') {
        try {
            await sock.sendMessage(chatId, {
                text: formattedMessage,
                mentions: [user], // Add the user to the mentions array
            });
            console.log(`👋 Sent welcome message to ${user}`);
        } catch (error) {
            console.error('❌ Error sending welcome message:', error);
        }
    } else {
        console.error('sock.sendMessage is not a function or sock is undefined.');
    }
};

const setWelcomeMessage = async (chatId, message) => {
    const { error } = await supabase
        .from('group_settings')
        .upsert({ group_id: chatId, welcome_message: message }, { onConflict: ['group_id'] });

    if (error) {
        console.error('Error setting custom welcome message:', error);
        return false;
    }

    return true;
};

const updateUserStats = async (userId, command) => {
    // Implement the logic to update user statistics for commands
};

const showGroupStats = async (sock, chatId) => {
    const groupMetadata = await sock.groupMetadata(chatId);
    const participants = groupMetadata.participants;

    // Example logic to determine the most active member
    const userStats = {}; // This should be populated with actual user stats
    let mostActiveMember = null;
    let maxMessages = 0;

    for (const participant of participants) {
        const userId = participant.id.split('@')[0];
        const messageCount = userStats[userId] || 0; // Replace with actual message count
        if (messageCount > maxMessages) {
            maxMessages = messageCount;
            mostActiveMember = userId;
        }
    }

    let statsText = `📊 *Group Statistics*:\n\n`;
    statsText += `👥 *Total Members:* ${participants.length}\n\n`;

    if (mostActiveMember) {
        statsText += `🏆 *Most Active Member:* @${mostActiveMember} with ${maxMessages} messages\n\n`;
    }

    for (const participant of participants) {
        const userId = participant.id.split('@')[0];
        statsText += `👤 @${userId}\n`;
        // Add more stats for each user if available
    }

    await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(statsText), mentions: participants.map(p => p.id) });
};

async function warnUser(sock, jid, user, reason) {
    const warningMessage = `⚠️ Warning: ${reason}, @${user.split("@")[0]}.`;

    // Send warning message
    await sock.sendMessage(jid, { text: warningMessage, mentions: [user] });

    console.log(`✅ Warned ${user} in ${jid}`);
}

async function isWelcomeMessageEnabled(chatId) {
    try {
        const { data, error } = await supabase
            .from('group_settings')
            .select('welcome_messages_enabled')
            .eq('group_id', chatId)
            .single();

        if (error) {
            console.error('Error fetching group settings:', error);
            return false;
        }

        return data.welcome_messages_enabled;
    } catch (error) {
        console.error('Error checking welcome message setting:', error);
        return false;
    }
}

module.exports = {
    formatMessage,
    logError,
    isOwner,
    manageUserStats,
    formatResponseWithHeaderFooter,
    welcomeMessage,
    setWelcomeMessage,
    updateUserStats,
    showGroupStats,
    warnUser,
    isWelcomeMessageEnabled,
};