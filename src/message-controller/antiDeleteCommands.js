const { setAntiDelete, getAntiDeleteStatus } = require('../database/botSettings');

const toggleAntiDelete = async (sock, chatId, sender, isGroup, args) => {
    const command = args[0]?.toLowerCase();

    if (!command) {
        const status = await getAntiDeleteStatus(chatId, isGroup);
        return await sock.sendMessage(chatId, { text: `🔹 *Anti-Delete Status:* ${status ? 'Enabled ✅' : 'Disabled ❌'}` });
    }

    let status = true;
    let type = 'single';

    if (command === 'off') status = false;
    if (args[1] === 'all') type = 'global';
    if (args[1] === 'group') type = 'group';
    if (args[1] === 'private') type = 'private';

    await setAntiDelete(chatId, status, type);

    let responseText = `✅ *Anti-Delete has been ${status ? 'Enabled' : 'Disabled'}*`;
    if (type === 'global') responseText += ' for *All Chats* (Groups & Private)';
    else if (type === 'group') responseText += ' for *All Groups*';
    else if (type === 'private') responseText += ' for *All Private Messages*';
    else responseText += ` in this chat.`;

    await sock.sendMessage(chatId, { text: responseText });
};

module.exports = { toggleAntiDelete };