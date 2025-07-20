const { TwitterApi, ETwitterStreamEvent } = require('twitter-api-v2');
const config = require('../config');
const logger = require('../utils/logger');

class TwitterStream {
    constructor() {
        this.client = new TwitterApi(config.twitter.bearerToken);
        this.stream = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 1000; // Start with 1 second
        this.isConnected = false;
        this.mentionHandler = null;
        this.errorHandler = null;
        this.reconnectHandler = null;
    }

    async start() {
        try {
            logger.info('🔗 Connecting to Twitter Streaming API...');

            // First, set up stream rules for mentions
            await this.setupStreamRules();

            // Create the filtered stream
            this.stream = await this.client.v2.searchStream({
                'tweet.fields': ['id', 'text', 'created_at', 'author_id', 'public_metrics'],
                'user.fields': ['id', 'username', 'name', 'verified'],
                'expansions': ['author_id']
            });

            // Set up event handlers
            this.setupEventHandlers();

            logger.info('✅ Connected to Twitter stream successfully!');
            this.isConnected = true;
            this.reconnectAttempts = 0;

        } catch (error) {
            logger.error('Failed to start Twitter stream:', error);

            if (this.shouldReconnect()) {
                await this.attemptReconnect();
            } else {
                throw error;
            }
        }
    }

    async setupStreamRules() {
        try {
            // Get existing rules
            const existingRules = await this.client.v2.streamRules();

            // Delete existing rules if any
            if (existingRules.data?.length > 0) {
                await this.client.v2.updateStreamRules({
                    delete: {
                        ids: existingRules.data.map(rule => rule.id)
                    }
                });
                logger.info(`🗑️ Deleted ${existingRules.data.length} existing stream rules`);
            }

            // Add new rule for mentions
            const mentionRule = `@${config.twitter.targetUsername}`;

            const addedRules = await this.client.v2.updateStreamRules({
                add: [
                    { value: mentionRule, tag: 'mentions' }
                ]
            });

            logger.info(`📋 Added stream rule: "${mentionRule}"`);

            if (addedRules.errors?.length > 0) {
                logger.warn('Rule creation warnings:', addedRules.errors);
            }

        } catch (error) {
            logger.error('Failed to setup stream rules:', error);
            throw error;
        }
    }

    setupEventHandlers() {
        if (!this.stream) return;

        // Handle incoming tweets
        this.stream.on(ETwitterStreamEvent.Data, (tweet) => {
            this.handleTweet(tweet);
        });

        // Handle connection events
        this.stream.on(ETwitterStreamEvent.Connected, () => {
            logger.info('🟢 Stream connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;
        });

        this.stream.on(ETwitterStreamEvent.ConnectionClosed, () => {
            logger.warn('🔴 Stream connection closed');
            this.isConnected = false;

            if (this.shouldReconnect()) {
                this.attemptReconnect();
            }
        });

        this.stream.on(ETwitterStreamEvent.ConnectionError, (error) => {
            logger.error('🔴 Stream connection error:', error);
            this.isConnected = false;

            if (this.errorHandler) {
                this.errorHandler(error);
            }

            if (this.shouldReconnect()) {
                this.attemptReconnect();
            }
        });

        this.stream.on(ETwitterStreamEvent.ConnectionLost, () => {
            logger.warn('🔴 Stream connection lost');
            this.isConnected = false;

            if (this.shouldReconnect()) {
                this.attemptReconnect();
            }
        });

        this.stream.on(ETwitterStreamEvent.ReconnectAttempt, (attempt) => {
            logger.info(`🔄 Reconnect attempt #${attempt}`);

            if (this.reconnectHandler) {
                this.reconnectHandler(attempt);
            }
        });

        this.stream.on(ETwitterStreamEvent.Reconnected, () => {
            logger.info('🟢 Stream reconnected successfully');
            this.isConnected = true;
            this.reconnectAttempts = 0;
        });

        this.stream.on(ETwitterStreamEvent.DataKeepAlive, () => {
            logger.debug('💓 Keep-alive received');
        });

        // Handle stream errors
        this.stream.on(ETwitterStreamEvent.TweetParseError, (error) => {
            logger.error('Tweet parse error:', error);
        });

        this.stream.on(ETwitterStreamEvent.ReconnectError, (attempt) => {
            logger.error(`❌ Reconnect attempt ${attempt} failed`);
            this.reconnectAttempts = attempt;
        });

        this.stream.on(ETwitterStreamEvent.ReconnectLimitExceeded, () => {
            logger.error('❌ Reconnect limit exceeded');
            if (this.errorHandler) {
                this.errorHandler(new Error('Reconnect limit exceeded'));
            }
        });
    }

    handleTweet(tweet) {
        try {
            // Add author information from includes
            if (tweet.includes?.users?.length > 0) {
                const author = tweet.includes.users.find(user => user.id === tweet.data.author_id);
                if (author) {
                    tweet.data.author = author;
                }
            }

            logger.debug('📨 Received tweet:', {
                id: tweet.data.id,
                text: tweet.data.text.substring(0, 100) + '...',
                author: tweet.data.author?.username
            });

            // Call mention handler if set
            if (this.mentionHandler) {
                this.mentionHandler(tweet.data);
            }

        } catch (error) {
            logger.error('Error handling tweet:', error);
        }
    }

    shouldReconnect() {
        return this.reconnectAttempts < this.maxReconnectAttempts;
    }

    async attemptReconnect() {
        if (!this.shouldReconnect()) {
            logger.error('❌ Max reconnect attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 60000); // Max 1 minute

        logger.info(`⏱️ Waiting ${delay}ms before reconnect attempt ${this.reconnectAttempts}...`);

        setTimeout(async () => {
            try {
                await this.start();
            } catch (error) {
                logger.error(`Reconnect attempt ${this.reconnectAttempts} failed:`, error);
            }
        }, delay);
    }

    onMention(handler) {
        this.mentionHandler = handler;
    }

    onError(handler) {
        this.errorHandler = handler;
    }

    onReconnect(handler) {
        this.reconnectHandler = handler;
    }

    async stop() {
        if (this.stream) {
            logger.info('🛑 Stopping Twitter stream...');

            try {
                // Clean up stream rules
                const existingRules = await this.client.v2.streamRules();
                if (existingRules.data?.length > 0) {
                    await this.client.v2.updateStreamRules({
                        delete: {
                            ids: existingRules.data.map(rule => rule.id)
                        }
                    });
                }
            } catch (error) {
                logger.warn('Error cleaning up stream rules:', error);
            }

            this.stream.close();
            this.stream = null;
            this.isConnected = false;
        }
    }

    getStatus() {
        return {
            isConnected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            hasStream: !!this.stream
        };
    }
}

module.exports = TwitterStream;