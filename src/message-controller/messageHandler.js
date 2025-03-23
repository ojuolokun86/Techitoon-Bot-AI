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
const { handleProtectionMessages, handleAntiDelete, enableAntiDelete, disableAntiDelete, handleProtectionCommands } = require('../message-controller/protection');
const { exec } = require("child_process");
const { removedMessages, leftMessages } = require('../utils/goodbyeMessages');
const { formatResponseWithHeaderFooter, welcomeMessage, setWelcomeMessage } = require('../utils/utils');
const { startBot } = require('../bot/bot');
const { handleNewImage, startTournament, showTopScorers, showLeaderboard, addGoal, setGoal, endTournament, addPlayer, removePlayer, listPlayers, uploadResult, enableAutoCheckResult, disableAutoCheckResult } = require('./tournamentHandler');
const { showHallOfFame, addWinner } = require('./hallOfFame');
const { getPrefix, setPrefix } = require('../utils/configUtils');
const { showAllGroupStats } = require('./commonCommands');
const { undeployBot } = require('../commands/undeployCommand'); // Import the undeploy command


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


    // Get the current prefix
    const currentPrefix = await getPrefix();

    // Ensure the message starts with the prefix
    if (!messageText.startsWith(currentPrefix)) return;

    // Handle change prefix command
    if (messageText.startsWith(`${currentPrefix}prefix`)) {
        if (sender - config.botOwnerId) {
            await sendMessage(sock, chatId, '❌ Only the bot owner can change the command prefix.');
            return
        }

        const args = messageText.split(' ');
        if (args.length < 2) {
            await sendMessage(sock, chatId, '⚠️ Please provide a new prefix.');
            return;
        }

        const newPrefix = args[1].trim();
        if (!newPrefix) {
            await sendMessage(sock, chatId, '⚠️ Invalid prefix.');
            return;
        }

        // Store the new prefix in the database
        const success = await setPrefix(newPrefix);
        if (success) {
            await sendMessage(sock, chatId, `✅ Command prefix changed to: ${newPrefix}`);
        } else {
            await sendMessage(sock, chatId, '⚠️ Error changing command prefix.');
        }
        return;
    }

    if (messageText.startsWith(currentPrefix)) {
        if (messageText.startsWith(`${currentPrefix}showstats`)) {
            await showAllGroupStats(sock, chatId);
        }
    }  


    // Handle the undeploy command
if (messageText === `${currentPrefix}undeploy` || messageText === `${currentPrefix}confirm`) {
    await undeployBot(sock, chatId, sender, messageText);
}
     
     
    
    // Handle set welcome message command
    if (messageText.startsWith(`${currentPrefix}setwelcome`)) {
        const args = messageText.split(' ').slice(1);
        const newWelcomeMessage = args.join(' ');

        if (!newWelcomeMessage) {
            await sendMessage(sock, chatId, '⚠️ Please provide a new welcome message.');
            return;
        }

        const success = await setWelcomeMessage(chatId, newWelcomeMessage);
        if (success) {
            await sendMessage(sock, chatId, '✅ Welcome message updated successfully.');
        } else {
            await sendMessage(sock, chatId, '⚠️ Error updating welcome message.');
        }
        return;
    }


     // Extract the command and arguments
     const args = messageText.slice(currentPrefix.length).trim().split(/ +/);
     const command = args.shift()?.toLowerCase();
 

   // Handle `antilink on/off` and `antisales on/off` commands
   if (command === 'antilink' || command === 'antisales') {
    const subCommand = args.shift()?.toLowerCase();

    // Handle `on` and `off` commands
    if (subCommand === 'on') {
        const { error } = await supabase
            .from('group_settings')
            .update({ [`${command}_enabled`]: true })
            .eq('group_id', chatId);

        if (error) {
            console.error(`Error enabling ${command}:`, error);
            await sendMessage(sock, chatId, `⚠️ Error enabling ${command}. Please try again later.`);
        } else {
            await sendMessage(sock, chatId, `✅ ${command.charAt(0).toUpperCase() + command.slice(1)} has been enabled for this group.`);
        }
        return;
    } else if (subCommand === 'off') {
        const { error } = await supabase
            .from('group_settings')
            .update({ [`${command}_enabled`]: false })
            .eq('group_id', chatId);

        if (error) {
            console.error(`Error disabling ${command}:`, error);
            await sendMessage(sock, chatId, `⚠️ Error disabling ${command}. Please try again later.`);
        } else {
            await sendMessage(sock, chatId, `❌ ${command.charAt(0).toUpperCase() + command.slice(1)} has been disabled for this group.`);
        }
        return;
    }

    // Handle subcommands: `permit`, `nopermit`, `permitnot`
    if (subCommand === 'permit') {
        const targetUser = args[0]?.replace('@', '').replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        if (!targetUser) {
            await sendMessage(sock, chatId, '⚠️ Please mention a user to permit.');
            return;
        }

        const { error } = await supabase
            .from(`${command}_permissions`)
            .insert([{ group_id: chatId, user_id: targetUser }]);

        if (error) {
            console.error(`Error permitting user for ${command}:`, error);
            await sendMessage(sock, chatId, `⚠️ Failed to permit user for ${command}.`);
        } else {
            await sendMessage(sock, chatId, `✅ User @${targetUser.split('@')[0]} is now permitted to bypass ${command}.`, [targetUser]);
        }
    } else if (subCommand === 'nopermit') {
        const targetUser = args[0]?.replace('@', '').replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        if (!targetUser) {
            await sendMessage(sock, chatId, '⚠️ Please mention a user to revoke permission.');
            return;
        }

        const { error } = await supabase
            .from(`${command}_permissions`)
            .delete()
            .eq('group_id', chatId)
            .eq('user_id', targetUser);

        if (error) {
            console.error(`Error revoking permission for user in ${command}:`, error);
            await sendMessage(sock, chatId, `⚠️ Failed to revoke permission for user in ${command}.`);
        } else {
            await sendMessage(sock, chatId, `❌ User @${targetUser.split('@')[0]} is no longer permitted to bypass ${command}.`, [targetUser]);
        }
    } else if (subCommand === 'permitnot') {
        const { error } = await supabase
            .from(`${command}_permissions`)
            .delete()
            .eq('group_id', chatId);

        if (error) {
            console.error(`Error clearing permissions for ${command}:`, error);
            await sendMessage(sock, chatId, `⚠️ Failed to clear permissions for ${command}.`);
        } else {
            await sendMessage(sock, chatId, `✅ All permissions for ${command} have been cleared.`);
        }
    } else {
        await sendMessage(sock, chatId, '⚠️ Invalid subcommand. Use `on`, `off`, `permit`, `nopermit`, or `permitnot`.');
    }
    return;
}
    // Handle `antilink on/off` and `antisales on/off`
    if (messageText.startsWith(`${currentPrefix}antilink on`)) {
        const { error } = await supabase
            .from('group_settings')
            .update({ antilink_enabled: true })
            .eq('group_id', chatId);

        if (error) {
            console.error('Error enabling anti-link:', error);
            await sendMessage(sock, chatId, '⚠️ Error enabling anti-link. Please try again later.');
        } else {
            await sendMessage(sock, chatId, '✅ Anti-link has been enabled for this group.');
        }
    } else if (messageText.startsWith(`${currentPrefix}antilink off`)) {
        const { error } = await supabase
            .from('group_settings')
            .update({ antilink_enabled: false })
            .eq('group_id', chatId);

        if (error) {
            console.error('Error disabling anti-link:', error);
            await sendMessage(sock, chatId, '⚠️ Error disabling anti-link. Please try again later.');
        } else {
            await sendMessage(sock, chatId, '❌ Anti-link has been disabled for this group.');
        }
    } else if (messageText.startsWith(`${currentPrefix}antisales on`)) {
        const { error } = await supabase
            .from('group_settings')
            .update({ antisales_enabled: true })
            .eq('group_id', chatId);

        if (error) {
            console.error('Error enabling anti-sales:', error);
            await sendMessage(sock, chatId, '⚠️ Error enabling anti-sales. Please try again later.');
        } else {
            await sendMessage(sock, chatId, '✅ Anti-sales has been enabled for this group.');
        }
    } else if (messageText.startsWith(`${currentPrefix}antisales off`)) {
        const { error } = await supabase
            .from('group_settings')
            .update({ antisales_enabled: false })
            .eq('group_id', chatId);

        if (error) {
            console.error('Error disabling anti-sales:', error);
            await sendMessage(sock, chatId, '⚠️ Error disabling anti-sales. Please try again later.');
        } else {
            await sendMessage(sock, chatId, '❌ Anti-sales has been disabled for this group.');
        }
    
   
        } else if (messageText.startsWith(`${currentPrefix}tagall`)) {
            const repliedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation || '';
            const message = messageText.replace(`${currentPrefix}tagall`, '').trim();
            await adminCommands.tagAll(sock, chatId, message, sender, repliedMessage);
        } else if (messageText.startsWith(`${currentPrefix}help`)) {
            await handleHelpCommand(sock, chatId, sender);
        } else if (messageText.startsWith(`${currentPrefix}warn`)) {
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
        } else if (messageText.startsWith(`${currentPrefix}resetwarn`)) {
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
        } else if (messageText.startsWith(`${currentPrefix}promote`)) {
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
        } else if (messageText.startsWith(`${currentPrefix}antidelete on`)) {
            await enableAntiDelete(chatId);
            await sendMessage(sock, chatId, '✅ Anti-delete has been enabled for this group.');
        } else if (messageText.startsWith(`${currentPrefix}antidelete off`)) {
            await disableAntiDelete(chatId);
            await sendMessage(sock, chatId, '❌ Anti-delete has been disabled for this group.');
        } else if (messageText.startsWith(`${currentPrefix}tagall`)) {
            const message = messageText.replace(`${currentPrefix}tagall`, '').trim();
            await adminCommands.tagAll(sock, chatId, message, sender);
        } else if (messageText.startsWith(`${currentPrefix}ping`)) {
            await sendMessage(sock, chatId, '🏓 Pong!');
        } else if (messageText.startsWith(`${currentPrefix}menu`)) {
            await commonCommands.sendHelpMenu(sock, chatId, true, true);
        } else if (messageText.startsWith(`${currentPrefix}joke`)) {
            await commonCommands.sendJoke(sock, chatId);
        } else if (messageText.startsWith(`${currentPrefix}quote`)) {
            await commonCommands.sendQuote(sock, chatId);
        } else if (messageText.startsWith(`${currentPrefix}weather`)) {
            const args = messageText.split(' ').slice(1);
            await botCommands.handleWeatherCommand(sock, msg, args);
        } else if (messageText.startsWith(`${currentPrefix}translate`)) {
            const args = messageText.split(' ').slice(1);
            await botCommands.handleTranslateCommand(sock, msg, args);
        } else if (messageText.startsWith(`${currentPrefix}rules`)) {
            await commonCommands.sendGroupRules(sock, chatId);
        } else if (messageText.startsWith(`${currentPrefix}admin`)) {
            await commonCommands.listAdmins(sock, chatId);
        } else if (messageText.startsWith(`${currentPrefix}info`)) {
            await commonCommands.sendGroupInfo(sock, chatId, sock.user.id);
        } else if (messageText.startsWith(`${currentPrefix}clear`)) {
            await adminCommands.clearChat(sock, chatId);
        } else if (messageText.startsWith(`${currentPrefix}ban`)) {
            const args = messageText.split(' ').slice(1);
            await adminCommands.banUser(sock, chatId, args, sender);
        } else if (messageText.startsWith(`${currentPrefix}mute`)) {
            await adminCommands.muteChat(sock, chatId);
        } else if (messageText.startsWith(`${currentPrefix}unmute`)) {
            await adminCommands.unmuteChat(sock, chatId);
        } else if (messageText.startsWith(`${currentPrefix}announce`)) {
            const message = messageText.replace(`${currentPrefix}announce`, '').trim();
            await adminCommands.startAnnouncement(sock, chatId, message);
        } else if (messageText.startsWith(`${currentPrefix}stopannounce`)) {
            await adminCommands.stopAnnouncement(sock, chatId);
        } else if (messageText.startsWith(`${currentPrefix}schedule`)) {
            const args = messageText.split(' ').slice(1); // Split the command into arguments
            if (args.length < 2) {
                await sendMessage(sock, chatId, '⚠️ Please provide a valid date and message.');
                return;
            }

            await scheduleCommands.scheduleMessage(sock, chatId, args);
        } else if (messageText.startsWith(`${currentPrefix}remind`)) {
            const args = messageText.split(' ').slice(1); // Split the command into arguments
            if (args.length < 2) {
                await sendMessage(sock, chatId, '⚠️ Please provide a valid time and reminder message.');
                return;
            }

            await scheduleCommands.remind(sock, chatId, args);
        } else if (messageText.startsWith(`${currentPrefix}listschedule`)) {
            await scheduleCommands.listSchedule(sock, chatId);   
        } else if (messageText.startsWith(`${currentPrefix}cancelschedule`)) {
            const args = messageText.split(' ').slice(1);
            await scheduleCommands.cancelSchedule(sock, chatId, args);
        } else if (messageText.startsWith(`${currentPrefix}cancelreminder`)) {
            const args = messageText.split(' ').slice(1);
            await scheduleCommands.cancelReminder(sock, chatId, args);
        } else if (messageText.startsWith(`${currentPrefix}poll`)) {
            const args = messageText.split(' ').slice(1);
            await pollCommands.createPoll(sock, chatId, args);
        } else if (messageText.startsWith(`${currentPrefix}vote`)) {
            const args = messageText.split(' ').slice(1);
            await pollCommands.vote(sock, chatId, args);
        } else if (messageText.startsWith(`${currentPrefix}endpoll`)) {
            await pollCommands.endPoll(sock, chatId);
        } else if (messageText.startsWith(`${currentPrefix}starttournament`)) {
            const args = messageText.split(' ').slice(1);
            await startTournament(sock, chatId, args);
        } else if (messageText.startsWith(`${currentPrefix}start best attack`)) {
            const communityName = messageText.split(' ')[3];
            await startTournament(sock, chatId, communityName, messageText);
        } else if (messageText.startsWith(`${currentPrefix}best attack`)) {
            const communityName = messageText.split(' ')[2];
            await showTopScorers(sock, chatId, communityName);
        } else if (messageText === `${currentPrefix}end best attack`) {
            await endTournament(sock, chatId);
        } else if (messageText === `${currentPrefix}extract`) {
            await handleNewImage(sock, msg);
        } else if (messageText.startsWith(`${currentPrefix}goal`)) {
            const [_, playerName, goals] = messageText.split(' ');
            await addGoal(sock, chatId, playerName.replace('@', ''), parseInt(goals));
        } else if (messageText.startsWith(`${currentPrefix}setgoal`)) {
            const [_, playerName, goals] = messageText.split(' ');
            await setGoal(sock, chatId, playerName.replace('@', ''), parseInt(goals));
        } else if (messageText === `${currentPrefix}top scorers`) {
            await showLeaderboard(sock, chatId);
        } else if (messageText.startsWith(`${currentPrefix}add player`)) {
            const [_, playerName, team, community] = messageText.split(' ');
            await addPlayer(sock, chatId, playerName, team, community);
        } else if (messageText.startsWith(`${currentPrefix}remove player`)) {
            const [_, playerName, community] = messageText.split(' ');
            await removePlayer(sock, chatId, playerName, community);
        } else if (messageText.startsWith(`${currentPrefix}list players`)) {
            const community = messageText.split(' ')[2];
            await listPlayers(sock, chatId, community);
        } else if (messageText.startsWith(`${currentPrefix}upload result`)) {
            const imagePath = await downloadImage(msg);
            await uploadResult(sock, chatId, imagePath);
        } else if (messageText === `${currentPrefix}auto check result`) {
            await enableAutoCheckResult(sock, chatId);
        } else if (messageText === `${currentPrefix}auto check result off`) {
            await disableAutoCheckResult(sock, chatId);
        } else if (messageText.startsWith(`${currentPrefix}setgrouprules`)) {
            const args = messageText.split(' ').slice(1);
            await adminCommands.setGroupRules(sock, chatId, args.join(' '));
        } else if (messageText.startsWith(`${currentPrefix}settournamentrules`)) {
            const args = messageText.split(' ').slice(1);
            await adminCommands.setTournamentRules(sock, chatId, args.join(' '));
        } else if (messageText.startsWith(`${currentPrefix}setlanguage`)) {
            const args = messageText.split(' ').slice(1);
            await adminCommands.setLanguage(sock, chatId, args.join(' '));
        } else if (messageText.startsWith(`${currentPrefix}delete`)) {
            await adminCommands.deleteMessage(sock, chatId, msg);
        } else if (messageText.startsWith(`${currentPrefix}enable`)) {
            await adminCommands.enableBot(sock, chatId, sender);
        } else if (messageText.startsWith(`${currentPrefix}disable`)) {
            await adminCommands.disableBot(sock, chatId, sender);
        } else if (messageText.startsWith(`${currentPrefix}startwelcome`)) {
            await adminCommands.startWelcome(sock, chatId);
        } else if (messageText.startsWith(`${currentPrefix}stopwelcome`)) {
            await adminCommands.stopWelcome(sock, chatId);
        } else if (messageText.startsWith(`${currentPrefix}promote`)) {
            const userId = messageText.split(' ')[1];
            await adminCommands.promoteUser(sock, chatId, userId);
        } else if (messageText.startsWith(`${currentPrefix}demote`)) {
            const userId = messageText.split(' ')[1];
            await adminCommands.demoteUser(sock, chatId, userId);
        } else if (messageText.startsWith(`${currentPrefix}warn`)) {
            const args = messageText.split(' ').slice(1);
            if (args.length > 1) {
                const userId = args[0];
                const reason = args.slice(1).join(' ');
                await issueWarning(sock, chatId, userId, reason, config.warningThreshold);
            } else {
                await sendMessage(sock, chatId, '⚠️ Please provide a user ID and reason for the warning.');
            }
        } else if (messageText.startsWith(`${currentPrefix}listwarn`)) {
            await listWarnings(sock, chatId);
        } else if (messageText.startsWith(`${currentPrefix}resetwarn`)) {
            const args = messageText.split(' ').slice(1);
            if (args.length > 0) {
                const userId = args[0];
                await resetWarnings(sock, chatId, userId);
            } else {
                await sendMessage(sock, chatId, '⚠️ Please provide a user ID to reset warnings.');
            }
        } else if (messageText.startsWith(`${currentPrefix}fame`)) {
            await showHallOfFame(sock, chatId);
        } else if (messageText.startsWith(`${currentPrefix}sharelink`)) {
            const args = messageText.split(' ').slice(1);
            await botCommands.handleShareLinkCommand(sock, chatId, args);
        } else if (messageText.startsWith(`${currentPrefix}addwinner`)) {
            const args = messageText.split(' ').slice(1);
            const [username, league, team] = args.join(' ').split(',');
            await addWinner(sock, chatId, sender, league.trim(), team.trim(), username.trim());
        } else if (messageText.startsWith(`${currentPrefix}startgoodbye`)) {
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
        } else if (messageText.startsWith(`${currentPrefix}stopgoodbye`)) {
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
    }


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

        if ((isGroup || isChannel) && (!groupSettings || !groupSettings.bot_enabled)) {
            const currentPrefix = await getPrefix(); // Fetch the current prefix dynamically
        
            if (msgText.trim().startsWith(currentPrefix)) {
                const args = msgText.trim().split(/ +/);
                const command = args.shift().slice(currentPrefix.length).toLowerCase();
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
        // Handle protection messages
        await handleProtectionMessages(sock, message);

        if (!msgText.trim().startsWith(config.botSettings.commandPrefix)) {
            console.log('🛑 Ignoring non-command message');
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
}

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
            const groupMetadata = await sock.groupMetadata(chatId);
            const groupName = groupMetadata.subject;

            // Debugging logs
            console.log('🔍 Full sock object in handleNewParticipants:', sock);
            console.log('🔍 Type of sock:', typeof sock);
            console.log('🔍 Type of sock.sendMessage:', typeof sock.sendMessage);

            // Pass the correct sock object
            if (typeof sock.sendMessage === 'function') {
                await welcomeMessage(sock, groupName, participant, chatId);
            } else {
                console.error('Invalid sock object. sock.sendMessage is not a function.');
            }
        }
    } catch (error) {
        console.error('Error handling new participants:', error);
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
        console.log('🔍 Full sock object in handleGroupParticipantsUpdate:', sock);
        console.log('🔍 Type of sock:', typeof sock);
        console.log('🔍 Type of sock.sendMessage:', typeof sock.sendMessage);

        const chat = await sock.groupMetadata(update.id);
        const contact = update.participants[0];
        const user = contact.split('@')[0];


        // Fetch group settings
        const { data: groupSettings, error } = await supabase
            .from('group_settings')
            .select('welcome_messages_enabled, goodbye_messages_enabled')
            .eq('group_id', update.id)
            .single();

        if (error) {
            console.error('Error fetching group settings:', error);
            return;
        }

          // Handle welcome messages
          if (update.action === 'add' && groupSettings && groupSettings.welcome_messages_enabled) {
            console.log('➡️ Adding participant:', user);
            console.log('🔍 Calling welcomeMessage with sock:', sock);
            await welcomeMessage(sock, chat.subject, contact, update.id);
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

