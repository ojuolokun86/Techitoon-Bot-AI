const supabase = require('../supabaseClient');
const { sendMessage, sendReaction } = require('../utils/messageUtils');
const config = require('../config/config');

let messageHandler;
let handleCommand;

const loadMessageHandler = () => {
    if (!messageHandler) {
        messageHandler = require('../message-controller/messageHandler');
        handleCommand = messageHandler.handleCommand;
        console.log("✅ handleCommand loaded:", typeof handleCommand);
    }
};



// Check if restricted mode is enabled for a group
const isRestrictedModeEnabled = async (chatId) => {
    try {
        const { data, error } = await supabase
            .from('group_settings')
            .select('restricted_mode')
            .eq('group_id', chatId)
            .maybeSingle(); // Use maybeSingle to handle no rows gracefully

        if (error) {
            console.error('❌ Error fetching restricted mode setting:', error);
            return false; // Default to unrestricted if there's an error
        }

        if (!data) {
            console.log(`ℹ️ No settings found for chatId=${chatId}. Defaulting to unrestricted mode.`);
            return false; // Default to unrestricted if no row exists
        }

        return data.restricted_mode || false;
    } catch (error) {
        console.error('❌ Error checking restricted mode:', error);
        return false;
    }
};

// Toggle restricted mode
const toggleRestrictedMode = async (sock, chatId, sender, enable) => {
    console.log(`🔄 Toggling restricted mode: ${enable ? 'Enable' : 'Disable'} for chatId=${chatId}, sender=${sender}`);
    console.log(`🔍 Checking sender: ${sender} against bot owner: ${config.botOwnerId}`);

    if (sender !== config.botOwnerId) {
        console.log('❌ Unauthorized user tried to toggle restricted mode.');
        await sendMessage(sock, chatId, '❌ Only the bot owner can toggle restricted mode.');
        return;
    }

    const { data, error } = await supabase
        .from('group_settings')
        .upsert({ group_id: chatId, restricted_mode: enable }, { onConflict: 'group_id' });

    if (error) {
        console.error('❌ Supabase error:', error.message);
        await sendMessage(sock, chatId, `⚠️ Error ${enable ? 'enabling' : 'disabling'} restricted mode. Please try again later.`);
    } else {
        console.log(`✅ Restricted mode has been ${enable ? 'enabled' : 'disabled'} for chatId=${chatId}`);
        await sendMessage(sock, chatId, `✅ Restricted mode has been ${enable ? 'enabled' : 'disabled'} for this group.`);
    }
};

// Handle restricted mode commands
const handleRestrictedModeCommands = async (sock, chatId, sender, messageText) => {
    console.log(`📩 Handling restricted mode command: ${messageText} from sender=${sender}`);
    if (messageText.startsWith('.restrictbot')) {
        await toggleRestrictedMode(sock, chatId, sender, true);
    } else if (messageText.startsWith('.unrestrictbot')) {
        await toggleRestrictedMode(sock, chatId, sender, false);
    }
};

// Process incoming messages with restricted mode check
const processMessageWithRestrictedMode = async (sock, msg) => {
    const chatId = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

    console.log(`📩 Processing message: ${messageText} from sender=${sender} in chatId=${chatId}`);

    // Allow the bot to process its own messages for restricted mode commands
    const isBotMessage = msg.key.fromMe;

    // Check if restricted mode is enabled
    const restrictedMode = await isRestrictedModeEnabled(chatId);
    console.log(`🔒 Restricted mode for chatId=${chatId}: ${restrictedMode}`);

    // Handle restricted mode commands (even if the message is from the bot itself)
    if (messageText.startsWith('.restrictbot') || messageText.startsWith('.unrestrictbot')) {
        console.log(`⚙️ Handling restricted mode command: ${messageText}`);
        await handleRestrictedModeCommands(sock, chatId, sender, messageText);
        return; // Stop further processing
    }

    // If restricted mode is enabled, allow only the bot or the bot owner to execute commands
    if (restrictedMode && !isBotMessage && sender !== config.botOwnerId) {
        console.log(`❌ Command ignored: Restricted mode is enabled, and sender (${sender}) is not the bot or the owner.`);
        await sendReaction(sock, chatId, msg.key.id, '❌');
        return; // Stop further processing
    }

    // Pass the message to the message handler
    console.log("✅ handleCommand loaded:", typeof handleCommand);
    
    console.log(`➡️ Passing message to handleCommand: ${messageText}`);
    loadMessageHandler(); // Ensure messageHandler is loaded
    await handleCommand(sock, msg);
}    

module.exports = { processMessageWithRestrictedMode };