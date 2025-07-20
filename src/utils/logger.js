// src/utils/logger.js
const config = require('../config');

class Logger {
    constructor() {
        this.logLevel = this.getLogLevelNumber(config.logging.level);
        this.format = config.logging.format;
    }

    getLogLevelNumber(level) {
        const levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
        return levels[level.toLowerCase()] || 2;
    }

    formatMessage(level, message, meta = null) {
        const timestamp = new Date().toISOString();

        if (this.format === 'json') {
            return JSON.stringify({
                timestamp,
                level: level.toUpperCase(),
                message,
                ...(meta && { meta }),
                service: 'TwitterMentions'
            });
        }

        // Combined format (human readable)
        const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
    }

    log(level, message, meta = null) {
        const levelNumber = this.getLogLevelNumber(level);

        if (levelNumber <= this.logLevel) {
            const formattedMessage = this.formatMessage(level, message, meta);

            if (level === 'error') {
                console.error(formattedMessage);
            } else if (level === 'warn') {
                console.warn(formattedMessage);
            } else {
                console.log(formattedMessage);
            }
        }
    }

    error(message, meta = null) {
        this.log('error', message, meta);
    }

    warn(message, meta = null) {
        this.log('warn', message, meta);
    }

    info(message, meta = null) {
        this.log('info', message, meta);
    }

    debug(message, meta = null) {
        this.log('debug', message, meta);
    }

    // Special method for startup banner
    banner() {
        const banner = `
╔══════════════════════════════════════════════════════════════╗
║                       🐦 TwitterMentions                     ║
║                         Version 1.0.0                       ║
╠══════════════════════════════════════════════════════════════╣
║  Real-time Twitter mention detection with webhook delivery  ║
║                                                              ║
║  📡 Streaming API: Real-time mentions (no rate limits!)     ║
║  🔔 Webhooks: Instant notification delivery                 ║
║  🐳 Docker: Containerized deployment                        ║
║  🔄 Auto-reconnect: Resilient connection handling           ║
╚══════════════════════════════════════════════════════════════╝
    `;
        console.log(banner);
    }
}

// Create singleton instance
const logger = new Logger();

// Log startup banner
if (require.main === module.parent) {
    logger.banner();
}

module.exports = logger;