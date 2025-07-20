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

    // Polling Configuration (NEW)
    polling: {
        interval: parseInt(process.env.POLLING_INTERVAL) || 5 * 60 * 1000, // 5 minutes default
        maxResults: parseInt(process.env.POLLING_MAX_RESULTS) || 10,
        rateLimitBuffer: parseInt(process.env.RATE_LIMIT_BUFFER) || 50, // Stay 50 requests below limit
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

    // Validate polling configuration
    if (isNaN(config.polling.interval) || config.polling.interval < 60000) {
        errors.push('POLLING_INTERVAL must be at least 60000ms (1 minute)');
    }

    if (isNaN(config.polling.maxResults) || config.polling.maxResults < 1 || config.polling.maxResults > 100) {
        errors.push('POLLING_MAX_RESULTS must be between 1 and 100');
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
    console.log('📋 Configuration loaded (Polling Mode):', JSON.stringify(safeConfig, null, 2));
}

module.exports = config;