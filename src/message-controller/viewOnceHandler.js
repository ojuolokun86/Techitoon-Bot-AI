const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const supabase = require('../supabaseClient');
const config = require('../config/config');
const { formatResponseWithHeaderFooter } = require('../utils/utils');

// Function to detect view-once media
const detectViewOnceMedia = (message) => {
    console.log('Detecting view-once media...');
    console.log('Message structure:', JSON.stringify(message, null, 2));

    if (message.message?.viewOnceMessage) {
        return message.message.viewOnceMessage.message;  // ✅ Detects top-level view-once message
    }

    // ✅ Check if the quoted message is view-once
    const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.viewOnceMessage?.message;
    if (quotedMessage?.viewOnceMessage) {
        return quotedMessage.viewOnceMessage.message;
    }

    console.log('No view-once message found.');
    return null;
};

// Auto-save and resend view-once media
const autoSaveViewOnceMedia = async (sock, msg) => {
    const chatId = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;

    // Check if view-once reposting is enabled
    const isEnabled = await getViewOnceStatus(chatId);
    if (!isEnabled) return;

    console.log('View-once message detected:', JSON.stringify(msg, null, 2));

    const viewOnceMessage = detectViewOnceMedia(msg);
    if (!viewOnceMessage) return;

    try {
        // Extract media from the view-once message
        const mediaMessage = viewOnceMessage.imageMessage || viewOnceMessage.videoMessage;
        if (!mediaMessage) return;

        // Download media
        const mediaBuffer = await downloadMediaMessage(msg, 'buffer');
        const mediaType = mediaMessage.mimetype.split('/')[0];

        // Send media back to the chat
        if (mediaType === 'image') {
            await sock.sendMessage(chatId, { image: mediaBuffer, caption: '🔄 Reposted view-once image' });
        } else if (mediaType === 'video') {
            await sock.sendMessage(chatId, { video: mediaBuffer, caption: '🔄 Reposted view-once video' });
        }

        console.log('✅ View-once media saved and resent successfully.');
    } catch (error) {
        console.error('❌ Error saving view-once media:', error);
    }
};


const repostViewOnceMedia = async (sock, msg) => {
    const chatId = msg.key.remoteJid;
    console.log('Reposting view-once media:', JSON.stringify(msg, null, 2));

    const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quotedMessage) {
        console.log('❌ No quoted message found.');
        return;
    }

    const viewOnceMessage = detectViewOnceMedia({ message: quotedMessage });  // ✅ Pass the quoted message correctly
    if (!viewOnceMessage) {
        console.log('❌ No view-once media detected.');
        return;
    }

    try {
        const mediaMessage = viewOnceMessage.imageMessage || viewOnceMessage.videoMessage;
        if (!mediaMessage) {
            console.log('❌ No media found in view-once message.');
            return;
        }

        // Download media
        const mediaBuffer = await downloadMediaMessage({ message: quotedMessage }, 'buffer');
        const mediaType = mediaMessage.mimetype.split('/')[0];

        // Resend the media
        if (mediaType === 'image') {
            await sock.sendMessage(chatId, { image: mediaBuffer, caption: '🔄 Reposted view-once image' });
        } else if (mediaType === 'video') {
            await sock.sendMessage(chatId, { video: mediaBuffer, caption: '🔄 Reposted view-once video' });
        }

        console.log('✅ View-once media reposted successfully.');
    } catch (error) {
        console.error('❌ Error reposting view-once media:', error);
    }
};


// Function to check if view-once reposting is enabled
const getViewOnceStatus = async (chatId) => {
    try {
        const { data, error } = await supabase
            .from('view_once_settings')
            .select('enabled')
            .eq('chat_id', chatId)
            .single();

        if (error) {
            console.error('Error fetching view-once settings:', error);
            return false;
        }
        return data.enabled;
    } catch (error) {
        console.error('Error checking view-once settings:', error);
        return false;
    }
};

// Function to enable or disable view-once reposting
const setViewOnceEnabled = async (chatId, enabled) => {
    try {
        const { error } = await supabase
            .from('view_once_settings')
            .upsert({ chat_id: chatId, enabled });

        if (error) {
            console.error('Error setting view-once settings:', error);
            return false;
        }

        console.log(`View-once reposting has been ${enabled ? 'enabled' : 'disabled'} for chat ${chatId}`);
        return true;
    } catch (error) {
        console.error('Error setting view-once settings:', error);
        return false;
    }
};

// Function to handle view-once commands
const handleViewOnceCommand = async (sock, chatId, sender, args) => {
    console.log(`Handling view-once command: ${args.join(' ')} from sender: ${sender} in chat: ${chatId}`);

    if (sender !== config.botOwnerId) {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ Only the bot owner can use this command.') });
        return;
    }

    const command = args[0]?.toLowerCase();
    if (!command) {
        const status = await getViewOnceStatus(chatId);
        return await sock.sendMessage(chatId, { text: `🔹 *View-Once Reposting Status:* ${status ? 'Enabled ✅' : 'Disabled ❌'}` });
    }

    let status = true;
    let type = 'single';

    if (command === 'off') status = false;
    if (args[1] === 'all') type = 'global';
    if (args[1] === 'group') type = 'group';
    if (args[1] === 'private') type = 'private';

    await setViewOnceEnabled(chatId, status, type);

    let responseText = `✅ *View-Once Reposting has been ${status ? 'Enabled' : 'Disabled'}*`;
    if (type === 'global') responseText += ' for *All Chats* (Groups & Private)';
    else if (type === 'group') responseText += ' for *All Groups*';
    else if (type === 'private') responseText += ' for *All Private Messages*';
    else responseText += ` in this chat.`;

    await sock.sendMessage(chatId, { text: responseText });
};

// Function to handle incoming messages
const handleIncomingMessage = async (sock, msg) => {
    if (msg.message?.viewOnceMessage) {
        await autoSaveViewOnceMedia(sock, msg);
    }
};

module.exports = {
    handleIncomingMessage,
    detectViewOnceMedia,
    autoSaveViewOnceMedia,
    getViewOnceStatus,
    setViewOnceEnabled,
    handleViewOnceCommand,
    repostViewOnceMedia
};