const deletedMessages = {};

const storeDeletedMessage = async (chatId, messageId, text) => {
    if (!deletedMessages[chatId]) {
        deletedMessages[chatId] = {};
    }
    deletedMessages[chatId][messageId] = { text };
};

const getDeletedMessage = async (chatId, messageId) => {
    return deletedMessages[chatId]?.[messageId] || null;
};

module.exports = { storeDeletedMessage, getDeletedMessage };