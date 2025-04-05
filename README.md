# Techitoon-Bot-AI v2.5

Techitoon Bot+AI is a WhatsApp bot built using the Baileys library. This is version 2.5 of the bot, which includes enhanced features, improved modularity, and new anti-link and anti-sales functionalities.

## Features

- Listens to incoming messages and responds to specific commands.
- Manages group participants and restores admin rights if removed.
- Maintains a Hall of Fame for community achievements.
- Restricted mode to limit command usage to the bot owner.
- Integration with Supabase for database management.
- Anti-link and anti-sales detection with customizable permissions.
- Customizable welcome and goodbye messages with user tagging.
- Group statistics tracking and reporting.
- Tournament management for groups.
- Scheduled messages using `node-cron`.

## Installation

1. Clone the repository:

    ```sh
    git clone https://github.com/ojuolokun86/Techitoon-Bot-AI-v2.git
    cd Techitoon-Bot-AI-v2
    ```

2. Install dependencies:

    ```sh
    npm install
    ```

3. Create a `.env` file in the root directory and add your configuration variables:

    ```env
    ADMIN_NUMBER=your-bot-owner-id
    BACKUP_NUMBER=your-backup-number
    SUPABASE_URL=your-supabase-url
    SUPABASE_KEY=your-supabase-key
    WEATHER_API_KEY=your-weather-api-key
    TRANSLATION_API_KEY=your-translation-api-key
    PREFIX=.
    ```

4. Start the bot:

    ```sh
    node src/index.js
    ```

## Usage

### General Commands
- `.ping` – Check if the bot is online.
- `.menu` – Display the help menu.
- `.joke` – Get a random joke.
- `.quote` – Get an inspirational quote.
- `.weather <city>` – Get the weather for a specific city.
- `.translate <text>` – Translate text to English.

### Admin Commands
- `.ban @user` – Ban a user from the group.
- `.mute` – Mute the group (only admins can send messages).
- `.unmute` – Unmute the group.
- `.tagall` – Mention all group members.
- `.announce <message>` – Send an announcement to the group.
- `.stopannounce` – Stop announcement mode.
- `.clear` – Clear the chat.

### Anti-Link Commands
- `.antilink on` – Enable anti-link detection.
- `.antilink off` – Disable anti-link detection.
- `.antilink permit @user` – Allow a user to post links.
- `.antilink nopermit @user` – Revoke a user's permission to post links.
- `.antilink permitnot` – Remove all link permissions in the group.

### Anti-Sales Commands
- `.antisales on` – Enable anti-sales detection.
- `.antisales off` – Disable anti-sales detection.
- `.antisales permit @user` – Allow a user to post sales content.
- `.antisales nopermit @user` – Revoke a user's permission to post sales content.
- `.antisales permitnot` – Remove all sales permissions in the group.

### Group & Bot Settings
- `.setgrouprules <rules>` – Set group rules.
- `.settournamentrules <rules>` – Set tournament rules.
- `.setlanguage <language>` – Change the bot's language.
- `.enable` – Enable the bot in the group.
- `.disable` – Disable the bot in the group.
- `.startwelcome` – Enable welcome messages.
- `.stopwelcome` – Disable welcome messages.

### Warnings & Moderation
- `.warn @user <reason>` – Issue a warning to a user.
- `.listwarn` – List all warnings in the group.
- `.resetwarn @user` – Reset warnings for a user.

### Hall of Fame
- `.fame` – Display the Hall of Fame.

### Group Statistics
- `.showstats` – Display group statistics, including most active members and command usage.

## File Structure

- `index.js`: Main entry point for the bot.
- `sync-version.js`: Syncs the bot version from `package.json` to `version.js`.
- `restrictedMode.js`: Handles restricted mode functionality.
- `security.js`: Handles security-related functionalities, such as restoring admin rights.
- `messageHandler.js`: Handles incoming messages and group participant updates.
- `protection.js`: Implements anti-link and anti-sales features.
- `logger.js`: Logging utilities.
- `messageUtils.js`: Utilities for sending messages and reactions.
- `config.js`: Configuration file.
- `supabaseClient.js`: Supabase client setup.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

This project is licensed under the MIT License.