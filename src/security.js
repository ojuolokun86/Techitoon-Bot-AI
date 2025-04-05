const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const config = require('./config/config');
const supabase = require('./supabaseClient');

async function saveSuperadmin(groupId, userId) {
    await supabase
        .from('superadmins')
        .upsert([{ group_id: groupId, user_id: userId }]);
}

async function fetchGroupMetadataWithRetry(sock, groupId, retries = 3, delay = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await sock.groupMetadata(groupId);
        } catch (err) {
            if (i === retries - 1) {
                throw err;
            }
            console.log(`Retrying fetchGroupMetadata (${i + 1}/${retries})...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

async function startSecurityBot(sock) {
    const myNumber = config.botOwnerId;

    sock.ev.on('group-participants.update', async (update) => {
        const { id, participants, action, by } = update;
        let groupMetadata;

        try {
            groupMetadata = await fetchGroupMetadataWithRetry(sock, id);
        } catch (err) {
            console.log(`Error fetching group metadata for ${id}:`, err);
            return; // Exit the handler if group metadata cannot be fetched
        }

        if (action === 'promote') {
            for (const participant of participants) {
                if (participant !== myNumber) {
                    try {
                        // Demote any user who is promoted to admin
                        await sock.groupParticipantsUpdate(id, [participant], 'demote');
                        console.log(`❌ Removed admin rights from: ${participant}`);
                        // await sock.sendMessage(id, { text: `⚠️ Admin rights are restricted. @${participant.split('@')[0]} has been demoted.`, mentions: [participant] });
                    } catch (err) {
                        console.log(`⚠️ Failed to demote ${participant}:`, err);
                    }
                } else {
                    // Save the bot owner as a superadmin
                    await saveSuperadmin(id, participant);
                }
            }
        }

        if (action === 'remove' && participants.includes(myNumber)) {
            console.log('🚨 I was removed! Taking back control...');
            if (by) {
                try {
                    await sock.groupParticipantsUpdate(id, [by], 'remove');
                    console.log(`🔥 Banned ${by} for removing me.`);
                } catch (err) {
                    console.log(`❌ Failed to remove ${by}:`, err);
                }
            }
            await sock.groupParticipantsUpdate(id, [myNumber], 'add');
            await sock.groupParticipantsUpdate(id, [myNumber], 'promote');
            console.log(`✅ Restored as superadmin.`);
        }

        if (action === 'add') {
            for (const user of participants) {
                let { data, error } = await supabase
                    .from('superadmins')
                    .select('*')
                    .eq('group_id', id)
                    .eq('user_id', user);

                if (error) {
                    console.log(`Error fetching superadmin data for ${user} in ${id}:`, error);
                    continue;
                }

                if (data && data.length > 0) {
                    // User was a superadmin before, restore admin rights
                    await sock.groupParticipantsUpdate(id, [user], 'promote');
                    await sock.sendMessage(id, { text: `✅ @${user.split('@')[0]} has been restored as superadmin!`, mentions: [user] });
                }
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;
        const sender = msg.key.participant || msg.key.remoteJid;
        const chatId = msg.key.remoteJid;
        const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

        if (messageText === '.restoreme' && sender === myNumber) {
            console.log('🛠 Restoring superadmin rights manually...');
            await sock.groupParticipantsUpdate(chatId, [myNumber], 'promote');
            console.log(`✅ You are now superadmin again!`);
        }
    });
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
    const sock = makeWASocket({ auth: state, printQRInTerminal: true });

    sock.ev.on('creds.update', saveCreds);
    const botNumber = config.botNumber;
    const backupNumber = config.backupNumber;

    async function checkAndRestoreGroups() {
        console.log('🔍 Checking groups for admin status...');
        const groups = await sock.groupFetchAllParticipating();
        for (const groupId in groups) {
            const metadata = await sock.groupMetadata(groupId);
            if (!metadata.participants.some(p => p.id === botNumber && p.admin)) {
                try {
                    await sock.groupParticipantsUpdate(groupId, [botNumber], 'promote');
                    console.log(`✅ Restored admin in ${metadata.subject}`);
                } catch (err) {
                    console.log(`❌ Failed in ${metadata.subject}:`, err);
                }
            }
        }
    }

    sock.ev.on('connection.update', async ({ connection }) => {
        if (connection === 'open') await checkAndRestoreGroups();
    });

    sock.ev.on('group-participants.update', async (update) => {
        const { id, participants, action, by } = update;
        if (action === 'remove' && participants.includes(botNumber)) {
            console.log('🚨 Bot removed! Restoring...');
            if (by) await sock.groupParticipantsUpdate(id, [by], 'remove');
            await sock.groupParticipantsUpdate(id, [botNumber], 'add');
            await sock.groupParticipantsUpdate(id, [botNumber], 'promote');
            console.log('✅ Bot admin restored.');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;
        const sender = msg.key.participant || msg.key.remoteJid;
        const chatId = msg.key.remoteJid;
        const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

        if (messageText === '.restoreme' && sender === backupNumber) {
            console.log('🛠 Emergency restore triggered via DM...');
            const groups = await sock.groupFetchAllParticipating();
            for (const groupId in groups) {
                await sock.groupParticipantsUpdate(groupId, [botNumber], 'promote');
                console.log(`✅ Restored in ${groups[groupId].subject}`);
            }
        }
    });

    await checkAndRestoreGroups();
}

module.exports = { startSecurityBot, startBot };