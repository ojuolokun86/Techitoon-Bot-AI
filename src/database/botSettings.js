const settings = {
    global: false,  // Global anti-delete status
    groupOnly: false,  // Apply to all groups
    privateOnly: false,  // Apply to private chats
    chats: {}  // Store individual chat settings
};

const setAntiDelete = async (chatId, status, type = 'single') => {
    if (type === 'global') {
        settings.global = status;
    } else if (type === 'group') {
        settings.groupOnly = status;
    } else if (type === 'private') {
        settings.privateOnly = status;
    } else {
        settings.chats[chatId] = status;
    }
};

const getAntiDeleteStatus = async (chatId, isGroup) => {
    if (settings.global) return true;
    if (isGroup && settings.groupOnly) return true;
    if (!isGroup && settings.privateOnly) return true;
    return settings.chats[chatId] || false;
};

module.exports = { setAntiDelete, getAntiDeleteStatus };