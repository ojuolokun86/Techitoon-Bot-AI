const supabase = require('../supabaseClient');
const { formatResponseWithHeaderFooter } = require('../utils/utils');

// Schedule a one-time message
async function scheduleMessage(sock, chatId, args) {
    try {
        if (!Array.isArray(args) || args.length < 2) {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Please provide a valid date and message.') });
            return;
        }

        const scheduledTime = new Date(args[0]);
        if (isNaN(scheduledTime.getTime())) {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Invalid date format. Please provide a valid date.') });
            return;
        }

        const message = args.slice(1).join(' ');

        const { data, error } = await supabase
            .from('scheduled_messages')
            .insert([{ chat_id: chatId, message, scheduled_time: scheduledTime }]);

        if (error) {
            console.error('Error scheduling message:', error);
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error scheduling message. Please try again later.') });
        } else {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('✅ Message scheduled successfully.') });
        }
    } catch (error) {
        console.error('Error in scheduleMessage:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error scheduling message.') });
    }
}

// Set a recurring reminder
const remind = async (sock, chatId, args) => {
    try {
        if (!Array.isArray(args) || args.length < 2) {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Please provide a valid time and reminder message.') });
            return;
        }

        const timeParts = args[0].split(':');
        if (timeParts.length !== 2 || isNaN(timeParts[0]) || isNaN(timeParts[1])) {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Invalid time format. Please provide a valid time (e.g., 11:30).') });
            return;
        }

        const hours = parseInt(timeParts[0], 10);
        const minutes = parseInt(timeParts[1], 10);

        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Invalid time. Hours must be between 0-23 and minutes between 0-59.') });
            return;
        }

        const message = args.slice(1).join(' ').replace(/\\n/g, '\n');

        const now = new Date();
        const reminderTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
        if (reminderTime <= now) {
            reminderTime.setDate(reminderTime.getDate() + 1);
        }

        const { data, error } = await supabase
            .from('scheduled_messages')
            .insert([{ chat_id: chatId, message, scheduled_time: reminderTime, recurring: true }]);

        if (error) {
            console.error('Error setting recurring reminder:', error);
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error setting reminder.') });
        } else {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('✅ Reminder set successfully. It will repeat every 24 hours until canceled.') });
        }
    } catch (error) {
        console.error('Error in remind:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error setting reminder.') });
    }
};

// Cancel a specific schedule by ID
const cancelSchedule = async (sock, chatId, args) => {
    try {
        if (!Array.isArray(args) || args.length < 1) {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Please provide the schedule ID to cancel.') });
            return;
        }

        const messageId = args[0];

        const { data, error } = await supabase
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

// Cancel a specific reminder by time
const cancelReminder = async (sock, chatId, args) => {
    try {
        if (!Array.isArray(args) || args.length < 1) {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Please provide the time of the reminder to cancel (e.g., 11:30).') });
            return;
        }

        const timeParts = args[0].split(':');
        if (timeParts.length !== 2 || isNaN(timeParts[0]) || isNaN(timeParts[1])) {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Invalid time format. Please provide a valid time (e.g., 11:30).') });
            return;
        }

        const hours = parseInt(timeParts[0], 10);
        const minutes = parseInt(timeParts[1], 10);

        const now = new Date();
        const reminderTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);

        const { data, error } = await supabase
            .from('scheduled_messages')
            .delete()
            .eq('chat_id', chatId)
            .eq('scheduled_time', reminderTime.toISOString());

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

// List all scheduled messages or reminders for a chat
const listSchedules = async (sock, chatId) => {
    try {
        const { data, error } = await supabase
            .from('scheduled_messages')
            .select('*')
            .eq('chat_id', chatId);

        if (error) {
            console.error('Error fetching scheduled messages:', error);
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error fetching scheduled messages.') });
            return;
        }

        if (!data || data.length === 0) {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('📋 No scheduled messages or reminders found for this chat.') });
            return;
        }

        // Format the list of scheduled messages
        let messageList = '📋 Scheduled Messages/Reminders:\n\n';
        data.forEach((item) => {
            messageList += `🆔 ID: ${item.id}\n`;
            messageList += `📅 Time: ${new Date(item.scheduled_time).toLocaleString()}\n`;
            messageList += `💬 Message: ${item.message}\n`;
            messageList += `🔁 Recurring: ${item.recurring ? 'Yes' : 'No'}\n\n`;
        });

        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(messageList) });
    } catch (error) {
        console.error('Error in listSchedules:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error listing scheduled messages.') });
    }
};

// Example implementation of scheduleAnnouncement
async function scheduleAnnouncement(sock, chatId, message) {
    await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`📅 Scheduled announcement: ${message}`) });
}

module.exports = { scheduleMessage, remind, cancelSchedule, cancelReminder, scheduleAnnouncement, listSchedules };