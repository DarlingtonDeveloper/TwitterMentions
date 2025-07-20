const TwitterPolling = require('./services/twitterPolling');
const WebhookService = require('./services/webhook');
const config = require('./config');
const logger = require('./utils/logger');
const express = require('express');

class TwitterMentionBot {
    constructor() {
        this.twitterPolling = new TwitterPolling();
        this.webhookService = new WebhookService();
        this.isRunning = false;
        this.app = express();
        this.server = null;

        // Setup health check endpoint
        this.setupHealthCheck();
    }

    setupHealthCheck() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            const pollingStatus = this.twitterPolling.getStatus();
            const webhookInfo = this.webhookService.getWebhookInfo();

            const health = {
                status: this.isRunning ? 'healthy' : 'unhealthy',
                timestamp: new Date().toISOString(),
                version: config.app.version,
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                polling: pollingStatus,
                webhook: webhookInfo,
                config: {
                    targetUser: config.twitter.targetUsername,
                    logLevel: config.logging.level,
                    nodeEnv: config.app.nodeEnv,
                    mode: 'polling'
                }
            };

            const statusCode = health.status === 'healthy' ? 200 : 503;
            res.status(statusCode).json(health);
        });

        // Basic info endpoint
        this.app.get('/', (req, res) => {
            res.json({
                name: config.app.name,
                version: config.app.version,
                description: 'Real-time Twitter mention detection bot (Polling Mode)',
                status: this.isRunning ? 'running' : 'stopped',
                targetUser: config.twitter.targetUsername,
                mode: 'polling',
                pollingInterval: `${this.twitterPolling.pollingInterval / 1000 / 60} minutes`
            });
        });

        // Test webhook endpoint
        this.app.post('/test-webhook', async (req, res) => {
            try {
                logger.info('🧪 Manual webhook test requested');
                const testResult = await this.webhookService.sendTest();

                res.json({
                    success: testResult.success,
                    message: testResult.success ? 'Test webhook sent successfully!' : 'Test webhook failed',
                    details: testResult
                });
            } catch (error) {
                logger.error('Test webhook error:', error);
                res.status(500).json({
                    success: false,
                    message: 'Test webhook failed',
                    error: error.message
                });
            }
        });
    }

    async start() {
        try {
            logger.info('🚀 Starting Twitter Mention Bot (Polling Mode)...');

            // Validate configuration
            this.validateConfig();

            // Start health check server
            if (config.health.enabled) {
                await this.startHealthServer();
            }

            // Set up mention handler
            this.twitterPolling.onMention(async (tweet) => {
                await this.handleMention(tweet);
            });

            // Set up error handlers
            this.twitterPolling.onError((error) => {
                logger.error('Twitter polling error:', error);
            });

            // Start the polling service
            await this.twitterPolling.start();
            this.isRunning = true;

            logger.info('✅ Twitter Mention Bot is now running in polling mode!');
            logger.info(`🎯 Monitoring mentions for user: ${config.twitter.targetUsername}`);
            logger.info(`⏰ Checking every ${this.twitterPolling.pollingInterval / 1000 / 60} minutes`);
            logger.info(`🔗 Webhook URL: ${config.webhook.url}`);
            if (config.health.enabled) {
                logger.info(`💚 Health check available at: http://localhost:${config.app.port}/health`);
                logger.info(`🧪 Test webhook at: http://localhost:${config.app.port}/test-webhook`);
            }

        } catch (error) {
            logger.error('Failed to start bot:', error);
            process.exit(1);
        }
    }

    async startHealthServer() {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(config.app.port, (err) => {
                if (err) {
                    reject(err);
                } else {
                    logger.info(`💚 Health check server started on port ${config.app.port}`);
                    resolve();
                }
            });
        });
    }

    async handleMention(tweet) {
        try {
            logger.info(`📬 New mention detected!`);
            logger.info(`  Tweet ID: ${tweet.id}`);
            logger.info(`  Author: @${tweet.author?.username || 'unknown'}`);
            logger.info(`  Text: ${tweet.text}`);
            logger.info(`  Created: ${tweet.created_at}`);

            // Prepare webhook payload
            const webhookPayload = {
                event: 'twitter_mention',
                timestamp: new Date().toISOString(),
                tweet: {
                    id: tweet.id,
                    text: tweet.text,
                    author: {
                        id: tweet.author?.id,
                        username: tweet.author?.username,
                        name: tweet.author?.name
                    },
                    created_at: tweet.created_at,
                    public_metrics: tweet.public_metrics,
                    url: `https://twitter.com/${tweet.author?.username}/status/${tweet.id}`
                },
                bot_info: {
                    target_user: config.twitter.targetUsername,
                    processed_at: new Date().toISOString(),
                    mode: 'polling'
                }
            };

            // Send webhook
            await this.webhookService.send(webhookPayload);

            logger.info('✅ Webhook sent successfully!');

        } catch (error) {
            logger.error('Error handling mention:', error);
        }
    }

    validateConfig() {
        const required = [
            'TWITTER_BEARER_TOKEN',
            'TWITTER_TARGET_USERNAME',
            'WEBHOOK_URL'
        ];

        const missing = required.filter(key => !process.env[key]);

        if (missing.length > 0) {
            throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
        }
    }

    async stop() {
        if (this.isRunning) {
            logger.info('🛑 Stopping Twitter Mention Bot...');

            await this.twitterPolling.stop();

            // Stop health server
            if (this.server) {
                await new Promise((resolve) => {
                    this.server.close(resolve);
                });
                logger.info('💚 Health check server stopped');
            }

            this.isRunning = false;
            logger.info('✅ Bot stopped successfully');
        }
    }
}

// Graceful shutdown handling
const bot = new TwitterMentionBot();

process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM signal');
    await bot.stop();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('Received SIGINT signal');
    await bot.stop();
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Start the bot
if (require.main === module) {
    bot.start().catch((error) => {
        logger.error('Failed to start bot:', error);
        process.exit(1);
    });
}

module.exports = TwitterMentionBot;