const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

class WebhookService {
    constructor() {
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second
        this.timeout = 10000; // 10 seconds
    }

    async send(payload, retryCount = 0) {
        try {
            logger.info('🔔 Sending webhook...');
            logger.debug('Webhook payload:', JSON.stringify(payload, null, 2));

            const response = await axios.post(config.webhook.url, payload, {
                timeout: this.timeout,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Twitter-Mention-Bot/1.0',
                    'X-Bot-Name': 'twitter-mention-bot',
                    'X-Event-Type': 'twitter_mention'
                }
            });

            logger.info(`✅ Webhook sent successfully! Status: ${response.status}`);
            logger.debug('Webhook response:', {
                status: response.status,
                statusText: response.statusText,
                data: response.data
            });

            return {
                success: true,
                status: response.status,
                data: response.data
            };

        } catch (error) {
            logger.error(`❌ Webhook failed (attempt ${retryCount + 1}/${this.maxRetries + 1}):`, {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data
            });

            // Retry logic with exponential backoff
            if (retryCount < this.maxRetries) {
                const delay = this.retryDelay * Math.pow(2, retryCount);
                logger.info(`⏱️ Retrying webhook in ${delay}ms...`);

                await this.sleep(delay);
                return this.send(payload, retryCount + 1);
            }

            // Max retries exceeded
            logger.error('❌ Max webhook retries exceeded');

            return {
                success: false,
                error: error.message,
                status: error.response?.status,
                retries: retryCount + 1
            };
        }
    }

    async sendTest() {
        const testPayload = {
            event: 'test',
            timestamp: new Date().toISOString(),
            message: 'Twitter Mention Bot test webhook',
            bot_info: {
                version: '1.0.0',
                target_user: config.twitter.targetUsername,
                status: 'testing'
            }
        };

        logger.info('🧪 Sending test webhook...');
        return this.send(testPayload);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    validateWebhookUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch (error) {
            return false;
        }
    }

    getWebhookInfo() {
        return {
            url: config.webhook.url,
            isValid: this.validateWebhookUrl(config.webhook.url),
            timeout: this.timeout,
            maxRetries: this.maxRetries
        };
    }
}

module.exports = WebhookService;