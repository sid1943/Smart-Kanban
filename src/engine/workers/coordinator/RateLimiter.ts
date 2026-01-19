// RateLimiter - Manages API rate limits for external services
// Prevents hitting rate limits across all workers

// Rate limit configuration for each API
export interface RateLimitConfig {
  limit: number;
  windowMs: number;
  name: string;
}

// Known API rate limits
export const API_RATE_LIMITS: Record<string, RateLimitConfig> = {
  tmdb: {
    name: 'TMDb',
    limit: 40,
    windowMs: 10000, // 40 requests per 10 seconds
  },
  omdb: {
    name: 'OMDb',
    limit: 40,
    windowMs: 3600000, // 40 requests per hour (1000/day free tier)
  },
  jikan: {
    name: 'Jikan (MAL)',
    limit: 60,
    windowMs: 60000, // 60 requests per minute
  },
  rawg: {
    name: 'RAWG',
    limit: 20,
    windowMs: 1000, // 20 requests per second
  },
  openLibrary: {
    name: 'Open Library',
    limit: 100,
    windowMs: 300000, // 100 requests per 5 minutes (no official limit)
  },
};

// Request record
interface RequestRecord {
  timestamp: number;
}

// Rate limit state for an API
interface RateLimitState {
  config: RateLimitConfig;
  requests: RequestRecord[];
  blocked: boolean;
  blockedUntil: number;
}

// Check result
export interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
  limit: number;
  windowMs: number;
}

export class RateLimiter {
  private states: Map<string, RateLimitState> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Initialize states for known APIs
    for (const [api, config] of Object.entries(API_RATE_LIMITS)) {
      this.states.set(api, {
        config,
        requests: [],
        blocked: false,
        blockedUntil: 0,
      });
    }

    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Register a custom API rate limit
   */
  registerApi(api: string, config: RateLimitConfig): void {
    this.states.set(api, {
      config,
      requests: [],
      blocked: false,
      blockedUntil: 0,
    });
  }

  /**
   * Check if a request is allowed (doesn't consume quota)
   */
  check(api: string): RateLimitCheckResult {
    const state = this.states.get(api);
    if (!state) {
      // Unknown API - allow by default
      return {
        allowed: true,
        remaining: Infinity,
        resetIn: 0,
        limit: Infinity,
        windowMs: 0,
      };
    }

    const now = Date.now();

    // Check if blocked
    if (state.blocked && now < state.blockedUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetIn: state.blockedUntil - now,
        limit: state.config.limit,
        windowMs: state.config.windowMs,
      };
    }

    // Unblock if block period has passed
    if (state.blocked && now >= state.blockedUntil) {
      state.blocked = false;
      state.blockedUntil = 0;
    }

    // Clean old requests
    this.cleanRequests(state, now);

    const remaining = state.config.limit - state.requests.length;
    const oldestRequest = state.requests[0];
    const resetIn = oldestRequest
      ? Math.max(0, oldestRequest.timestamp + state.config.windowMs - now)
      : 0;

    return {
      allowed: remaining > 0,
      remaining: Math.max(0, remaining),
      resetIn,
      limit: state.config.limit,
      windowMs: state.config.windowMs,
    };
  }

  /**
   * Consume a request slot (call before making API request)
   */
  acquire(api: string): boolean {
    const checkResult = this.check(api);
    if (!checkResult.allowed) {
      return false;
    }

    const state = this.states.get(api);
    if (state) {
      state.requests.push({ timestamp: Date.now() });
    }

    return true;
  }

  /**
   * Wait until rate limit allows a request
   */
  async waitForSlot(api: string, maxWaitMs: number = 60000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const checkResult = this.check(api);
      if (checkResult.allowed) {
        return this.acquire(api);
      }

      // Wait for reset
      const waitTime = Math.min(checkResult.resetIn + 100, maxWaitMs - (Date.now() - startTime));
      if (waitTime <= 0) break;

      await this.sleep(waitTime);
    }

    return false;
  }

  /**
   * Report a rate limit error from an API
   * Blocks further requests for the specified duration
   */
  reportRateLimitError(api: string, retryAfterMs?: number): void {
    const state = this.states.get(api);
    if (!state) return;

    const blockDuration = retryAfterMs || state.config.windowMs;
    state.blocked = true;
    state.blockedUntil = Date.now() + blockDuration;

    console.warn(
      `[RateLimiter] ${state.config.name} rate limited, blocking for ${blockDuration}ms`
    );
  }

  /**
   * Get current status for all APIs
   */
  getStatus(): Record<string, RateLimitCheckResult & { name: string }> {
    const status: Record<string, RateLimitCheckResult & { name: string }> = {};

    for (const [api, state] of this.states) {
      const check = this.check(api);
      status[api] = {
        ...check,
        name: state.config.name,
      };
    }

    return status;
  }

  /**
   * Get status for a specific API
   */
  getApiStatus(api: string): (RateLimitCheckResult & { name: string }) | null {
    const state = this.states.get(api);
    if (!state) return null;

    const check = this.check(api);
    return {
      ...check,
      name: state.config.name,
    };
  }

  /**
   * Reset rate limit state for an API
   */
  reset(api: string): void {
    const state = this.states.get(api);
    if (state) {
      state.requests = [];
      state.blocked = false;
      state.blockedUntil = 0;
    }
  }

  /**
   * Reset all rate limit states
   */
  resetAll(): void {
    for (const api of this.states.keys()) {
      this.reset(api);
    }
  }

  /**
   * Destroy the rate limiter
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.states.clear();
  }

  // Clean old requests from state
  private cleanRequests(state: RateLimitState, now: number): void {
    const cutoff = now - state.config.windowMs;
    state.requests = state.requests.filter((r) => r.timestamp > cutoff);
  }

  // Start periodic cleanup
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const state of this.states.values()) {
        this.cleanRequests(state, now);
      }
    }, 10000);
  }

  // Sleep helper
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
let defaultLimiter: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (!defaultLimiter) {
    defaultLimiter = new RateLimiter();
  }
  return defaultLimiter;
}

export function resetRateLimiter(): void {
  if (defaultLimiter) {
    defaultLimiter.destroy();
    defaultLimiter = null;
  }
}

export default RateLimiter;
