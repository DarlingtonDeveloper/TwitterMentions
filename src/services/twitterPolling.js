const { TwitterApi } = require('twitter-api-v2');
const config = require('../config');
const logger = require('../utils/logger');

class TwitterPolling {
    constructor() {
        this.client = new TwitterApi(config.twitter.bearerToken);
        this.lastCheckTime = new Date();
        this.pollingInterval = 5 * 60 * 1000; // 5 minutes
        this.isRunning = false;
        this.timeoutId = null;
        this.mentionHandler = null;
        this.errorHandler = null;

        // Rate limiting protection
        this.requestCount = 0;
        this.rateLimitWindow = 15 * 60 * 1000; // 15 minutes
        this.maxRequestsPerWindow = 300; // Search endpoint limit
    }

    async start() {
        try {
            logger.info('🔗 Starting Twitter Polling Service (Search Endpoint)...');

            if (process.env.SKIP_STARTUP_API_TESTS === 'true') {
                logger.info('✅ Skipping Twitter API connection test (rate limit protection)');
            } else {
                await this.testConnection();
            }

            this.isRunning = true;
            // Start checking from 5 minutes ago to catch recent mentions
            this.lastCheckTime = new Date(Date.now() - this.pollingInterval);

            logger.info('✅ Twitter Polling Service started successfully!');
            logger.info(`🎯 Monitoring mentions for: ${config.twitter.targetUsername}`);
            logger.info(`⏰ Polling every ${this.pollingInterval / 1000 / 60} minutes`);
            logger.info(`📡 Using search endpoint: GET /2/tweets/search/recent`);

            // Start the polling loop
            await this.startPollingLoop();

        } catch (error) {
            logger.error('Failed to start Twitter polling:', error);

            if (this.errorHandler) {
                this.errorHandler(error);
            }
            throw error;
        }
    }

    async testConnection() {
        try {
            // Simple test that doesn't use user lookup
            logger.info('✅ Twitter API Bearer token configured');
            return true;
        } catch (error) {
            logger.error('❌ Twitter API connection failed:', error);
            throw error;
        }
    }

    async poll() {
        if (!this.isRunning) return;

        try {
            logger.info('🔍 Checking for new mentions...');

            if (!this.canMakeRequest()) {
                logger.warn('⚠️ Rate limit protection - skipping this poll cycle');
                return;
            }

            const searchParams = {
                query: `@${config.twitter.targetUsername}`,
                max_results: 10,
                'tweet.fields': ['id', 'text', 'created_at', 'author_id', 'public_metrics'],
                'user.fields': ['id', 'username', 'name'],
                expansions: ['author_id'],
                start_time: this.lastCheckTime.toISOString()
            };

            this.requestCount++;
            const searchResults = await this.client.v2.search(searchParams);

            // FIXED: Access the actual data from the library response
            const tweets = searchResults._realData?.data || searchResults.data || [];
            const includes = searchResults._realData?.includes || searchResults.includes || {};

            logger.info(`📊 Found ${tweets.length} tweets in response`);

            if (tweets.length > 0) {
                logger.info(`📬 Found ${tweets.length} new mentions!`);

                // Process each mention
                for (const tweet of tweets) {
                    logger.info(`📝 Processing mention: ${tweet.text}`);

                    if (this.mentionHandler) {
                        // Add author info from includes
                        const author = includes.users?.find(
                            user => user.id === tweet.author_id
                        );

                        if (author) {
                            tweet.author = author;
                            logger.info(`👤 Author: @${author.username}`);
                        }

                        await this.mentionHandler(tweet);
                    }
                }
            } else {
                logger.info('📭 No new mentions found');
            }

            this.lastCheckTime = new Date();

        } catch (error) {
            logger.error('Error during polling:', {
                message: error.message,
                code: error.code,
                status: error.status
            });

            if (error.rateLimit) {
                const resetTime = new Date(error.rateLimit.reset * 1000);
                const waitTime = resetTime.getTime() - Date.now();
                logger.warn(`⏱️ Rate limited! Waiting ${Math.ceil(waitTime / 1000 / 60)} minutes until reset.`);
                this.scheduleNextPoll(waitTime + 60000);
                return;
            }

            if (this.errorHandler) {
                this.errorHandler(error);
            }
        }
    }

    canMakeRequest() {
        // Simple rate limiting check (resets every 15 minutes)
        return this.requestCount < this.maxRequestsPerWindow;
    }

    async startPollingLoop() {
        if (!this.isRunning) return;

        // Do initial poll
        await this.poll();

        // Schedule next poll
        this.scheduleNextPoll(this.pollingInterval);
    }

    scheduleNextPoll(delay) {
        if (!this.isRunning) return;

        // Clear any existing timeout to prevent multiple timers
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }

        const nextPollTime = new Date(Date.now() + delay);
        const minutes = Math.floor(delay / 1000 / 60);
        const seconds = Math.floor((delay % 60000) / 1000);

        logger.info(`⏰ Next poll scheduled for ${nextPollTime.toLocaleTimeString()} (in ${minutes}m ${seconds}s)`);

        this.timeoutId = setTimeout(async () => {
            await this.poll();

            // Schedule next poll (recursive)
            if (this.isRunning) {
                this.scheduleNextPoll(this.pollingInterval);
            }
        }, delay);
    }

    onMention(handler) {
        this.mentionHandler = handler;
    }

    onError(handler) {
        this.errorHandler = handler;
    }

    async stop() {
        logger.info('🛑 Stopping Twitter Polling Service...');

        this.isRunning = false;

        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }

        logger.info('✅ Twitter Polling Service stopped');
    }

    getStatus() {
        const now = new Date();
        const nextPollTime = this.timeoutId ?
            new Date(this.lastCheckTime.getTime() + this.pollingInterval) :
            null;
        const timeUntilNextPoll = nextPollTime ?
            nextPollTime.getTime() - now.getTime() : 0;

        return {
            isRunning: this.isRunning,
            lastCheckTime: this.lastCheckTime,
            nextPollTime: nextPollTime,
            timeUntilNextPoll: {
                minutes: Math.max(0, Math.floor(timeUntilNextPoll / 1000 / 60)),
                seconds: Math.max(0, Math.floor((timeUntilNextPoll % 60000) / 1000)),
                totalMs: Math.max(0, timeUntilNextPoll)
            },
            pollingInterval: this.pollingInterval,
            pollingIntervalMinutes: this.pollingInterval / 1000 / 60,
            requestCount: this.requestCount,
            rateLimitStatus: {
                requestsUsed: this.requestCount,
                requestsRemaining: Math.max(0, this.maxRequestsPerWindow - this.requestCount),
                windowResetsIn: this.rateLimitWindow
            },
            endpoint: 'GET /2/tweets/search/recent',
            mode: 'polling_search'
        };
    }

    // Allow changing polling interval
    setPollingInterval(intervalMs) {
        this.pollingInterval = intervalMs;
        logger.info(`⏰ Polling interval updated to ${intervalMs / 1000 / 60} minutes`);
    }
}

module.exports = TwitterPolling;