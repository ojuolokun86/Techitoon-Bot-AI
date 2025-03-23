const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { handleNewParticipants, handleGroupParticipantsUpdate } = require('../message-controller/messageHandler');
const { logInfo, logError } = require('../utils/logger');
const { resetOldWarnings } = require('../utils/scheduler');
const path = require('path');
const { processMessageWithRestrictedMode } = require('./restrictedMode');
const { handlePowerCommand, isBotOn, initializePowerState } = require('./botPower');

// Start the main bot
const startMainBot = async (sock) => {
    try {
        console.log('Initializing main bot...');

        // Initialize the bot's power state
        await initializePowerState(sock);
        console.log('⚡ Bot is starting in powered-on state.');

        // Listen for new messages
        sock.ev.on('messages.upsert', async (m) => {
            console.log('📩 New message upsert:', m);
            for (const msg of m.messages) {
                try {
                    await handlePowerCommand(sock, msg); // Handle power-related commands

                    if (!isBotOn()) {
                        console.log('🛑 Bot is powered off, ignoring all commands.');
                        continue;
                    }

                    await processMessageWithRestrictedMode(sock, msg); // Process restricted mode messages
                } catch (error) {
                    logError(`❌ Error processing message: ${error}`);
                }
            }
        });
        console.log('✅ Message handler initialized.');

        // Listen for group participant updates
        sock.ev.on('group-participants.update', async (update) => {
            try {
                if (!isBotOn()) {
                    console.log('🛑 Bot is powered off, ignoring all events.');
                    return;
                }
                await handleGroupParticipantsUpdate(sock, update);
            } catch (error) {
                logError(`❌ Error processing group participant update: ${error}`);
            }
        });
        console.log('✅ Group participant handler initialized.');
    } catch (error) {
        logError(`❌ Error starting main bot: ${error}`);
        throw error; // Rethrow the error to be handled by the caller
    }
};

// Start a user-specific bot
const startUserBot = async (userNumber) => {
    try {
        console.log(`Initializing user bot for ${userNumber}...`);
        const userSessionPath = path.resolve(`./sessions/${userNumber}`);
        const { state, saveCreds } = await useMultiFileAuthState(userSessionPath);
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
        });

        sock.ev.on('messages.upsert', async (m) => {
            console.log(`📩 New message upsert for user ${userNumber}:`, m);
            for (const msg of m.messages) {
                try {
                    await handlePowerCommand(sock, msg);

                    if (!isBotOn()) {
                        console.log('🛑 Bot is powered off, ignoring all commands.');
                        return;
                    }

                    await processMessageWithRestrictedMode(sock, msg);
                } catch (error) {
                    logError(`❌ Error processing message for user ${userNumber}: ${error}`);
                }
            }
        });

        sock.ev.on('group-participants.update', async (update) => {
            try {
                if (!isBotOn()) {
                    console.log('🛑 Bot is powered off, ignoring all events.');
                    return;
                }

                const { id, participants, action } = update;
                if (action === 'add') {
                    await handleNewParticipants(sock, id, participants);
                }
                await handleGroupParticipantsUpdate(sock, update);
            } catch (error) {
                logError(`❌ Error processing group participant update for user ${userNumber}: ${error}`);
            }
        });

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                logError(`Connection closed for user ${userNumber} due to ${lastDisconnect.error}, reconnecting ${shouldReconnect}`);
                if (shouldReconnect) {
                    startUserBot(userNumber);
                }
            } else if (connection === 'open') {
                logInfo(`Bot for user ${userNumber} is ready!`);
                resetOldWarnings(sock);
            } else if (connection === 'qr') {
                console.log(`QR code received for user ${userNumber}, sending it to their WhatsApp number.`);
            }
        });

        sock.ev.on('creds.update', saveCreds);
    } catch (error) {
        logError(`❌ Error starting user bot for ${userNumber}: ${error}`);
    }
};

const startSecurityBot = async (sock) => {
    try {
        console.log('Starting security bot...');
        // Add your security bot initialization logic here
        console.log('✅ Security bot initialized.');
    } catch (error) {
        logError(`❌ Error starting security bot: ${error}`);
    }
};

module.exports = { startMainBot, startUserBot, startSecurityBot };