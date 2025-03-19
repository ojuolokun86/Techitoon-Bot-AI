const { sendMessage, sendReaction } = require('../utils/messageUtils');
const supabase = require('../supabaseClient');
const { issueWarning, resetWarnings, listWarnings } = require('../message-controller/warning');
const config = require('../config/config');
const { updateUserStats } = require('../utils/utils');
const commonCommands = require('../message-controller/commonCommands');
const adminCommands = require('../message-controller/adminActions');
const botCommands = require('../message-controller/botCommands');
const scheduleCommands = require('../message-controller/scheduleMessage');
const pollCommands = require('../message-controller/polls');
const tournamentCommands = require('../message-controller/tournament');
const { handleProtectionMessages, handleAntiDelete, enableAntiDelete, disableAntiDelete } = require('../message-controller/protection');
const { exec } = require("child_process");
const { removedMessages, leftMessages } = require('../utils/goodbyeMessages');
const { formatResponseWithHeaderFooter, welcomeMessage } = require('../utils/utils');
const { startBot } = require('../bot/bot');
const { handleNewImage, startTournament, showTopScorers, showLeaderboard, addGoal, setGoal, endTournament, addPlayer, removePlayer, listPlayers, uploadResult, enableAutoCheckResult, disableAutoCheckResult } = require('./tournamentHandler');
const { showHallOfFame, addWinner } = require('./hallOfFame');



let goodbyeMessagesEnabled = false; // Global variable to track goodbye messages status, default to false

const isAdminOrOwner = async (sock, chatId, sender) => {
    try {
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants;

        console.log("Participants:", participants); // Debugging log

        const isAdmin = participants.some(p => p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin'));
        const isOwner = sender === config.botOwnerId;

        console.log(`Checking Admin Status - Sender: ${sender}, Is Admin: ${isAdmin}, Is Owner: ${isOwner}`);

        return isAdmin || isOwner;
    } catch (error) {
        console.error('Error fetching admin status:', error);
        return false;
    }
};

const saveMessageToDatabase = async (chatId, messageId, sender, messageContent) => {
    console.log(`Saving message to database: chatId=${chatId}, messageId=${messageId}, sender=${sender}, messageContent=${messageContent}`);
    const { error } = await supabase
        .from('anti_delete_messages')
        .insert([
            { 
                chat_id: chatId, 
                message_id: messageId, 
                sender: sender, 
                message_content: messageContent, 
                timestamp: new Date().toISOString() // Add timestamp
            }
        ]);

    if (error) {
        console.error('Error saving message to database:', error);
    } else {
        console.log('Message saved successfully');
    }
};


const handleCommand = async (sock, msg) => {
    const chatId = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

    if (messageText.startsWith('.tagall')) {
        const repliedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation || '';
        const message = messageText.replace('.tagall', '').trim();
        await adminCommands.tagAll(sock, chatId, message, sender, repliedMessage);
    } else if (messageText.startsWith('.help')) {
        await handleHelpCommand(sock, chatId, sender);
    } else if (messageText.startsWith('.warn')) {
            if (!await isAdminOrOwner(sock, chatId, sender)) {
                await sendMessage(sock, chatId, '❌ You must be an admin to issue warnings.');
                return;
            }
    
            const args = messageText.split(' ').slice(1);
            const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            
            if (mentions.length === 0) {
                await sendMessage(sock, chatId, '⚠️ Error: No user mentioned.');
                return;
            }
    
            const userId = mentions[0];
            const reason = args.slice(1).join(' ') || 'No reason provided';
            const warningThreshold = config.warningThreshold.default;
    
            await issueWarning(sock, chatId, userId, reason, warningThreshold);
        } else if (messageText.startsWith('.resetwarn')) {
            if (!await isAdminOrOwner(sock, chatId, sender)) {
                await sendMessage(sock, chatId, '❌ You must be an admin to reset warnings.');
                return;
            }
    
            const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            
            if (mentions.length === 0) {
                await sendMessage(sock, chatId, '⚠️ Error: No user mentioned.');
                return;
            }
    
            const userId = mentions[0];
    
            await resetWarnings(sock, chatId, userId);
        } else if (messageText.startsWith('.promote')) {
            if (!await isAdminOrOwner(sock, chatId, sender)) {
                await sendMessage(sock, chatId, '❌ Only admins or the bot owner can use this command.');
                return;
            }
            const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mentions.length === 0) {
                await sendMessage(sock, chatId, '⚠️ Error: No user mentioned.');
                return;
            }
            const userId = mentions[0];
            await adminCommands.promoteUser(sock, chatId, userId, sender);
    } else if (messageText.startsWith('.antidelete on')) {
        await enableAntiDelete(chatId);
        await sendMessage(sock, chatId, '✅ Anti-delete has been enabled for this group.');
    } else if (messageText.startsWith('.antidelete off')) {
        await disableAntiDelete(chatId);
        await sendMessage(sock, chatId, '❌ Anti-delete has been disabled for this group.');
    } else if (messageText.startsWith('.tagall')) {
        const message = messageText.replace('.tagall', '').trim();
        await adminCommands.tagAll(sock, chatId, message, sender);
    } else if (messageText.startsWith('.ping')) {
        await sendMessage(sock, chatId, '🏓 Pong!');
    } else if (messageText.startsWith('.menu')) {
        await commonCommands.sendHelpMenu(sock, chatId, true, true);
    } else if (messageText.startsWith('.joke')) {
        await commonCommands.sendJoke(sock, chatId);
    } else if (messageText.startsWith('.quote')) {
        await commonCommands.sendQuote(sock, chatId);
    } else if (messageText.startsWith('.weather')) {
        const args = messageText.split(' ').slice(1);
        await botCommands.handleWeatherCommand(sock, msg, args);
    } else if (messageText.startsWith('.translate')) {
        const args = messageText.split(' ').slice(1);
        await botCommands.handleTranslateCommand(sock, msg, args);
    } else if (messageText.startsWith('.rules')) {
        await commonCommands.sendGroupRules(sock, chatId);
    } else if (messageText.startsWith('.admin')) {
        await commonCommands.listAdmins(sock, chatId);
    } else if (messageText.startsWith('.info')) {
        await commonCommands.sendGroupInfo(sock, chatId, sock.user.id);
    } else if (messageText.startsWith('.clear')) {
        await adminCommands.clearChat(sock, chatId);
    } else if (messageText.startsWith('.ban')) {
        const args = messageText.split(' ').slice(1);
        await adminCommands.banUser(sock, chatId, args, sender);
    } else if (messageText.startsWith('.mute')) {
        await adminCommands.muteChat(sock, chatId);
    } else if (messageText.startsWith('.unmute')) {
        await adminCommands.unmuteChat(sock, chatId);
    } else if (messageText.startsWith('.announce')) {
        const message = messageText.replace('.announce', '').trim();
        await adminCommands.startAnnouncement(sock, chatId, message);
    } else if (messageText.startsWith('.stopannounce')) {
        await adminCommands.stopAnnouncement(sock, chatId);
    } else if (messageText.startsWith('.schedule')) {
        const args = messageText.split(' ').slice(1); // Split the command into arguments
        if (args.length < 2) {
            await sendMessage(sock, chatId, '⚠️ Please provide a valid date and message.');
            return;
        }

        await scheduleCommands.scheduleMessage(sock, chatId, args);
    } else if (messageText.startsWith('.remind')) {
        const args = messageText.split(' ').slice(1); // Split the command into arguments
        if (args.length < 2) {
            await sendMessage(sock, chatId, '⚠️ Please provide a valid time and reminder message.');
            return;
        }

        await scheduleCommands.remind(sock, chatId, args);
    }else if (messageText.startsWith('.listschedule')) {
        await scheduleCommands.listSchedule(sock, chatId);   
    } else if (messageText.startsWith('.cancelschedule')) {
        const args = messageText.split(' ').slice(1);
        await scheduleCommands.cancelSchedule(sock, chatId, args);
    } else if (messageText.startsWith('.cancelreminder')) {
        const args = messageText.split(' ').slice(1);
        await scheduleCommands.cancelReminder(sock, chatId, args);
    } else if (messageText.startsWith('.poll')) {
        const args = messageText.split(' ').slice(1);
        await pollCommands.createPoll(sock, chatId, args);
    } else if (messageText.startsWith('.vote')) {
        const args = messageText.split(' ').slice(1);
        await pollCommands.vote(sock, chatId, args);
    } else if (messageText.startsWith('.endpoll')) {
        await pollCommands.endPoll(sock, chatId);
    } else if (messageText.startsWith('.starttournament')) {
        const args = messageText.split(' ').slice(1);
        await startTournament(sock, chatId, args);
    } else if (messageText.startsWith('.start best attack')) {
        const communityName = messageText.split(' ')[3];
        await startTournament(sock, chatId, communityName, messageText);
    } else if (messageText.startsWith('.best attack')) {
        const communityName = messageText.split(' ')[2];
        await showTopScorers(sock, chatId, communityName);
    } else if (messageText === '.end best attack') {
        await endTournament(sock, chatId);
    } else if (messageText === '.extract') {
        await handleNewImage(sock, msg);
    } else if (messageText.startsWith('.goal')) {
        const [_, playerName, goals] = messageText.split(' ');
        await addGoal(sock, chatId, playerName.replace('@', ''), parseInt(goals));
    } else if (messageText.startsWith('.setgoal')) {
        const [_, playerName, goals] = messageText.split(' ');
        await setGoal(sock, chatId, playerName.replace('@', ''), parseInt(goals));
    } else if (messageText === '.top scorers') {
        await showLeaderboard(sock, chatId);
    } else if (messageText.startsWith('.add player')) {
        const [_, playerName, team, community] = messageText.split(' ');
        await addPlayer(sock, chatId, playerName, team, community);
    } else if (messageText.startsWith('.remove player')) {
        const [_, playerName, community] = messageText.split(' ');
        await removePlayer(sock, chatId, playerName, community);
    } else if (messageText.startsWith('.list players')) {
        const community = messageText.split(' ')[2];
        await listPlayers(sock, chatId, community);
    } else if (messageText.startsWith('.upload result')) {
        const imagePath = await downloadImage(msg);
        await uploadResult(sock, chatId, imagePath);
    } else if (messageText === '.auto check result') {
        await enableAutoCheckResult(sock, chatId);
    } else if (messageText === '.auto check result off') {
        await disableAutoCheckResult(sock, chatId);
    } else if (messageText.startsWith('.setgrouprules')) {
        const args = messageText.split(' ').slice(1);
        await adminCommands.setGroupRules(sock, chatId, args.join(' '));
    } else if (messageText.startsWith('.settournamentrules')) {
        const args = messageText.split(' ').slice(1);
        await adminCommands.setTournamentRules(sock, chatId, args.join(' '));
    } else if (messageText.startsWith('.setlanguage')) {
        const args = messageText.split(' ').slice(1);
        await adminCommands.setLanguage(sock, chatId, args.join(' '));
    } else if (messageText.startsWith('.showstats')) {
        await showGroupStats(sock, chatId);
    } else if (messageText.startsWith('.delete')) {
        await adminCommands.deleteMessage(sock, chatId, msg);
    } else if (messageText.startsWith('.enable')) {
        await adminCommands.enableBot(sock, chatId, sender);
    } else if (messageText.startsWith('.disable')) {
        await adminCommands.disableBot(sock, chatId, sender);
    } else if (messageText.startsWith('.startwelcome')) {
        await adminCommands.startWelcome(sock, chatId);
    } else if (messageText.startsWith('.stopwelcome')) {
        await adminCommands.stopWelcome(sock, chatId);
    } else if (messageText.startsWith('.promote')) {
        const userId = messageText.split(' ')[1];
        await adminCommands.promoteUser(sock, chatId, userId);
    } else if (messageText.startsWith('.demote')) {
        const userId = messageText.split(' ')[1];
        await adminCommands.demoteUser(sock, chatId, userId);
    } else if (messageText.startsWith('.warn')) {
        const args = messageText.split(' ').slice(1);
        if (args.length > 1) {
            const userId = args[0];
            const reason = args.slice(1).join(' ');
            await issueWarning(sock, chatId, userId, reason, config.warningThreshold);
        } else {
            await sendMessage(sock, chatId, '⚠️ Please provide a user ID and reason for the warning.');
        }
    } else if (messageText.startsWith('.listwarn')) {
        await listWarnings(sock, chatId);
    } else if (messageText.startsWith('.resetwarn')) {
        const args = messageText.split(' ').slice(1);
        if (args.length > 0) {
            const userId = args[0];
            await resetWarnings(sock, chatId, userId);
        } else {
            await sendMessage(sock, chatId, '⚠️ Please provide a user ID to reset warnings.');
        }
    } else if (messageText.startsWith('.fame')) {
        await showHallOfFame(sock, chatId);
    } else if (messageText.startsWith('.sharelink')) {
        const args = messageText.split(' ').slice(1);
        await botCommands.handleShareLinkCommand(sock, chatId, args);
    } else if (messageText.startsWith('.addwinner')) {
        const args = messageText.split(' ').slice(1);
        const [username, league, team] = args.join(' ').split(',');
        await addWinner(sock, chatId, sender, league.trim(), team.trim(), username.trim());
    } else if (messageText.startsWith('.startgoodbye')) {
        if (!await isAdminOrOwner(sock, chatId, sender)) {
            await sendMessage(sock, chatId, '❌ Only admins or the bot owner can enable goodbye messages.');
            return;
        }

        const { error } = await supabase
            .from('group_settings')
            .update({ goodbye_messages_enabled: true })
            .eq('group_id', chatId);

        if (error) {
            console.error('Error enabling goodbye messages:', error);
            await sendMessage(sock, chatId, '⚠️ Error enabling goodbye messages. Please try again later.');
        } else {
            await sendMessage(sock, chatId, '✅ Goodbye messages have been enabled for this group.');
        }
    } else if (messageText.startsWith('.stopgoodbye')) {
        if (!await isAdminOrOwner(sock, chatId, sender)) {
            await sendMessage(sock, chatId, '❌ Only admins or the bot owner can disable goodbye messages.');
            return;
        }

        const { error } = await supabase
            .from('group_settings')
            .update({ goodbye_messages_enabled: false })
            .eq('group_id', chatId);

        if (error) {
            console.error('Error disabling goodbye messages:', error);
            await sendMessage(sock, chatId, '⚠️ Error disabling goodbye messages. Please try again later.');
        } else {
            await sendMessage(sock, chatId, '❌ Goodbye messages have been disabled for this group.');
        }
    }
};

const handleIncomingMessages = async (sock, m) => {
    let chatId;
    try {
        const message = m.messages[0];
        if (!message.message) return;

        const msgText = message.message.conversation || message.message.extendedTextMessage?.text || message.message.imageMessage?.caption || message.message.videoMessage?.caption || '';
        chatId = message.key.remoteJid;
        const sender = message.key.participant || message.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        const isChannel = chatId.endsWith('@broadcast');
        const isPrivateChat = !isGroup && !isChannel;
        const isBackupNumber = sender === config.backupNumber;

        console.log(`Received message: ${msgText} from ${sender} in ${chatId}`);

        // Fetch group/channel settings from Supabase
        let groupSettings = null;
        if (isGroup || isChannel) {
            const { data, error } = await supabase
                .from('group_settings')
                .select('bot_enabled')
                .eq('group_id', chatId)
                .single();
            groupSettings = data;
            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching group settings:', error);
            }
        }

        // Check if the bot is enabled in the group/channel
        if ((isGroup || isChannel) && (!groupSettings || !groupSettings.bot_enabled)) {
            if (msgText.trim().startsWith(config.botSettings.commandPrefix)) {
                const args = msgText.trim().split(/ +/);
                const command = args.shift().slice(config.botSettings.commandPrefix.length).toLowerCase();
                if (command === 'enable' && sender === config.botOwnerId) {
                    await adminCommands.enableBot(sock, chatId, sender);
                } else if (command === 'disable' && sender === config.botOwnerId) {
                    await adminCommands.disableBot(sock, chatId, sender);
                } else {
                    console.log('Bot is disabled, cannot send message.');
                    await sendMessage(sock, chatId, 'Oops! 🤖 The bot is currently disabled in this group/channel. Don\'t worry, the bot owner can enable it soon! 😊 Please try again later! 🙏');
                }
            }
            console.log('🛑 Bot is disabled in this group/channel.');
            return;
        }

        if (isPrivateChat) {
            console.log('📩 Processing private chat message');
        } else if (isGroup || isChannel) {
            console.log('📩 Processing group/channel message');
        }

        if (!msgText.trim().startsWith(config.botSettings.commandPrefix)) {
            console.log('🛑 Ignoring non-command message');
            await handleProtectionMessages(sock, message);
            return;
        }

        const args = msgText.trim().split(/ +/);
        const command = args.shift().slice(config.botSettings.commandPrefix.length).toLowerCase();
        console.log(`🛠 Extracted Command: ${command}`);

        // React to the command
        await sendReaction(sock, chatId, message.key.id, command);

        // Handle the command
        await handleCommand(sock, message);

        // Update user statistics for commands
        updateUserStats(sender, command);
    } catch (error) {
        console.error("❌ Error in command processing:", error);

        // Handle session errors
        if (error.message.includes('Bad MAC') || error.message.includes('No matching sessions found for message')) {
            console.error('Session error:', error);
            await sendMessage(sock, chatId, '⚠️ *Session error occurred. Please try again later.*');
        } else if (error.message.includes('Timed Out')) {
            console.error('Error fetching group metadata:', error);
            await sendMessage(sock, chatId, '⚠️ *Request timed out. Please try again later.*');
        } else {
            await sendMessage(sock, chatId, '⚠️ *An unexpected error occurred. Please try again later.*');
        }
    }
};

const callCommand = async (sock, chatId, command) => {
    try {
        const { data, error } = await supabase
            .from('commands')
            .select('response')
            .eq('command_name', command)
            .single();

        if (error || !data) {
            await sendMessage(sock, chatId, '❌ Command not found.');
            return;
        }

        await sendMessage(sock, chatId, data.response);
    } catch (error) {
        console.error('Error executing custom command:', error);
        await sendMessage(sock, chatId, '⚠️ Error executing command.');
    }
};

// Handle new participants joining the group
const handleNewParticipants = async (sock, chatId, participants) => {
    try {
        for (const participant of participants) {
            const welcomeMessage = `👋 Welcome @${participant.split('@')[0]} to the group! Please read the group rules.`;
            await sendMessage(sock, chatId, welcomeMessage, [participant]);
            console.log(`👋 Sent welcome message to ${participant}`);
        }
    } catch (error) {
        console.error('Error sending welcome message:', error);
    }
};

// Removed duplicate checkIfAdmin function

const checkIfAdmin = async (sock, chatId, userId, retries = 3, delay = 2000) => {
    for (let i = 0; i < retries; i++) {
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            return groupMetadata.participants.some(p => p.id === userId && (p.admin === 'admin' || p.admin === 'superadmin'));
        } catch (error) {
            if (i === retries - 1) {
                console.error('Error checking admin status:', error);
                return false;
            }
            console.log(`Retrying checkIfAdmin (${i + 1}/${retries})...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

const handleGroupParticipantsUpdate = async (sock, update) => {
    try {
        console.log('👥 Group participants update:', update);
        const chat = await sock.groupMetadata(update.id);
        const contact = update.participants[0];
        const user = contact.split('@')[0];
        const { data: groupSettings, error } = await supabase
            .from('group_settings')
            .select('welcome_messages_enabled, goodbye_messages_enabled')
            .eq('group_id', update.id)
            .single();

        if (error) {
            console.error('Error fetching group settings:', error);
            return;
        }

        if (update.action === 'add' && groupSettings && groupSettings.welcome_messages_enabled) {
            await sock.sendMessage(chat.id, { text: formatResponseWithHeaderFooter(welcomeMessage(chat.subject, user)) });
            console.log(`👋 Sent welcome message to ${user}`);
        }

        if ((update.action === 'remove' || update.action === 'leave') && groupSettings && groupSettings.goodbye_messages_enabled) {
            let goodbyeMessage;
            if (update.action === 'remove') {
                // Select a random removed message
                const randomIndex = Math.floor(Math.random() * removedMessages.length);
                goodbyeMessage = removedMessages[randomIndex].replace('${participant}', user);
            } else if (update.action === 'leave') {
                // Select a random left message
                const randomIndex = Math.floor(Math.random() * leftMessages.length);
                goodbyeMessage = leftMessages[randomIndex].replace('${participant}', user);
            }

            // Send the goodbye message
            await sock.sendMessage(chat.id, {
                text: goodbyeMessage,
                mentions: [contact]
            });
            console.log(`👋 Sent goodbye message to ${contact}`);
        }
    } catch (error) {
        console.error('Error handling group participants update:', error);
    }
};

// Debugging with Baileys events
const setupDebugging = (sock) => {
    sock.ev.on('messages.upsert', async (chat) => {
        for (const msg of chat.messages) {
            if (!msg.key.fromMe) {  // Ignore bot's own messages
                await handleAntiDelete(sock, msg, sock.user.id);
            }
        }
    });
    sock.ev.on('messages.update', async (m) => {
        for (const message of m) {
            if (message.update.messageStubType === 68) { // Check if the update is a message deletion
                await handleAntiDelete(sock, message.update, sock.user.id);
            }
        }
    });
    sock.ev.on('connection.update', (update) => {
        console.log("Connection update:", JSON.stringify(update, null, 2));
    });
};

async function getCommunityName(sock, chatId) {
    try {
        const groupMetadata = await sock.groupMetadata(chatId);
        return groupMetadata.subject;
    } catch (error) {
        console.error('Error fetching community name:', error);
        return 'Unknown Community';
    }
}


const handlePollCommand = async (sock, msg) => {
    const chatId = msg.key.remoteJid;
    
    // Log the entire message structure for debugging
    console.log("📩 Received message:", JSON.stringify(msg, null, 2));

    // Extract sender correctly
    const senderJid = msg.key.participant || msg.key.remoteJid;
    const sender = senderJid.includes(":") ? senderJid.split(":")[0] : senderJid.split("@")[0];

    console.log("📩 Extracted Poll Creator:", sender);

    if (!sender || sender.trim() === "") {
        console.error("❌ Poll creator extraction failed.");
        await sock.sendMessage(chatId, { text: '⚠️ Error: Poll creator information is missing.' });
        return;
    }

    // Extract command and message body
    let messageText = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    let lines = messageText.split("\n"); // Split by new lines

    if (lines.length < 3) {
        await sock.sendMessage(chatId, { text: "⚠️ Usage: `.poll <question>` (on first line)\n<option1>\n<option2>\n[More options if needed]" });
        return;
    }

    // Extract poll question and options
    const question = lines[0].replace('.poll ', '').trim(); // First line (removing `.poll`)
    const options = lines.slice(1).map(opt => opt.trim()); // Remaining lines as options

    // Call createPoll function
    await pollCommands.createPoll(sock, chatId, question, options, sender);
};

console.log("✅ handleCommand is defined as:", typeof handleCommand);


console.log("✅ Exporting handleCommand...");

module.exports = {
    handleCommand: handleCommand,
    handleIncomingMessages: handleIncomingMessages,
    handleNewParticipants: handleNewParticipants,
    checkIfAdmin: checkIfAdmin,
    handleGroupParticipantsUpdate: handleGroupParticipantsUpdate,
    setupDebugging: setupDebugging,
    addWinner: addWinner,
    showHallOfFame: showHallOfFame,
    handlePollCommand: handlePollCommand
};

console.log("✅ messageHandler.js is fully exported:", module.exports);

