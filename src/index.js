require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { logInfo, logError } = require('./utils/logger');
const { handleGroupParticipantsUpdate } = require('./message-controller/messageHandler');
const { startSecurityBot } = require('./security');
const { processMessageWithRestrictedMode } = require('./bot/restrictedMode'); // Import restrictedMode.js
const config = require('./config/config');
const supabase = require('./supabaseClient');
const { handlePowerCommand, isBotOn } = require('./bot/botPower');
const { addUser, getUsers, removeUser } = require('./userManager');
const { startUserBot } = require('./bot/bot');

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
            // Always handle power commands
            await handlePowerCommand(sock, msg);

            // If the bot is powered off, ignore all other commands
            if (!isBotOn()) {
                console.log('🛑 Bot is powered off, ignoring all commands.');
                continue;
            }

            // Ignore bot's own messages
            await processMessageWithRestrictedMode(sock, msg); // Use restrictedMode.js
        }
    });

    sock.ev.on('group-participants.update', async (update) => {
        // If the bot is powered off, ignore all events
        if (!isBotOn()) {
            console.log('🛑 Bot is powered off, ignoring all events.');
            return;
        }
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

//bot.on('message', async (msg) => {
   // const sender = msg.sender;
   // const message = msg.body.trim();
    //const args = message.split(' ');

    //if (message.startsWith('.adduser')) {
      //  if (!args[1]) return bot.sendMessage(sender, "Usage: .adduser <user_number>");
        //const response = await addUser(args[1]);
       // bot.sendMessage(sender, response);
       // startUserBot(args[1]); // Start the bot for the new user
    //} else if (message === '.users') {
      //  const users = await getUsers();
       // bot.sendMessage(sender, `Registered Users:\n${users.join('\n')}`);
    //} else if (message.startsWith('.removeuser')) {
        //if (!args[1]) return bot.sendMessage(sender, "Usage: .removeuser <user_number>");
      //  const response = await removeUser(args[1]);
    //    bot.sendMessage(sender, response);
  //  }
//});