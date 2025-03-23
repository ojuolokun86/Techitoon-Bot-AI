require('dotenv').config();
require('./sync-version');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { logInfo, logError } = require('./utils/logger');
const { startMainBot, startSecurityBot } = require('./bot/bot'); // Import startMainBot and startSecurityBot from bot.js

const startBot = async () => {
    try {
        console.log('Starting Techitoon Bot...');
        const { state, saveCreds } = await useMultiFileAuthState('auth_info');
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
        });

        // Start the main bot
        await startMainBot(sock);
        console.log('✅ Main bot started.');

        // Start the security bot
        await startSecurityBot(sock);
        console.log('✅ Security bot started.');

        // Handle connection updates
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            console.log('Connection update:', update);
            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                logError(`Connection closed due to ${lastDisconnect.error}, reconnecting ${shouldReconnect}`);
                if (shouldReconnect) {
                    startBot(); // Restart the bot
                }
            } else if (connection === 'open') {
                logInfo('Techitoon Bot is ready!');
            } else if (connection === 'connecting') {
                console.log('Connecting to WhatsApp...');
            } else if (connection === 'qr') {
                console.log('QR code received, please scan it with your WhatsApp app.');
            }
        });

        sock.ev.on('creds.update', saveCreds);
    } catch (error) {
        logError(`❌ Error starting bot: ${error}`);
    }
};

startBot();