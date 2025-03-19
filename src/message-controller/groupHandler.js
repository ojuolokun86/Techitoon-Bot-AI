const { formatResponseWithHeaderFooter, welcomeMessage } = require('../utils/utils');
const supabase = require('../supabaseClient');
const { removedMessages, leftMessages } = require('../utils/goodbyeMessages');

const handleGroupParticipantsUpdate = async (sock, update) => {
    try {
        console.log('👥 Group participants update:', update);
        const chat = await sock.groupMetadata(update.id);
        const contact = update.participants[0];
        const user = contact.split('@')[0];

        // Fetch group settings from Supabase
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
            await sock.sendMessage(chat.id, { text: formatResponseWithHeaderFooter(welcomeMessage(chat.subject, user)) });
            console.log(`👋 Sent welcome message to ${user}`);
        }

        // Handle goodbye messages
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

const handleBotEnable = async (sock, chatId) => {
    try {
        const { data, error } = await supabase
            .from('group_settings')
            .select('bot_enabled')
            .eq('group_id', chatId)
            .single();

        if (error) {
            console.error('Error fetching group settings:', error);
            return;
        }

        if (!data || !data.bot_enabled) {
            // Enable the bot and set goodbye messages to disabled by default
            const { error: updateError } = await supabase
                .from('group_settings')
                .upsert({
                    group_id: chatId,
                    bot_enabled: true,
                    goodbye_messages_enabled: false // Default to disabled
                });

            if (updateError) {
                console.error('Error enabling bot:', updateError);
                await sock.sendMessage(chatId, { text: '⚠️ Error enabling the bot. Please try again later.' });
            } else {
                await sock.sendMessage(chatId, { text: '✅ Bot has been enabled for this group. Goodbye messages are disabled by default.' });
            }
        } else {
            await sock.sendMessage(chatId, { text: '⚠️ Bot is already enabled for this group.' });
        }
    } catch (error) {
        console.error('Error in handleBotEnable:', error);
        await sock.sendMessage(chatId, { text: '⚠️ Error enabling the bot. Please try again later.' });
    }
};

module.exports = { handleGroupParticipantsUpdate, handleBotEnable };