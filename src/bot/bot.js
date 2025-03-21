const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { handleNewParticipants, handleGroupParticipantsUpdate } = require('../message-controller/messageHandler');
const { logInfo, logError } = require('../utils/logger');
const { resetOldWarnings } = require('../utils/scheduler');
const { initializeMesssageCache } = require('../message-controller/protection');
const path = require('path');
const { processMessageWithRestrictedMode } = require('../bot/restrictedMode');
const { handlePowerCommand, isBotOn } = require('./botPower');

async function startBot(sock) {
    sock.ev.on('messages.upsert', async (m) => {
        console.log('📩 New message upsert:', m);
        for (const msg of m.messages) {
            // Always handle power commands
            await handlePowerCommand(sock, msg);

            // If the bot is powered off, ignore all other commands
            if (!isBotOn()) {
                console.log('🛑 Bot is powered off, ignoring all commands.');
                return;
            }

            // Allow the bot to process its own messages
            await processMessageWithRestrictedMode(sock, msg);
        }
    });

    sock.ev.on('group-participants.update', async (update) => {
        // If the bot is powered off, ignore all events
        if (!isBotOn()) {
            console.log('🛑 Bot is powered off, ignoring all events.');
            return;
        }

        const { id, participants, action } = update;
        if (action === 'add') {
            await handleNewParticipants(sock, id, participants);
        }
        await handleGroupParticipantsUpdate(sock, update);
    });

    console.log('✅ Bot is ready and listening for messages.');
}

const start = async () => {
    const { state, saveCreds } = await useMultiFileAuthState(path.resolve('./auth_info'));
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
    });

    initializeMesssageCache(sock);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            logError(`Connection closed due to ${lastDisconnect.error}, reconnecting ${shouldReconnect}`);
            if (shouldReconnect) {
                start();
            }
        } else if (connection === 'open') {
            logInfo('Techitoon Bot is ready!');
            startBot(sock);
            resetOldWarnings(sock); // Start the scheduled job
        }
    });

    sock.ev.on('creds.update', saveCreds);
};

start().catch(error => {
    logError(`❌ Error starting bot: ${error}`);
});

module.exports = { start, startBot };