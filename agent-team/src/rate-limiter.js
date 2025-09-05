import winston from 'winston';

/**
 * Rate limiter to manage Claude API usage and respect limits
 */
export class RateLimiter {
  constructor(config = {}) {
    this.requestsPerMinute = config.requestsPerMinute || 50;
    this.requestsPerHour = config.requestsPerHour || 1000;
    this.requestsPerDay = config.requestsPerDay || 10000;

    // Tracking windows
    this.minuteWindow = [];
    this.hourWindow = [];
    this.dayWindow = [];

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [RateLimiter] ${level}: ${message}`;
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/rate-limiter.log' }),
      ],
    });

    // Clean up old requests periodically
    setInterval(() => this.cleanup(), 60000); // Every minute
  }

  /**
   * Check if we can make a request without exceeding limits
   */
  async checkLimit() {
    const now = Date.now();

    // Clean up old requests
    this.cleanup();

    // Check limits
    if (this.minuteWindow.length >= this.requestsPerMinute) {
      const waitTime = 60000 - (now - this.minuteWindow[0]);
      this.logger.warn(
        `Rate limit reached for minute window. Waiting ${waitTime}ms`
      );
      await this.wait(waitTime);
      return this.checkLimit(); // Recursive check after waiting
    }

    if (this.hourWindow.length >= this.requestsPerHour) {
      const waitTime = 3600000 - (now - this.hourWindow[0]);
      this.logger.warn(
        `Rate limit reached for hour window. Waiting ${waitTime}ms`
      );
      await this.wait(waitTime);
      return this.checkLimit();
    }

    if (this.dayWindow.length >= this.requestsPerDay) {
      const waitTime = 86400000 - (now - this.dayWindow[0]);
      this.logger.warn(
        `Rate limit reached for day window. Waiting ${waitTime}ms`
      );
      await this.wait(waitTime);
      return this.checkLimit();
    }

    // Record the request
    this.recordRequest(now);
    return true;
  }

  /**
   * Record a new request
   */
  recordRequest(timestamp = Date.now()) {
    this.minuteWindow.push(timestamp);
    this.hourWindow.push(timestamp);
    this.dayWindow.push(timestamp);
  }

  /**
   * Clean up old requests outside the time windows
   */
  cleanup() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;
    const oneDayAgo = now - 86400000;

    // Remove requests older than 1 minute
    this.minuteWindow = this.minuteWindow.filter(
      timestamp => timestamp > oneMinuteAgo
    );

    // Remove requests older than 1 hour
    this.hourWindow = this.hourWindow.filter(
      timestamp => timestamp > oneHourAgo
    );

    // Remove requests older than 1 day
    this.dayWindow = this.dayWindow.filter(timestamp => timestamp > oneDayAgo);
  }

  /**
   * Wait for specified milliseconds
   */
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current rate limiter status
   */
  getStatus() {
    this.cleanup();

    return {
      limits: {
        requestsPerMinute: this.requestsPerMinute,
        requestsPerHour: this.requestsPerHour,
        requestsPerDay: this.requestsPerDay,
      },
      current: {
        requestsThisMinute: this.minuteWindow.length,
        requestsThisHour: this.hourWindow.length,
        requestsThisDay: this.dayWindow.length,
      },
      remaining: {
        requestsThisMinute: this.requestsPerMinute - this.minuteWindow.length,
        requestsThisHour: this.requestsPerHour - this.hourWindow.length,
        requestsThisDay: this.requestsPerDay - this.dayWindow.length,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Update rate limits
   */
  updateLimits(config) {
    if (config.requestsPerMinute)
      this.requestsPerMinute = config.requestsPerMinute;
    if (config.requestsPerHour) this.requestsPerHour = config.requestsPerHour;
    if (config.requestsPerDay) this.requestsPerDay = config.requestsPerDay;

    this.logger.info(
      `Rate limits updated: ${JSON.stringify(this.getStatus().limits)}`
    );
  }

  /**
   * Reset all counters (use with caution)
   */
  reset() {
    this.minuteWindow = [];
    this.hourWindow = [];
    this.dayWindow = [];
    this.logger.info('Rate limiter reset');
  }
}
