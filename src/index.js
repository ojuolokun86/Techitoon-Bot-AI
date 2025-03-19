require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { logInfo, logError } = require('./utils/logger');
const { handleGroupParticipantsUpdate } = require('./message-controller/messageHandler');
const { startSecurityBot } = require('./security');
const { processMessageWithRestrictedMode } = require('./bot/restrictedMode'); // Import restrictedMode.js
const config = require('./config/config');
const supabase = require('./supabaseClient');

async function saveSuperadmin(groupId, userId) {
    await supabase
        .from('superadmins')
        .upsert([{ group_id: groupId, user_id: userId }]);
}

async function fetchGroupMetadataWithRetry(sock, groupId, retries = 3, delay = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await sock.groupMetadata(groupId);
        } catch (err) {
            if (i === retries - 1) {
                throw err;
            }
            console.log(`Retrying fetchGroupMetadata (${i + 1}/${retries})...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

async function startMainBot(sock) {
    sock.ev.on('messages.upsert', async (m) => {
        console.log('📩 New message upsert:', m);
        for (const msg of m.messages) {
        // Ignore bot's own messages
                await processMessageWithRestrictedMode(sock, msg); // Use restrictedMode.js
            
        }
    });

    sock.ev.on('group-participants.update', async (update) => {
        await handleGroupParticipantsUpdate(sock, update);
    });

    console.log('✅ Main bot is ready and listening for messages.');
}

const start = async () => {
    console.log('Starting bot...');
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        console.log('Connection update:', update);
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            logError(`Connection closed due to ${lastDisconnect.error}, reconnecting ${shouldReconnect}`);
            if (shouldReconnect) {
                start();
            }
        } else if (connection === 'open') {
            logInfo('Techitoon Bot is ready!');
            startMainBot(sock);
            startSecurityBot(sock);
        } else if (connection === 'connecting') {
            console.log('Connecting to WhatsApp...');
        } else if (connection === 'qr') {
            console.log('QR code received, please scan it with your WhatsApp app.');
        }
    });

    sock.ev.on('creds.update', saveCreds);
};

start().catch(error => {
    logError(`❌ Error starting bot: ${error}`);
});