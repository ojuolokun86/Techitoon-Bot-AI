const { sendMessage, sendReaction } = require('../utils/messageUtils');
const supabase = require('../supabaseClient');
const { issueWarning, getRemainingWarnings } = require('../message-controller/warning');
const config = require('../config/config');
const { getPrefix } = require('../utils/configUtils');
const { enableAntiDelete, disableAntiDelete } = require('./antiDelete');

const salesKeywords = [
    'sell', 'sale', 'selling', 'buy', 'buying', 'trade', 'trading', 'swap', 'swapping', 'exchange', 'price',
    'available for sale', 'dm for price', 'account for sale', 'selling my account', 'who wants to buy', 'how much?',
    '$', '₦', 'paypal', 'btc'
];

const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|wa\.me\/[^\s]+|chat\.whatsapp\.com\/[^\s]+|t\.me\/[^\s]+|bit\.ly\/[^\s]+|[\w-]+\.(com|net|org|info|biz|xyz|live|tv|me|link)(\/\S*)?)/gi;

const groupMetadataCache = new Map(); // Store group metadata temporarily

const getGroupMetadata = async (sock, chatId) => {
    // If data exists and is less than 5 minutes old, return cached data
    if (groupMetadataCache.has(chatId)) {
        const cachedData = groupMetadataCache.get(chatId);
        if (Date.now() - cachedData.timestamp < 300000) { // 5 minutes
            console.log(`✅ Using cached group metadata for ${chatId}`);
            return cachedData.data;
        }
    }

    // Fetch new group metadata
    try {
        const metadata = await sock.groupMetadata(chatId);
        groupMetadataCache.set(chatId, { data: metadata, timestamp: Date.now() });
        console.log(`🔄 Fetched new group metadata for ${chatId}`);
        return metadata;
    } catch (error) {
        console.error("⚠️ Error fetching group metadata:", error);
        return null; // Return null to prevent crashes
    }
};

const handleProtectionMessages = async (sock, message) => {
    const chatId = message.key.remoteJid;
    const sender = message.key.participant || message.key.remoteJid;

    // Fetch group/channel settings from Supabase
    let groupSettings = null;
    if (chatId.endsWith('@g.us') || chatId.endsWith('@broadcast')) {
        const { data, error } = await supabase
            .from('group_settings')
            .select('bot_enabled, antilink_enabled, antisales_enabled, permit_admin_bypass')
            .eq('group_id', chatId)
            .single();
        groupSettings = data;
        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching group settings:', error);
        }
    }

    // Check if groupSettings is null or undefined
    if (!groupSettings) {
        console.log('⚠️ No group settings found for this group. Skipping protection actions.');
        return;
    }

    // Check if the bot is enabled in the group/channel
    if (!groupSettings.bot_enabled) {
        console.log('🛑 Bot is disabled in this group/channel. Skipping protection actions.');
        return;
    }

    try {
        const msgText = message.message?.conversation || message.message?.extendedTextMessage?.text || 
                        message.message?.imageMessage?.caption || message.message?.videoMessage?.caption || '';

        console.log(`Checking message for protection: ${msgText} from ${sender} in ${chatId}`);

        // Check if the user is permitted to bypass antilink or antisales
        const { data: permittedUsers } = await supabase
            .from('antilink_permissions')
            .select('user_id')
            .eq('group_id', chatId);

        const isPermitted = permittedUsers?.some(user => user.user_id === sender);

        // Check if the sender is an admin and if admin bypass is enabled
        const groupMetadata = await getGroupMetadata(sock, chatId);
        const isAdmin = groupMetadata?.participants.some(participant => participant.id === sender && (participant.admin === 'admin' || participant.admin === 'superadmin'));

        // Bypass protection for the bot owner
        if (sender === config.botOwnerId || isPermitted || (isAdmin && groupSettings.permit_admin_bypass)) {
            return;
        }

        // **Sales Content Detection**
        if (groupSettings.antisales_enabled) {
            const containsSalesKeywords = salesKeywords.some(keyword => msgText.toLowerCase().includes(keyword));
            if (containsSalesKeywords && (message.message?.imageMessage || message.message?.videoMessage)) {
                await sock.sendMessage(chatId, { delete: message.key });
                console.log(`⚠️ Media message from ${sender} deleted in group: ${chatId} (sales content detected)`);

                // **Send warning request to warning.js**
                const remainingWarnings = await getRemainingWarnings(chatId, sender, 'sales');
                if (remainingWarnings <= 0) {
                    await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
                    console.log(`🚫 User ${sender} kicked from group: ${chatId} after reaching sales warning threshold.`);
                } else {
                    await issueWarning(sock, chatId, sender, "Posting sales content", config.warningThreshold.sales);
                }
                return;
            }
        }

        // **Link Detection**
        if (groupSettings.antilink_enabled) {
            if (linkRegex.test(msgText)) {
                await sock.sendMessage(chatId, { delete: message.key });
                console.log(`⚠️ Message from ${sender} deleted in group: ${chatId} (link detected)`);

                // **Send warning request to warning.js**
                const remainingWarnings = await getRemainingWarnings(chatId, sender, 'links');
                if (remainingWarnings <= 0) {
                    await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
                    console.log(`🚫 User ${sender} kicked from group: ${chatId} after reaching link warning threshold.`);
                } else {
                    await issueWarning(sock, chatId, sender, "Posting links", config.warningThreshold.links);
                }
                return;
            }
        }
    } catch (error) {
        console.error('Error handling protection messages:', error);
    }
};

module.exports = { handleProtectionMessages };
