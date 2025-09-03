class GlobalRateLimiter {
  constructor(config) {
    this.totalRequestsPerHour = config.totalRequestsPerHour || 100; // Conservative estimate for 5-hour limit
    this.agentQuotas = config.agentQuotas || {
      architect: 0.25, // 25% of requests
      frontend: 0.2, // 20% of requests
      backend: 0.2, // 20% of requests
      devops: 0.15, // 15% of requests
      qa: 0.1, // 10% of requests
      docs: 0.1, // 10% of requests
    };

    this.windowSize = 60 * 60 * 1000; // 1 hour in milliseconds
    this.requestHistory = new Map(); // agent -> [timestamps]
    this.redis = config.redis;

    // Priority levels for different request types
    this.priorities = {
      urgent: 1,
      normal: 2,
      background: 3,
    };
  }

  async canMakeRequest(agentRole, priority = 'normal') {
    const now = Date.now();
    const windowStart = now - this.windowSize;

    // Get agent's recent requests from Redis
    const requestKey = `rate_limit:${agentRole}`;
    const recentRequests = await this.getRecentRequests(
      requestKey,
      windowStart
    );

    // Calculate agent's quota
    const agentQuota = Math.floor(
      this.totalRequestsPerHour * (this.agentQuotas[agentRole] || 0.1)
    );

    // Check if agent is under quota
    if (recentRequests.length >= agentQuota) {
      // Check if this is a high priority request
      if (priority === 'urgent') {
        // Allow urgent requests to exceed quota slightly
        if (recentRequests.length >= agentQuota * 1.2) {
          return false;
        }
      } else {
        return false;
      }
    }

    // Check global limit
    const globalRequests = await this.getGlobalRequestCount(windowStart);
    if (globalRequests >= this.totalRequestsPerHour) {
      return false;
    }

    return true;
  }

  async recordRequest(agentRole, priority = 'normal') {
    const now = Date.now();
    const requestKey = `rate_limit:${agentRole}`;
    const globalKey = 'rate_limit:global';

    // Record agent request
    await this.redis.zadd(requestKey, now, `${now}-${Math.random()}`);
    await this.redis.expire(requestKey, 3600); // 1 hour TTL

    // Record global request
    await this.redis.zadd(
      globalKey,
      now,
      `${agentRole}-${now}-${Math.random()}`
    );
    await this.redis.expire(globalKey, 3600);

    console.log(`📊 Request recorded for ${agentRole} (priority: ${priority})`);
  }

  async getRecentRequests(key, windowStart) {
    const requests = await this.redis.zrangebyscore(key, windowStart, '+inf');
    return requests || [];
  }

  async getGlobalRequestCount(windowStart) {
    const requests = await this.redis.zrangebyscore(
      'rate_limit:global',
      windowStart,
      '+inf'
    );
    return requests ? requests.length : 0;
  }

  async getRateLimitStatus() {
    const now = Date.now();
    const windowStart = now - this.windowSize;
    const status = {};

    for (const agent of Object.keys(this.agentQuotas)) {
      const requestKey = `rate_limit:${agent}`;
      const recentRequests = await this.getRecentRequests(
        requestKey,
        windowStart
      );
      const quota = Math.floor(
        this.totalRequestsPerHour * this.agentQuotas[agent]
      );

      status[agent] = {
        used: recentRequests.length,
        quota: quota,
        remaining: Math.max(0, quota - recentRequests.length),
        percentage: Math.round((recentRequests.length / quota) * 100),
      };
    }

    const globalRequests = await this.getGlobalRequestCount(windowStart);
    status.global = {
      used: globalRequests,
      quota: this.totalRequestsPerHour,
      remaining: Math.max(0, this.totalRequestsPerHour - globalRequests),
      percentage: Math.round(
        (globalRequests / this.totalRequestsPerHour) * 100
      ),
    };

    return status;
  }

  async estimateTimeUntilAvailable(agentRole) {
    const now = Date.now();
    const windowStart = now - this.windowSize;
    const requestKey = `rate_limit:${agentRole}`;

    const oldestRequestTime = await this.redis.zrange(
      requestKey,
      0,
      0,
      'WITHSCORES'
    );

    if (!oldestRequestTime || oldestRequestTime.length === 0) {
      return 0; // No requests in window, available now
    }

    const oldestTime = parseInt(oldestRequestTime[1]);
    const timeUntilOldestExpires = oldestTime + this.windowSize - now;

    return Math.max(0, timeUntilOldestExpires);
  }

  // Intelligent batching - combine related requests
  createBatchedPrompt(requests) {
    if (requests.length === 1) {
      return requests[0];
    }

    return `Please process these related requests in order:

${requests.map((req, i) => `${i + 1}. ${req}`).join('\n')}

Please provide numbered responses for each request.`;
  }

  // Adaptive throttling based on API response times
  async adjustThrottling(responseTime, agentRole) {
    const avgResponseKey = `avg_response:${agentRole}`;
    const currentAvg = (await this.redis.get(avgResponseKey)) || 1000;
    const newAvg = parseFloat(currentAvg) * 0.9 + responseTime * 0.1;

    await this.redis.setex(avgResponseKey, 3600, newAvg);

    // If responses are slow, reduce request rate
    if (newAvg > 5000) {
      // 5 second average
      this.agentQuotas[agentRole] *= 0.9; // Reduce quota by 10%
      console.log(`🐌 Reducing quota for ${agentRole} due to slow responses`);
    } else if (newAvg < 2000) {
      // Fast responses
      this.agentQuotas[agentRole] = Math.min(
        this.agentQuotas[agentRole] * 1.05,
        0.3
      ); // Increase quota
      console.log(`⚡ Increasing quota for ${agentRole} due to fast responses`);
    }
  }
}

module.exports = GlobalRateLimiter;
