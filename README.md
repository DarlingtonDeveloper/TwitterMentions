# 🐦 TwitterMentions

Real-time Twitter mention detection bot with webhook delivery. This bot uses Twitter's Streaming API to monitor mentions in real-time and immediately sends webhook notifications - **no rate limiting issues!**

## ✨ Features

- 🚀 **Real-time mentions** - Uses Twitter Streaming API (no polling!)
- 🔔 **Instant webhooks** - Immediate notification delivery to webhook.site
- 🔄 **Auto-reconnect** - Resilient connection handling with exponential backoff
- 🐳 **Docker ready** - Containerized deployment with health checks
- 📊 **Health monitoring** - Built-in health check endpoints
- 🔧 **Highly configurable** - Environment-based configuration
- 📝 **Comprehensive logging** - Structured logging with multiple formats

## 🚀 Quick Start

### 1. Get Your Twitter Bearer Token

1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create a new App or use an existing one
3. Go to "Keys and tokens" tab
4. Generate/copy your "Bearer Token"

### 2. Get Your Webhook URL

1. Go to [webhook.site](https://webhook.site/)
2. Copy the unique URL (e.g., `https://webhook.site/8f5a2b1c-3d4e-5f6g-7h8i-9j0k1l2m3n4o`)
3. Keep the page open to see incoming webhooks

### 3. Clone and Configure

```bash
# Clone the repository
git clone <repository-url>
cd TwitterMentions

# Copy environment template
cp .env.example .env

# Edit .env with your values
nano .env
```

### 4. Run with Docker (Recommended)

```bash
# Build and run with docker-compose
docker-compose up --build

# Or run in background
docker-compose up -d --build
```

### 5. Run with Node.js

```bash
# Install dependencies
npm install

# Run the bot
npm start

# Or run in development mode
npm run dev
```

## 📋 Configuration

### Required Environment Variables

```bash
# Twitter API Bearer Token
TWITTER_BEARER_TOKEN=your_bearer_token_here

# Username to monitor (without @)
TWITTER_TARGET_USERNAME=your_target_username

# Webhook URL from webhook.site
WEBHOOK_URL=https://webhook.site/your-unique-id
```

### Optional Configuration

```bash
# Application Settings
NODE_ENV=production
PORT=3000
LOG_LEVEL=info                    # error, warn, info, debug
LOG_FORMAT=json                   # json or combined

# Stream Configuration
STREAM_RECONNECT_ATTEMPTS=10      # Max reconnection attempts
STREAM_RECONNECT_DELAY=1000       # Initial reconnect delay (ms)
STREAM_KEEPALIVE_TIMEOUT=20000    # Keep-alive timeout (ms)

# Webhook Configuration
WEBHOOK_TIMEOUT=10000             # Request timeout (ms)
WEBHOOK_RETRIES=3                 # Max retry attempts
WEBHOOK_RETRY_DELAY=1000          # Initial retry delay (ms)

# Health Check
HEALTH_CHECK_ENABLED=true         # Enable health check endpoint
```

## 🔍 Monitoring

### Health Check

The bot provides health check endpoints for monitoring:

```bash
# Basic health check
curl http://localhost:3000/health

# Bot information
curl http://localhost:3000/
```

### Docker Health Check

The Docker container includes built-in health checks:

```bash
# Check container health
docker ps

# View health check logs
docker inspect TwitterMentions | grep Health -A 10
```

### Log Monitoring

View logs in real-time:

```bash
# Docker logs
docker-compose logs -f TwitterMentions

# Or with log viewer (development)
docker-compose --profile dev up -d
# Then visit http://localhost:9999 for web-based log viewer
```

## 📊 Webhook Payload

When a mention is detected, the bot sends a webhook with this structure:

```json
{
  "event": "twitter_mention",
  "timestamp": "2025-07-20T10:30:00.000Z",
  "tweet": {
    "id": "1234567890123456789",
    "text": "Hey @your_username, this is a test mention!",
    "author": {
      "id": "987654321",
      "username": "mentioning_user",
      "name": "User Name"
    },
    "created_at": "2025-07-20T10:29:45.000Z",
    "public_metrics": {
      "retweet_count": 0,
      "like_count": 1,
      "reply_count": 0,
      "quote_count": 0
    },
    "url": "https://twitter.com/mentioning_user/status/1234567890123456789"
  },
  "bot_info": {
    "target_user": "your_username",
    "processed_at": "2025-07-20T10:30:00.000Z"
  }
}
```

## 🐳 Docker Deployment

### Simple Docker Run

```bash
# Build the image
docker build -t TwitterMentions .

# Run the container
docker run --env-file .env -p 3000:3000 TwitterMentions
```

### Docker Compose (Recommended)

```bash
# Full deployment with monitoring
docker-compose up -d

# Development mode with log viewer
docker-compose --profile dev up -d

# Scale if needed
docker-compose up --scale TwitterMentions=2 -d
```

### Production Deployment

For production, consider:

1. **Resource limits** - Already configured in docker-compose.yml
2. **Log rotation** - Configured with max size limits
3. **Restart policies** - Set to `unless-stopped`
4. **Health monitoring** - Built-in health checks
5. **Security** - Runs as non-root user

## 🔧 Development

### Local Development

```bash
# Install dependencies
npm install

# Run in development mode with auto-reload
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

### Testing Webhooks

```bash
# Send a test webhook
curl -X POST http://localhost:3000/test-webhook

# Or use the webhook service directly
node -e "
const WebhookService = require('./src/services/webhook');
const webhook = new WebhookService();
webhook.sendTest().then(console.log);
"
```

## 🚨 Troubleshooting

### Common Issues

1. **Rate Limited**
   - This bot uses Streaming API, so rate limits shouldn't be an issue
   - If you get rate limited, check your Bearer Token permissions

2. **Connection Issues**
   - The bot auto-reconnects with exponential backoff
   - Check your internet connection and Twitter API status

3. **No Mentions Detected**
   - Verify your `TWITTER_TARGET_USERNAME` is correct (no @ symbol)
   - Check that your account is public
   - Test by mentioning yourself from another account

4. **Webhook Not Working**
   - Verify your `WEBHOOK_URL` is correct
   - Check webhook.site page is still open
   - Look for webhook retry attempts in logs

### Debugging

Enable debug logging:

```bash
# Set in .env
LOG_LEVEL=debug

# Or as environment variable
LOG_LEVEL=debug npm start
```

### Health Check Issues

```bash
# Check if health endpoint is responding
curl -f http://localhost:3000/health

# View detailed health information
curl -s http://localhost:3000/health | jq .
```

## 📈 Performance

### Streaming vs Polling

This bot uses Twitter's Streaming API instead of polling, which provides:

- ⚡ **Real-time delivery** - Mentions arrive within seconds
- 🚫 **No rate limits** - Stream connections don't count against rate limits
- 💰 **Cost effective** - Uses fewer API calls
- 🔋 **Efficient** - Lower resource usage than constant polling

### Resource Usage

Typical resource usage:
- **Memory**: ~50-100MB
- **CPU**: <1% most of the time
- **Network**: Minimal (just the stream connection)

## 🛡️ Security

The bot follows security best practices:

- ✅ Runs as non-root user in Docker
- ✅ No sensitive data in logs
- ✅ Environment variable configuration
- ✅ Input validation and error handling
- ✅ Graceful shutdown handling

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if needed
5. Submit a pull request

## 📞 Support

- **Issues**: Open a GitHub issue
- **Questions**: Check existing issues or open a new discussion
- **Security**: Email security issues privately

---

Made with ❤️ for real-time Twitter monitoring!