const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { handleIncomingMessages, handleNewParticipants, handleGroupParticipantsUpdate } = require('../message-controller/messageHandler');
const { handleStatusUpdate } = require('../message-controller/statusHandler'); // Import the status handler
const { logInfo, logError } = require('../utils/logger');
const { resetOldWarnings } = require('../utils/scheduler');
const { initializeMessageCache } = require('../message-controller/protection');
const path = require('path');

async function startBot(sock) {
    sock.ev.on('messages.upsert', async (m) => {
        console.log('📩 New message upsert:', m);
        await handleIncomingMessages(sock, m);
    });

    sock.ev.on('group-participants.update', async (update) => {
        const { id, participants, action } = update;
        if (action === 'add') {
            await handleNewParticipants(sock, id, participants);
        }
        await handleGroupParticipantsUpdate(sock, update);
    });

    // Listen for status updates
    sock.ev.on('status.update', async (statusUpdate) => {
        console.log('📩 New status update:', statusUpdate);
        await handleStatusUpdate(sock, statusUpdate);
    });

    console.log('✅ Bot is ready and listening for messages and status updates.');
}

const start = async () => {
    const { state, saveCreds } = await useMultiFileAuthState(path.resolve('./auth_info'));
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
    });

    initializeMessageCache(sock); // Initialize message cache

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            logError(`Connection closed due to ${lastDisconnect.error}, reconnecting ${shouldReconnect}`);
            if (shouldReconnect) {
                start();
            } else {
                console.error('Failed to reconnect. Check your internet and restart.');
            }
        } else if (connection === 'open') {
            logInfo('Techitoon Bot is ready!');
            startBot(sock);
            resetOldWarnings(sock); // Start the scheduled job
        } else if (update.qr) {
            console.log('Connection update:', update);
        }
    });

    sock.ev.on('creds.update', saveCreds);
};

start().catch(error => {
    logError(`❌ Error starting bot: ${error}`);
});

module.exports = { start, startBot };