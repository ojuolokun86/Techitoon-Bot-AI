const supabase = require('../supabaseClient');

const handleStatusUpdate = async (sock, statusUpdate) => {
    const { id, participant, status } = statusUpdate;
    const sender = participant || id;

    console.log(`Received status update from ${sender}: ${status}`);

    // Optionally, like the status update
    await sock.sendMessage(sender, { react: { text: '👍', key: statusUpdate.key } });

    console.log('Status update liked successfully');
};

module.exports = { handleStatusUpdate };