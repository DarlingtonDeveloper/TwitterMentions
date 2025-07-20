// src/config/index.js
require('dotenv').config();

const config = {
    // Twitter API Configuration
    twitter: {
        bearerToken: process.env.TWITTER_BEARER_TOKEN,
        targetUsername: process.env.TWITTER_TARGET_USERNAME?.replace('@', ''), // Remove @ if present
    },

    // Webhook Configuration
    webhook: {
        url: process.env.WEBHOOK_URL || 'https://webhook.site/your-unique-url',
    },

    // Application Configuration
    app: {
        name: 'TwitterMentions',
        version: '1.0.0',
        port: process.env.PORT || 3000,
        nodeEnv: process.env.NODE_ENV || 'development',
    },

    // Logging Configuration
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'combined', // 'json' or 'combined'
    },

    // Health Check Configuration
    health: {
        enabled: process.env.HEALTH_CHECK_ENABLED !== 'false',
        endpoint: '/health',
    },

    // Stream Configuration
    stream: {
        reconnectAttempts: parseInt(process.env.STREAM_RECONNECT_ATTEMPTS) || 10,
        reconnectDelay: parseInt(process.env.STREAM_RECONNECT_DELAY) || 1000,
        keepAliveTimeout: parseInt(process.env.STREAM_KEEPALIVE_TIMEOUT) || 20000,
    },

    // Webhook Configuration
    webhookConfig: {
        timeout: parseInt(process.env.WEBHOOK_TIMEOUT) || 10000,
        retries: parseInt(process.env.WEBHOOK_RETRIES) || 3,
        retryDelay: parseInt(process.env.WEBHOOK_RETRY_DELAY) || 1000,
    }
};

// Validation function
function validateConfig() {
    const errors = [];

    // Required Twitter configuration
    if (!config.twitter.bearerToken) {
        errors.push('TWITTER_BEARER_TOKEN is required');
    }

    if (!config.twitter.targetUsername) {
        errors.push('TWITTER_TARGET_USERNAME is required');
    }

    // Validate webhook URL
    if (config.webhook.url === 'https://webhook.site/your-unique-url') {
        errors.push('Please set WEBHOOK_URL to your actual webhook.site URL');
    }

    try {
        new URL(config.webhook.url);
    } catch (error) {
        errors.push('WEBHOOK_URL must be a valid URL');
    }

    // Validate numeric configurations
    if (isNaN(config.stream.reconnectAttempts) || config.stream.reconnectAttempts < 0) {
        errors.push('STREAM_RECONNECT_ATTEMPTS must be a positive number');
    }

    if (isNaN(config.stream.reconnectDelay) || config.stream.reconnectDelay < 0) {
        errors.push('STREAM_RECONNECT_DELAY must be a positive number');
    }

    if (errors.length > 0) {
        throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
}

// Auto-validate configuration
try {
    validateConfig();
} catch (error) {
    console.error('❌ Configuration Error:', error.message);
    process.exit(1);
}

// Log configuration (excluding sensitive data)
const safeConfig = {
    ...config,
    twitter: {
        ...config.twitter,
        bearerToken: config.twitter.bearerToken ? '[REDACTED]' : 'NOT_SET',
    }
};

if (config.app.nodeEnv === 'development') {
    console.log('📋 Configuration loaded:', JSON.stringify(safeConfig, null, 2));
}

module.exports = config;