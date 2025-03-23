const { exec } = require("child_process");
const config = require("../config/config"); // Import the config file

// Function to handle the undeploy command
async function undeployBot(sock, chatId, sender, message, currentPrefix) {
    // Get the bot owner's ID from the config file
    const BOT_OWNER_ID = config.botOwnerId;

    // Check if the sender is the bot owner
    if (!sender.includes(BOT_OWNER_ID)) {
        await sock.sendMessage(chatId, {
            text: "❌ You are not authorized to use this command.",
        });
        return;
    }

    // Ask for confirmation
    if (message === `${currentPrefix}undeploy`) {
        await sock.sendMessage(chatId, {
            text: "⚠️ Are you sure you want to undeploy the bot? Reply with `.confirm` to proceed.",
        });

        // Set a flag to track confirmation
        global.isAwaitingConfirmation = true;
        return;
    }

    // Handle confirmation
    if (message === `${currentPrefix}confirm` && global.isAwaitingConfirmation) {
        global.isAwaitingConfirmation = false; // Reset the confirmation flag

        // Execute the railway down command
        exec("railway down", async (error, stdout, stderr) => {
            if (error) {
                console.error(`Error: ${error.message}`);
                await sock.sendMessage(chatId, {
                    text: "❌ Failed to undeploy the bot.",
                });
                return;
            }
            if (stderr) {
                console.error(`Stderr: ${stderr}`);
                await sock.sendMessage(chatId, {
                    text: "⚠️ Something went wrong while undeploying.",
                });
                return;
            }
            console.log(`Success: ${stdout}`);
            await sock.sendMessage(chatId, {
                text: "✅ Bot has been undeployed successfully!",
            });
        });
    }
}

module.exports = { undeployBot };