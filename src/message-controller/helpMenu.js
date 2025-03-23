const { getPrefix } = require('../utils/configUtils'); // Import getPrefix function
const { formatResponseWithHeaderFooter } = require('../utils/utils'); // Import formatting utility

const sendHelpMenu = async (sock, chatId, isGroup, isAdmin) => {
    const currentPrefix = await getPrefix(); // Get the current prefix dynamically
    const helpText = `
📜✨ 𝙏𝙚𝙘𝙝𝙞𝙩𝙤𝙤𝙣 𝘽𝙤𝙩 𝙈𝙚𝙣𝙪 ✨📜
🔹 Your friendly AI assistant, here to serve! 🤖

💡 General Commands:
📍 ${currentPrefix}ping – Am I alive? Let’s find out! ⚡
📍 ${currentPrefix}menu – Shows this awesome menu! 📜
📍 ${currentPrefix}joke – Need a laugh? I got you! 😂
📍 ${currentPrefix}quote – Get inspired with a random quote! ✨
📍 ${currentPrefix}weather <city> – Check the skies before you step out! ☁️🌦️
📍 ${currentPrefix}translate <text> – Lost in translation? I’ll help! 🈶➡️🇬🇧

👑 Admin Commands (Boss Mode Activated!):
🛠️ ${currentPrefix}admin – See who’s running the show! 🏆
📊 ${currentPrefix}info – Get group details in one click! 🕵️‍♂️
📜 ${currentPrefix}rules – Read the sacred laws of the group! 📖
🧹 ${currentPrefix}clear – Wipe the chat clean! 🚮 (Admin Only)
🚫 ${currentPrefix}ban @user – Send someone to exile! 👋 (Admin Only)
🎤 ${currentPrefix}tagall – Summon all group members! 🏟️ (Admin Only)
🔇 ${currentPrefix}mute – Silence! Only admins can speak! 🤫 (Admin Only)
🔊 ${currentPrefix}unmute – Let the people speak again! 🎙️ (Admin Only)
📢 ${currentPrefix}announce <message> – Make a grand announcement! 📡 (Admin Only)
🚫 ${currentPrefix}stopannounce – End announcement mode! ❌ (Admin Only)

🔗 Anti-Link Commands:
🔗 ${currentPrefix}antilink on – Enable anti-link feature! 🔒 (Admin Only)
🔗 ${currentPrefix}antilink off – Disable anti-link feature! 🔓 (Admin Only)

🛍️ Anti-Sales Commands:
🛍️ ${currentPrefix}antisales on – Enable anti-sales feature! 🔒 (Admin Only)
🛍️ ${currentPrefix}antisales off – Disable anti-sales feature! 🔓 (Admin Only)

⚙️ Group & Bot Settings:
📝 ${currentPrefix}setgrouprules <rules> – Set the laws of the land! 📜 (Admin Only)
📜 ${currentPrefix}settournamentrules <rules> – Define tournament rules! ⚽ (Admin Only)
🈯 ${currentPrefix}setlanguage <language> – Change the bot’s language! 🌍 (Admin Only)
📊 ${currentPrefix}showstats – Who’s been the most active? 📈 (Admin Only)
❌ ${currentPrefix}delete – Erase unwanted messages! 🔥 (Admin Only)
🚀 ${currentPrefix}enable – Power up the bot! ⚡
🛑 ${currentPrefix}disable – Shut me down… but why? 😢
🎉 ${currentPrefix}startwelcome – Activate welcome messages! 🎊 (Admin Only)
🚫 ${currentPrefix}stopwelcome – No more welcome hugs! 🙅‍♂️ (Admin Only)

⚠️ Warnings & Moderation:
🚨 ${currentPrefix}warn @user <reason> – Issue a formal warning! ⚠️ (Admin Only)
📜 ${currentPrefix}listwarn – Check the troublemakers! 👀 (Admin Only)
❌ ${currentPrefix}resetwarn @user – Forgive and forget! ✝️ (Admin Only)

🔒 Anti-Delete:
🔓 ${currentPrefix}antidelete on – Enable anti-delete feature! 🔒 (Admin Only)
🔓 ${currentPrefix}antidelete off – Disable anti-delete feature! 🔓 (Admin Only)

🏆 Hall of Fame:
📜 ${currentPrefix}fame – Show the Hall of Fame! 🏆

⚡ Power Management:
🔌 ${currentPrefix}poweron – Power on the bot! ⚡ (Owner Only)
🔌 ${currentPrefix}poweroff – Power off the bot! ❌ (Owner Only)
⏱️ ${currentPrefix}uptime – Check the bot's uptime! ⏱️
📜 ${currentPrefix}logs – Get recent logs! 📜
📊 ${currentPrefix}status – Get the bot's status! 📊
🔄 ${currentPrefix}restart – Restart the bot! 🔄
⏹️ ${currentPrefix}stop – Stop the bot! ⏹️

💡 Use commands wisely! Or the bot might just develop a mind of its own… 🤖💀

🚀 𝙏𝙚𝙘𝙝𝙞𝙩𝙤𝙤𝙣 - Making WhatsApp Chats Smarter! 🚀
    `;
    await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(helpText) });
};

module.exports = { sendHelpMenu };