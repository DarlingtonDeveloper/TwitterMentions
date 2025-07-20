// src/test.js
const WebhookService = require('./services/webhook');
const config = require('./config');
const logger = require('./utils/logger');

async function runTests() {
    logger.info('🧪 Running TwitterMentions Tests...');

    try {
        // Test 1: Configuration validation
        logger.info('📋 Test 1: Configuration validation');
        if (!config.twitter.bearerToken || config.twitter.bearerToken === 'your_bearer_token_here') {
            throw new Error('Twitter Bearer Token not configured');
        }
        if (!config.twitter.targetUsername || config.twitter.targetUsername === 'your_target_username') {
            throw new Error('Twitter Target Username not configured');
        }
        if (!config.webhook.url || config.webhook.url.includes('your-unique-id')) {
            throw new Error('Webhook URL not configured');
        }
        logger.info('✅ Configuration is valid');

        // Test 2: Webhook connectivity
        logger.info('🔔 Test 2: Webhook connectivity');
        const webhookService = new WebhookService();
        const webhookInfo = webhookService.getWebhookInfo();
        logger.info('Webhook info:', webhookInfo);

        if (!webhookInfo.isValid) {
            throw new Error('Webhook URL is not valid');
        }
        logger.info('✅ Webhook URL is valid');

        // Test 3: Send test webhook
        logger.info('📤 Test 3: Sending test webhook...');
        const testResult = await webhookService.sendTest();

        if (testResult.success) {
            logger.info('✅ Test webhook sent successfully!');
            logger.info(`Response status: ${testResult.status}`);
        } else {
            throw new Error(`Test webhook failed: ${testResult.error}`);
        }

        // Test 4: Simulate mention webhook
        logger.info('🐦 Test 4: Sending simulated mention webhook...');
        const mockTweet = {
            event: 'twitter_mention',
            timestamp: new Date().toISOString(),
            tweet: {
                id: '1234567890123456789',
                text: `Hey @${config.twitter.targetUsername}, this is a test mention from the bot test script!`,
                author: {
                    id: '987654321',
                    username: 'test_user',
                    name: 'Test User'
                },
                created_at: new Date().toISOString(),
                public_metrics: {
                    retweet_count: 0,
                    like_count: 1,
                    reply_count: 0,
                    quote_count: 0
                },
                url: 'https://twitter.com/test_user/status/1234567890123456789'
            },
            bot_info: {
                target_user: config.twitter.targetUsername,
                processed_at: new Date().toISOString(),
                test_mode: true
            }
        };

        const mentionResult = await webhookService.send(mockTweet);

        if (mentionResult.success) {
            logger.info('✅ Simulated mention webhook sent successfully!');
            logger.info(`Response status: ${mentionResult.status}`);
        } else {
            throw new Error(`Simulated mention webhook failed: ${mentionResult.error}`);
        }

        logger.info('🎉 All tests passed successfully!');
        logger.info('');
        logger.info('📝 Next steps:');
        logger.info('1. Check your webhook.site page to see the test webhooks');
        logger.info('2. Start the bot with: npm start');
        logger.info('3. Mention your target user from another Twitter account to test live');
        logger.info('');

        process.exit(0);

    } catch (error) {
        logger.error('❌ Test failed:', error.message);
        logger.info('');
        logger.info('🔧 To fix this:');
        logger.info('1. Make sure your .env file is configured correctly');
        logger.info('2. Check that TWITTER_BEARER_TOKEN is valid');
        logger.info('3. Verify WEBHOOK_URL is from webhook.site');
        logger.info('4. Ensure TWITTER_TARGET_USERNAME is correct (no @ symbol)');
        logger.info('');
        process.exit(1);
    }
}

// Helper function to test Twitter API connection
async function testTwitterConnection() {
    try {
        const { TwitterApi } = require('twitter-api-v2');
        const client = new TwitterApi(config.twitter.bearerToken);

        // Test the connection by getting rate limit status
        const rateLimit = await client.v2.get('tweets/search/recent', {
            query: 'test',
            max_results: 1
        });

        logger.info('✅ Twitter API connection successful');
        return true;
    } catch (error) {
        logger.error('❌ Twitter API connection failed:', error.message);
        return false;
    }
}

// Add Twitter connection test if --twitter flag is provided
if (process.argv.includes('--twitter')) {
    logger.info('🐦 Testing Twitter API connection...');
    testTwitterConnection().then((success) => {
        if (success) {
            runTests();
        } else {
            logger.error('Twitter API connection failed. Check your TWITTER_BEARER_TOKEN.');
            process.exit(1);
        }
    });
} else {
    runTests();
}

module.exports = { runTests, testTwitterConnection };