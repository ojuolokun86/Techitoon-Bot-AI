# Techitoon-Bot-AI v2

Techitoon Bot+AI is a WhatsApp bot built using the Baileys library. This is version 2 of the bot, which includes enhanced features and improved modularity.

## Features

- Listens to incoming messages and responds to specific commands.
- Manages group participants and restores admin rights if removed.
- Maintains a Hall of Fame for community achievements.
- Restricted mode to limit command usage to the bot owner.
- Integration with Supabase for database management.

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

- The bot listens to incoming messages and responds to specific commands.
- The bot manages group participants and restores admin rights if removed.
- The bot maintains a Hall of Fame for community achievements.
- Restricted mode allows only the bot owner to execute commands when enabled.

## File Structure

- `index.js`: Main entry point for the bot.
- `restrictedMode.js`: Handles restricted mode functionality.
- `security.js`: Handles security-related functionalities, such as restoring admin rights.
- `messageHandler.js`: Handles incoming messages and group participant updates.
- `logger.js`: Logging utilities.
- `messageUtils.js`: Utilities for sending messages and reactions.
- `config.js`: Configuration file.
- `supabaseClient.js`: Supabase client setup.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

This project is licensed under the MIT License.