const supabase = require('../supabaseClient');
const { formatResponseWithHeaderFooter } = require('../utils/utils');

async function scheduleMessage(sock, chatId, args) {
    try {
        const message = args.slice(1).join(' ');
        const scheduledTime = new Date(args[0]); // Assuming the first argument is the scheduled time

        const { data, error } = await supabase
            .from('scheduled_messages')
            .insert([{ chat_id: chatId, message, scheduled_time: scheduledTime }]);

        if (error) {
            console.error('Error scheduling message:', error);
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error scheduling message.') });
        } else {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('✅ Message scheduled successfully.') });
        }
    } catch (error) {
        console.error('Error in scheduleMessage:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error scheduling message.') });
    }
}

const remind = async (sock, chatId, args) => {
    try {
        const reminderTime = new Date(args[0]); // Assuming the first argument is the time
        const message = args.slice(1).join(' ');

        const { data, error } = await supabase
            .from('scheduled_messages')
            .insert({ group_id: chatId, message, scheduled_time: reminderTime });

        if (error) {
            console.error('Error setting reminder:', error);
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error setting reminder.') });
        } else {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('✅ Reminder set successfully.') });
        }
    } catch (error) {
        console.error('Error in remind:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error setting reminder.') });
    }
};

const cancelSchedule = async (sock, chatId, args) => {
    try {
        const messageId = args[0]; // Assuming the first argument is the message ID

        const { error } = await supabase
            .from('scheduled_messages')
            .delete()
            .eq('id', messageId);

        if (error) {
            console.error('Error canceling schedule:', error);
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error canceling schedule.') });
        } else {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('✅ Schedule canceled successfully.') });
        }
    } catch (error) {
        console.error('Error in cancelSchedule:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error canceling schedule.') });
    }
};

const cancelReminder = async (sock, chatId) => {
    try {
        const { error } = await supabase
            .from('scheduled_messages')
            .delete()
            .eq('group_id', chatId);

        if (error) {
            console.error('Error canceling reminder:', error);
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error canceling reminder.') });
        } else {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('✅ Reminder canceled successfully.') });
        }
    } catch (error) {
        console.error('Error in cancelReminder:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error canceling reminder.') });
    }
};

// Example implementation of scheduleAnnouncement
async function scheduleAnnouncement(sock, chatId, message) {
    // Your scheduling logic here
    await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`📅 Scheduled announcement: ${message}`) });
}

module.exports = { scheduleMessage, remind, cancelSchedule, cancelReminder, scheduleAnnouncement };