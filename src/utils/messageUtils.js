const formatResponseWithHeaderFooter = require('./utils').formatResponseWithHeaderFooter;
const commandEmojis = require('./commandEmojis');
const { getPrefix } = require('./configUtils');

const sendMessage = async (sock, chatId, message, mentions = []) => {
    try {
        // Ensure mentions is always an array
        if (!Array.isArray(mentions)) {
            mentions = [];
        }

        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(message), mentions });
        console.log(`✅ Message sent to ${chatId}: ${message}`);
    } catch (error) {
        console.error(`❌ Error sending message to ${chatId}:`, error);
    }
};

const sendReaction = async (sock, chatId, messageId, messageText) => {
    try {
        // Fetch the current prefix
        const currentPrefix = await getPrefix();
        console.log(`🔍 Current Prefix: ${currentPrefix}`);

        // Extract the command name from the message text
        if (!messageText.startsWith(currentPrefix)) {
            console.log(`🛑 Message does not start with the current prefix: ${currentPrefix}`);
            return;
        }

        const command = messageText.slice(currentPrefix.length).split(' ')[0].toLowerCase();
        console.log(`🔍 Extracted Command: ${command}`);

        // Get the emoji for the command
        const emoji = commandEmojis[command] || '👍'; // Default to thumbs up if command not found
        console.log(`🔍 Emoji for Command "${command}": ${emoji}`);

        // Send the reaction
        await sock.sendMessage(chatId, {
            react: {
                text: emoji,
                key: { id: messageId, remoteJid: chatId }
            }
        });
        console.log(`✅ Emoji for Command "${command}": ${emoji}`);
        console.log(`✅ Reaction sent to message ${messageId} in ${chatId}: ${emoji}`);
    } catch (error) {
        console.error(`❌ Error sending reaction to message ${messageId} in ${chatId}:`, error);
    }
};

module.exports = { sendMessage, sendReaction };
