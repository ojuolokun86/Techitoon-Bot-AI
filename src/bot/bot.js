const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { handleNewParticipants, handleGroupParticipantsUpdate } = require('../message-controller/messageHandler');
const { logInfo, logError } = require('../utils/logger');
const { resetOldWarnings } = require('../utils/scheduler');
const { initializeMesssageCache } = require('../message-controller/protection');
const path = require('path');
const { processMessageWithRestrictedMode } = require('../bot/restrictedMode');
const { handlePowerCommand, isBotOn } = require('./botPower');
//const { addUser, getUsers, removeUser } = require('../userManager');

async function startUserBot(userNumber) {
    const userSessionPath = path.resolve(`./sessions/${userNumber}`);
    const { state, saveCreds } = await useMultiFileAuthState(userSessionPath);
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
    });

    sock.ev.on('messages.upsert', async (m) => {
        console.log(`📩 New message upsert for user ${userNumber}:`, m);
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
            resetOldWarnings(sock); // Start the scheduled job
        } else if (connection === 'qr') {
            console.log(`QR code received for user ${userNumber}, sending it to their WhatsApp number.`);
            // Send the QR code to the user's WhatsApp number
            const qrCodeImage = Buffer.from(update.qr, 'base64');
            sock.sendMessage(userNumber, { image: qrCodeImage, caption: 'Scan this QR code to authenticate your bot.' });
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

//async function startMainBot() {
  //  const users = await getUsers();
   // for (const userNumber of users) {
   //     startUserBot(userNumber);
    //}
//}

const start = async () => {
    console.log('Starting main bot...');
    startMainBot();
};

start().catch(error => {
    logError(`❌ Error starting main bot: ${error}`);
});

module.exports = { start, startUserBot };