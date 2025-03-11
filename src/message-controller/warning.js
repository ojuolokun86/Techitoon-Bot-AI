const { sendMessage } = require('../utils/messageUtils');
const supabase = require('../supabaseClient');
const config = require('../config/config');

const isAdminOrOwner = async (sock, chatId, sender) => {
    const groupMetadata = await sock.groupMetadata(chatId);
    const participants = groupMetadata.participants;
    
    console.log("Participants:", participants); // Debugging log

    const isAdmin = participants.some(p => p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin'));
    const isOwner = sender === config.botOwnerId;

    console.log(`Checking Admin Status - Sender: ${sender}, Is Admin: ${isAdmin}, Is Owner: ${isOwner}`);

    return isAdmin || isOwner;
};

const issueWarning = async (sock, chatId, userId, reason, warningThreshold, sender) => {
    if (!await isAdminOrOwner(sock, chatId, sender)) {
        await sendMessage(sock, chatId, '❌ Only admins or the bot owner can use this command.');
        return;
    }

    try {
        if (typeof userId !== 'string' || userId === chatId) {
            console.error('Error: Invalid user ID:', userId);
            await sendMessage(sock, chatId, '⚠️ Error: Invalid user ID.');
            return;
        }

        // Fetch current warning count
        const { data: existingWarnings, error: fetchError } = await supabase
            .from('warnings')
            .select('*')
            .eq('user_id', userId)
            .eq('group_id', chatId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('Error fetching existing warnings:', fetchError);
            return;
        }

        let warningCount = existingWarnings ? existingWarnings.count : 0;
        warningCount += 1;

        // Update warning count
        const { error: updateError } = await supabase
            .from('warnings')
            .upsert({ user_id: userId, group_id: chatId, reason: reason, count: warningCount }, { onConflict: ['user_id', 'group_id'] });

        if (updateError) {
            console.error('Error updating warning count:', updateError);
            return;
        }

        // Calculate remaining warnings before kick
        const remainingWarnings = warningThreshold - warningCount;

        // Send warning message
        let warningMessage = `⚠️ @${userId.split('@')[0]}, you have been warned for: ${reason}. This is warning #${warningCount}.`;
        if (remainingWarnings > 0) {
            warningMessage += ` You will be kicked after ${remainingWarnings} more warning(s).`;
        }
        await sendMessage(sock, chatId, warningMessage, [userId]);

        console.log(`⚠️ User ${userId} warned in group: ${chatId}`);

        // Check if the warning count exceeds the threshold
        if (warningCount >= warningThreshold) {
            // Kick the user out of the group
            await sock.groupParticipantsUpdate(chatId, [userId], 'remove');
            console.log(`🚫 User ${userId} kicked from group: ${chatId} after reaching warning threshold.`);
        }
    } catch (error) {
        console.error('Error issuing warning:', error);
    }
};

const resetWarnings = async (sock, chatId, userId, sender) => {
    if (!await isAdminOrOwner(sock, chatId, sender)) {
        await sendMessage(sock, chatId, '❌ Only admins or the bot owner can use this command.');
        return;
    }

    try {
        if (typeof userId !== 'string' || userId === chatId) {
            console.error('Error: Invalid user ID:', userId);
            await sendMessage(sock, chatId, '⚠️ Error: Invalid user ID.');
            return;
        }

        const { error } = await supabase
            .from('warnings')
            .delete()
            .eq('user_id', userId)
            .eq('group_id', chatId);

        if (error) {
            console.error('Error resetting warnings:', error);
            return;
        }

        await sendMessage(sock, chatId, `🔄 Warnings for @${userId.split('@')[0]} have been reset.`, [userId]);
        console.log(`🔄 Warnings for user ${userId} reset in group: ${chatId}`);
    } catch (error) {
        console.error('Error resetting warnings:', error);
    }
};

const listWarnings = async (sock, chatId) => {
    try {
        const { data: warnings, error } = await supabase
            .from('warnings')
            .select('*')
            .eq('group_id', chatId);

        if (error) {
            console.error('Error fetching warnings:', error);
            await sendMessage(sock, chatId, '❌ Error fetching warnings.');
            return;
        }

        if (!warnings || warnings.length === 0) {
            await sendMessage(sock, chatId, '📋 No warnings found for this group.');
            return;
        }

        // Format the warnings into a readable message
        let warningsMessage = '📋 *Group Warnings* 📋\n\n';
        warnings.forEach(warning => {
            warningsMessage += `👤 *User*: @${warning.user_id.split('@')[0]}\n`;
            warningsMessage += `⚠️ *Warnings*: ${warning.count}\n`;
            warningsMessage += `📝 *Reason*: ${warning.reason}\n\n`;
        });

        await sendMessage(sock, chatId, warningsMessage);
    } catch (error) {
        console.error('Error listing warnings:', error);
        await sendMessage(sock, chatId, '❌ Error listing warnings.');
    }
};

const getRemainingWarnings = async (chatId, userId, reason) => {
    try {
        if (typeof userId !== 'string' || userId === chatId) {
            console.error('Error: Invalid user ID:', userId);
            return null;
        }

        const { data: existingWarnings, error } = await supabase
            .from('warnings')
            .select('*')
            .eq('user_id', userId)
            .eq('group_id', chatId)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching existing warnings:', error);
            return null;
        }

        const warningCount = existingWarnings ? existingWarnings.count : 0;
        const warningThreshold = config.warningThreshold[reason];
        return warningThreshold - warningCount;
    } catch (error) {
        console.error('Error fetching remaining warnings:', error);
        return null;
    }
};

module.exports = { issueWarning, resetWarnings, listWarnings, getRemainingWarnings };