const supabase = require('../supabaseClient');
const fs = require('fs');
const path = require('path');

let isBotPoweredOn = true;

const powerOnBot = () => {
    isBotPoweredOn = true;
    console.log('Bot powered on.');
};

const powerOffBot = () => {
    isBotPoweredOn = false;
    console.log('Bot powered off.');
};

const isBotOn = () => {
    return isBotPoweredOn;
};

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
        powerOnBot();
        const imagePath = path.resolve(__dirname, '../../images/poweron.jpg'); // Update the path to your power on image
        const imageBuffer = fs.readFileSync(imagePath);
        await sock.sendMessage(chatId, { image: imageBuffer, caption: '✅ Bot powered on.' });
    } else if (messageText.startsWith(`${currentPrefix}poweroff`)) {
        if (sender !== '2348026977793@s.whatsapp.net') { // Replace with the bot owner's ID
            await sock.sendMessage(chatId, { text: '❌ Only the bot owner can power off the bot.' });
            return;
        }
        powerOffBot();
        const imagePath = path.resolve(__dirname, '../../images/poweroff.jpg'); // Update the path to your power off image
        const imageBuffer = fs.readFileSync(imagePath);
        await sock.sendMessage(chatId, { image: imageBuffer, caption: '✅ Bot powered off.' });
    }
};

module.exports = {
    powerOnBot,
    powerOffBot,
    isBotOn,
    handlePowerCommand,
};