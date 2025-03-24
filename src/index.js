require('dotenv').config();
require('./sync-version');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { logInfo, logError } = require('./utils/logger');
const { startMainBot, startSecurityBot } = require('./bot/bot'); // Import startMainBot and startSecurityBot from bot.js

const startBot = async () => {
    try {
        console.log('🚀 Starting Techitoon Bot...');
        
        console.log('🔄 Fetching authentication state...');
        const { state, saveCreds } = await useMultiFileAuthState('auth_info');
        console.log('✅ Authentication state fetched.');

        console.log('🔄 Creating WhatsApp socket...');
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
        });
        console.log('✅ WhatsApp socket created.');

        // Start the main bot
        console.log('🔄 Starting main bot...');
        await startMainBot(sock);
        console.log('✅ Main bot started.');

        // Start the security bot
        console.log('🔄 Starting security bot...');
        await startSecurityBot(sock);
        console.log('✅ Security bot started.');

        // Handle connection updates
        sock.ev.on('connection.update', (update) => {
            console.log('🔄 Connection update received:', update);
            const { connection, lastDisconnect } = update;

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                logError(`Connection closed due to ${lastDisconnect.error}, reconnecting ${shouldReconnect}`);
                if (shouldReconnect) {
                    startBot();
                }
            } else if (connection === 'open') {
                logInfo('✅ Techitoon Bot is ready!');
            } else if (connection === 'connecting') {
                console.log('🔄 Connecting to WhatsApp...');
            } else if (connection === 'qr') {
                console.log('📱 QR code received, please scan it.');
            }
        });

        sock.ev.on('creds.update', saveCreds);
        console.log('✅ Credentials update handler set.');

        console.log('🎉 Techitoon Bot is fully started!');
    } catch (error) {
        console.error('❌ Fatal error in startBot():', error);
    }
};

startBot();