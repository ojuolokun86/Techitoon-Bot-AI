const { getPrefix } = require('../utils/configUtils');
const { formatResponseWithHeaderFooter } = require('../utils/utils');

const sendHelpMenu = async (sock, chatId, isGroup, isAdmin) => {
    const currentPrefix = await getPrefix();

    const helpText = `
╭━━━〘  🌟 𝗧𝗲𝗰𝗵𝗶𝘁𝗼𝗼𝗻 𝗔𝗜 - 𝗖𝗼𝗺𝗺𝗮𝗻𝗱 𝗚𝘂𝗶𝗱𝗲 🌟 〙━━━╮

📌 𝗚𝗘𝗡𝗘𝗥𝗔𝗟 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦:
🔹 *${currentPrefix}ping* — Check if I'm online  
🔹 *${currentPrefix}menu* — Show this menu  
🔹 *${currentPrefix}joke* — Get a random joke 😂  
🔹 *${currentPrefix}quote* — Receive a motivational quote ✨  
🔹 *${currentPrefix}quote auto <times>* — Schedule quotes ⏰  
🔹 *${currentPrefix}weather <city>* — Check the weather 🌦️  
🔹 *${currentPrefix}translate <text>* — Translate any text 🌍  

📌 𝗔𝗗𝗠𝗜𝗡 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦:
👑 *${currentPrefix}admin* — View group admins  
📖 *${currentPrefix}rules* — Show group rules  
🚮 *${currentPrefix}clear* — Clean chat history  
👋 *${currentPrefix}ban @user* — Remove a user  
🏟️ *${currentPrefix}tagall* — Mention all group members  
🔇 *${currentPrefix}mute/unmute* — Control chat access  
📢 *${currentPrefix}announce <message>* — Make an announcement  
📢 *${currentPrefix}stopannounce* — Stop announcements  
📅 *${currentPrefix}schedule <time> <message>* — Schedule a message  
📅 *${currentPrefix}remind <time> <message>* — Set a reminder  
📅 *${currentPrefix}listschedule* — List all schedules  
📅 *${currentPrefix}cancelschedule <id>* — Cancel a schedule  
📅 *${currentPrefix}cancelreminder <id>* — Cancel a reminder  
📊 *${currentPrefix}poll <question>* — Create a poll  
📊 *${currentPrefix}vote <option>* — Vote in a poll  
📊 *${currentPrefix}endpoll* — End a poll  
🏆 *${currentPrefix}starttournament* — Start a tournament  
🏆 *${currentPrefix}start best attack* — Start best attack  
🏆 *${currentPrefix}best attack* — Show best attack  
🏆 *${currentPrefix}end best attack* — End best attack  
📊 *${currentPrefix}extract* — Extract data  
⚽ *${currentPrefix}goal <player>* — Add a goal  
⚽ *${currentPrefix}setgoal <player> <goals>* — Set goals  
⚽ *${currentPrefix}top scorers* — Show top scorers  
⚽ *${currentPrefix}add player <name>* — Add a player  
⚽ *${currentPrefix}remove player <name>* — Remove a player  
⚽ *${currentPrefix}list players* — List all players  
📊 *${currentPrefix}upload result* — Upload result  
📊 *${currentPrefix}auto check result* — Enable auto check result  
📊 *${currentPrefix}auto check result off* — Disable auto check result  
📜 *${currentPrefix}setgrouprules <rules>* — Set group rules  
📜 *${currentPrefix}settournamentrules <rules>* — Set tournament rules  
🌐 *${currentPrefix}setlanguage <language>* — Set language  
🗑️ *${currentPrefix}delete <message>* — Delete a message  
🔒 *${currentPrefix}enable* — Enable bot  
🔓 *${currentPrefix}disable* — Disable bot  
👋 *${currentPrefix}startwelcome* — Start welcome messages  
👋 *${currentPrefix}stopwelcome* — Stop welcome messages  
👑 *${currentPrefix}promote @user* — Promote a user  
👑 *${currentPrefix}demote @user* — Demote a user  
⚠️ *${currentPrefix}warn @user <reason>* — Issue a warning  
👀 *${currentPrefix}listwarn* — Check penalized members  
✝️ *${currentPrefix}resetwarn @user* — Remove warnings  
🏆 *${currentPrefix}fame* — Show hall of fame  
🔗 *${currentPrefix}sharelink* — Share group link  
🏆 *${currentPrefix}addwinner <name>* — Add a winner  
👋 *${currentPrefix}startgoodbye* — Start goodbye messages  
👋 *${currentPrefix}stopgoodbye* — Stop goodbye messages  

📌 𝗣𝗥𝗢𝗧𝗘𝗖𝗧𝗜𝗢𝗡 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦:
🔗 *${currentPrefix}antilink on/off* — Block links  
🚫 *${currentPrefix}antisales on/off* — Block sales & swaps  
❌ *${currentPrefix}antidelete on/off* — Prevent message deletion  

📌 𝗣𝗢𝗪𝗘𝗥 & 𝗦𝗧𝗔𝗧𝗨𝗦:
⚡ *${currentPrefix}poweron/poweroff* — Turn bot on/off  
⏱️ *${currentPrefix}uptime* — Check bot uptime  
🔄 *${currentPrefix}restart* — Restart the bot  
🛑 *${currentPrefix}stop* — Shutdown Techitoon Bot
📜 *${currentPrefix}logs* — View recent logs  
📊 *${currentPrefix}status* — View bot status

╰━━━〘 🚀 𝙏𝙚𝙘𝙝𝙞𝙩𝙤𝙤𝙣 - 𝙀𝙣𝙝𝙖𝙣𝙘𝙞𝙣𝙜 𝙔𝙤𝙪𝙧 𝘾𝙝𝙖𝙩𝙨! 🚀 〙━━━╯  
    `;

    await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(helpText) });
};

module.exports = { sendHelpMenu };