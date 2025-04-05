const supabase = require('../supabaseClient');
const fs = require('fs');
const path = require('path');

let isBotPoweredOn = true; // Default state

// Fetch Power State from Supabase
const fetchPowerState = async () => {
    try {
        const { data, error } = await supabase
            .from('config')
            .select('power_state')
            .single();

        if (error) {
            console.error('Error fetching power state from Supabase:', error);
            return 'off'; // Default to 'off' if there's an error
        }

        return data.power_state || 'off'; // Default to 'off' if no value is set
    } catch (error) {
        console.error('Error fetching power state:', error);
        return 'off';
    }
};

// Update Power State in Supabase
const updatePowerState = async (state) => {
    try {
        const { error } = await supabase
            .from('config')
            .update({ power_state: state })
            .eq('id', 1); // Assuming the config table has a single row with ID 1

        if (error) {
            console.error('Error updating power state in Supabase:', error);
        } else {
            console.log(`✅ Power state updated to: ${state}`);
        }
    } catch (error) {
        console.error('Error updating power state:', error);
    }
};

// Power On the Bot
const powerOnBot = async (sock) => {
    isBotPoweredOn = true;
    console.log('✅ Bot powered on.');
    await updatePowerState('on');
};

// Power Off the Bot
const powerOffBot = async (sock) => {
    isBotPoweredOn = false;
    console.log('❌ Bot powered off.');
    await updatePowerState('off');
};

// Check if Bot is On
const isBotOn = () => {
    return isBotPoweredOn;
};

// Get Prefix from Supabase
const getPrefixFromSupabase = async () => {
    const { data, error } = await supabase
        .from('config')
        .select('prefix')
        .single();

    if (error) {
        console.error('Error fetching prefix from Supabase:', error);
        return '!';
    }

    return data.prefix;
};

// Send Power On/Off Messages to All Enabled Groups
const sendPowerMessageToGroups = async (sock, imagePath, caption) => {
    try {
        // Fetch all groups where the bot is enabled
        const { data: groups, error } = await supabase
            .from('group_settings')
            .select('group_id')
            .eq('bot_enabled', true);

        if (error) {
            console.error('Error fetching enabled groups:', error);
            return;
        }

        // Read the power image
        const imageBuffer = fs.readFileSync(imagePath);

        // Send the message to each group
        for (const group of groups) {
            await sock.sendMessage(group.group_id, { image: imageBuffer, caption });
        }

        console.log(`✅ Power message sent to ${groups.length} enabled groups.`);
    } catch (error) {
        console.error('Error sending power message to groups:', error);
    }
};

// Handle Commands
const handlePowerCommand = async (sock, msg) => {
    const chatId = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    const currentPrefix = await getPrefixFromSupabase();

    if (messageText.startsWith(`${currentPrefix}poweron`)) {
        if (sender !== '2348026977793@s.whatsapp.net') { // Replace with the bot owner's ID
            await sock.sendMessage(chatId, { text: '❌ Only the bot owner can power on the bot.' });
            return;
        }
        await powerOnBot(sock);
        const imagePath = path.resolve(__dirname, '../../images/poweron.jpg'); // Update the path to your power on image
        const caption = '✅ Bot powered on.';
        await sendPowerMessageToGroups(sock, imagePath, caption);
    } else if (messageText.startsWith(`${currentPrefix}poweroff`)) {
        if (sender !== '2348026977793@s.whatsapp.net') { // Replace with the bot owner's ID
            await sock.sendMessage(chatId, { text: '❌ Only the bot owner can power off the bot.' });
            return;
        }
        await powerOffBot(sock);
        const imagePath = path.resolve(__dirname, '../../images/poweroff.jpg'); // Update the path to your power off image
        const caption = '✅ Bot powered off.';
        await sendPowerMessageToGroups(sock, imagePath, caption);
    } else if (messageText.startsWith(`${currentPrefix}uptime`)) {
        if (sender !== '2348026977793@s.whatsapp.net') { // Replace with the bot owner's ID
            await sock.sendMessage(chatId, { text: '❌ Only the bot owner can check the bot uptime.' });
            return;
        }
        const uptimeInSeconds = process.uptime();
        const uptimeString = new Date(uptimeInSeconds * 1000).toISOString().substr(11, 8); // Format as HH:MM:SS
        await sock.sendMessage(chatId, { text: `⏱️ Bot Uptime: ${uptimeString}` });
    } else if (messageText.startsWith(`${currentPrefix}logs`)) {
        try {
            const logs = fs.readFileSync('./logs/bot.log', 'utf8'); // Adjust the path to your log file
            const recentLogs = logs.split('\n').slice(-10).join('\n'); // Get the last 10 lines
            await sock.sendMessage(chatId, { text: `📜 Recent Logs:\n\n${recentLogs}` });
        } catch (error) {
            console.error('Error reading logs:', error);
            await sock.sendMessage(chatId, { text: '❌ Unable to fetch logs.' });
        }
    } else if (messageText.startsWith(`${currentPrefix}status`)) {
        const memoryUsage = process.memoryUsage();
        const statusMessage = `
📊 Bot Status:
- Uptime: ${new Date(process.uptime() * 1000).toISOString().substr(11, 8)}
- Memory Usage: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB
- Total Memory: ${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB
        `;
        await sock.sendMessage(chatId, { text: statusMessage });
    } else if (messageText.startsWith(`${currentPrefix}restart`)) {
        if (sender !== '2348026977793@s.whatsapp.net') { // Replace with the bot owner's ID
            await sock.sendMessage(chatId, { text: '❌ Only the bot owner can restart the bot.' });
            return;
        }
        await sock.sendMessage(chatId, { text: '🔄 Restarting bot...' });
        process.exit(0); // Exit the process to allow Railway to restart it
    } else if (messageText.startsWith(`${currentPrefix}stop`)) {
        if (sender !== '2348026977793@s.whatsapp.net') { // Replace with the bot owner's ID
            await sock.sendMessage(chatId, { text: '❌ Only the bot owner can stop the bot.' });
            return;
        }
        await sock.sendMessage(chatId, { text: '⏹️ Stopping bot...' });
        process.exit(0); // Exit the process
    }
};

// Initialize Bot Power State on Startup
const initializePowerState = async (sock) => {
    const powerState = await fetchPowerState();
    if (powerState === 'off') {
        console.log('🔌 Bot is starting in powered-off state.');
        isBotPoweredOn = false;
    } else {
        console.log('⚡ Bot is starting in powered-on state.');
        isBotPoweredOn = true;
    }
};

// Check Restart Flag
const checkRestartFlag = async () => {
    const { data, error } = await supabase
        .from('config')
        .select('restart_flag')
        .eq('id', 1)
        .single();

    if (error) {
        console.error('Error checking restart flag:', error);
        return;
    }

    if (data.restart_flag) {
        console.log('Restart flag detected. Resetting flag...');
        await supabase
            .from('config')
            .update({ restart_flag: false })
            .eq('id', 1);
    }
};

module.exports = {
    handlePowerCommand, // ✅ Now exported
    initializePowerState,
    checkRestartFlag,
    isBotOn,
};
