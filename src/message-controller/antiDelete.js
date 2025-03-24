const supabase = require('../supabaseClient');
const { getAntiDeleteStatus } = require('../database/botSettings');
const { getDeletedMessage, storeDeletedMessage } = require('../database/antideleteDB');

let antiDeleteGroups = new Set(); // Store groups with anti-delete enabled

const enableAntiDelete = async (chatId, type = 'single') => {
    if (type === 'global') {
        const { error } = await supabase.from('anti_delete_settings').upsert({ global: true });
        if (error) {
            console.error("Failed to enable global anti-delete:", error);
        } else {
            antiDeleteGroups.add('global');
        }
    } else if (type === 'group') {
        const { error } = await supabase.from('anti_delete_settings').upsert({ groupOnly: true });
        if (error) {
            console.error("Failed to enable group-only anti-delete:", error);
        } else {
            antiDeleteGroups.add('group');
        }
    } else if (type === 'private') {
        const { error } = await supabase.from('anti_delete_settings').upsert({ privateOnly: true });
        if (error) {
            console.error("Failed to enable private-only anti-delete:", error);
        } else {
            antiDeleteGroups.add('private');
        }
    } else {
        const { error } = await supabase.from('anti_delete_groups').insert([{ chat_id: chatId }]);
        if (error) {
            console.error("Failed to enable anti-delete:", error);
        } else {
            antiDeleteGroups.add(chatId);
        }
    }
};

const disableAntiDelete = async (chatId, type = 'single') => {
    if (type === 'global') {
        const { error } = await supabase.from('anti_delete_settings').upsert({ global: false });
        if (error) {
            console.error("Failed to disable global anti-delete:", error);
        } else {
            antiDeleteGroups.delete('global');
        }
    } else if (type === 'group') {
        const { error } = await supabase.from('anti_delete_settings').upsert({ groupOnly: false });
        if (error) {
            console.error("Failed to disable group-only anti-delete:", error);
        } else {
            antiDeleteGroups.delete('group');
        }
    } else if (type === 'private') {
        const { error } = await supabase.from('anti_delete_settings').upsert({ privateOnly: false });
        if (error) {
            console.error("Failed to disable private-only anti-delete:", error);
        } else {
            antiDeleteGroups.delete('private');
        }
    } else {
        const { error } = await supabase.from('anti_delete_groups').delete().eq('chat_id', chatId);
        if (error) {
            console.error("Failed to disable anti-delete:", error);
        } else {
            antiDeleteGroups.delete(chatId);
        }
    }
};

const handleAntiDelete = async (sock, message, botNumber) => {
    const chatId = message.key.remoteJid;
    const sender = message.key.participant || message.key.remoteJid;

    if (message.messageStubType === 'message_revoke_for_everyone' && sender !== botNumber) {
        const deletedMessageKey = message.messageProtocolContextInfo?.stanzaId;
        if (!deletedMessageKey) {
            console.log("No stanzaId found");
            return;
        }

        console.log(`🛑 Message deleted in ${chatId} by ${sender}`);

        // Fetch deleted message from database
        const deletedMessage = await getDeletedMessage(chatId, deletedMessageKey);
        if (!deletedMessage) {
            console.log("⚠️ Message not found in database. Cannot restore.");
            return;
        }

        console.log(`✅ Restoring message from database:`, deletedMessage);

        await sock.sendMessage(chatId, {
            text: `🔄 *Restored Message from @${sender.split('@')[0]}:*\n${deletedMessage.text}`,
            mentions: [sender]
        });
    }
};

// Store messages before deletion
function initializeMessageCache(sock) {
    sock.ev.on("messages.upsert", async ({ messages }) => {
        for (const msg of messages) {
            const chatId = msg.key.remoteJid;
            const sender = msg.key.participant || chatId;
            const messageId = msg.key.id;

            if (!msg.message) return;  // Ignore empty messages

            const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
            if (!messageText) return; // Ignore unsupported message types

            // Check if anti-delete is enabled in the group
            const isGroup = chatId.endsWith('@g.us');
            if (!await getAntiDeleteStatus(chatId, isGroup)) return;

            await storeDeletedMessage(chatId, messageId, messageText);
        }
    });
}

// Auto-delete old messages from the database
const deleteOldMessages = async () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const { error } = await supabase
        .from('anti_delete_messages')
        .delete()
        .lt('timestamp', threeDaysAgo.toISOString());

    if (error) console.error("Failed to delete old messages:", error);
};

// Run every hour
setInterval(deleteOldMessages, 60 * 60 * 1000);

module.exports = { handleAntiDelete, initializeMessageCache, enableAntiDelete, disableAntiDelete };