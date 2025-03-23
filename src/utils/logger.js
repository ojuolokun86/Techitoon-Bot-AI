const { formatMessage } = require('./utils');
const winston = require('winston');
const path = require('path');

// Create a logger instance
const logger = winston.createLogger({
    level: 'info', // Log level (e.g., 'info', 'error', 'debug')
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
    ),
    transports: [
        new winston.transports.File({
            filename: path.join(__dirname, '../../logs/bot.log'), // Path to the log file
            handleExceptions: true, // Handle uncaught exceptions
        }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ level, message }) => `${level}: ${message}`)
            ),
        }),
    ],
});

const logInfo = (message) => {
    console.log(`ℹ️ INFO: ${formatMessage(message)}`);
};

const logWarning = (message) => {
    console.warn(`⚠️ WARNING: ${formatMessage(message)}`);
};

const logError = (message) => {
    console.error(`❌ ERROR: ${formatMessage(message)}`);
};

const logDebug = (message) => {
    console.debug(`🐞 DEBUG: ${formatMessage(message)}`);
};

const logSuccess = (message) => {
    console.log(`✅ SUCCESS: ${formatMessage(message)}`);
};

module.exports = {
    logInfo,
    logWarning,
    logError,
    logDebug,
    logSuccess,
    logger,
};
