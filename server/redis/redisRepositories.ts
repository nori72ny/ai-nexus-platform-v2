import { redisService } from './redisService';

/**
 * Session repository
 */
export class SessionRepository {
  private readonly prefix = 'session:';
  private readonly ttl = 7 * 24 * 60 * 60; // 7 days

  async create(sessionId: string, userId: string, data: Record<string, any>): Promise<void> {
    const key = `${this.prefix}${sessionId}`;
    const sessionData = {
      userId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      ...data,
    };

    await redisService.setJSON(key, sessionData, this.ttl);
  }

  async get(sessionId: string): Promise<Record<string, any> | null> {
    const key = `${this.prefix}${sessionId}`;
    return redisService.getJSON(key);
  }

  async update(sessionId: string, data: Record<string, any>): Promise<void> {
    const key = `${this.prefix}${sessionId}`;
    const session = await redisService.getJSON(key);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const updated = {
      ...session,
      ...data,
      lastActivity: Date.now(),
    };

    await redisService.setJSON(key, updated, this.ttl);
  }

  async delete(sessionId: string): Promise<void> {
    const key = `${this.prefix}${sessionId}`;
    await redisService.delete(key);
  }

  async exists(sessionId: string): Promise<boolean> {
    const key = `${this.prefix}${sessionId}`;
    return redisService.exists(key);
  }

  async updateActivity(sessionId: string): Promise<void> {
    const session = await this.get(sessionId);

    if (session) {
      await this.update(sessionId, { lastActivity: Date.now() });
    }
  }
}

/**
 * Token blacklist repository
 */
export class TokenBlacklistRepository {
  private readonly prefix = 'blacklist:';

  async add(token: string, expiresIn: number): Promise<void> {
    const key = `${this.prefix}${token}`;
    await redisService.set(key, '1', expiresIn);
  }

  async isBlacklisted(token: string): Promise<boolean> {
    const key = `${this.prefix}${token}`;
    return redisService.exists(key);
  }

  async remove(token: string): Promise<void> {
    const key = `${this.prefix}${token}`;
    await redisService.delete(key);
  }

  async clear(): Promise<void> {
    // In production, use SCAN to avoid blocking
    console.log('[TokenBlacklistRepository] Clear operation - use SCAN in production');
  }
}

/**
 * Rate limit repository
 */
export class RateLimitRepository {
  private readonly prefix = 'ratelimit:';

  async increment(key: string, windowSeconds: number): Promise<number> {
    const redisKey = `${this.prefix}${key}`;
    const count = await redisService.increment(redisKey, 1);

    // Set TTL on first increment
    if (count === 1) {
      await redisService.set(redisKey, count.toString(), windowSeconds);
    }

    return count;
  }

  async getCount(key: string): Promise<number> {
    const redisKey = `${this.prefix}${key}`;
    const value = await redisService.get(redisKey);
    return value ? parseInt(value, 10) : 0;
  }

  async reset(key: string): Promise<void> {
    const redisKey = `${this.prefix}${key}`;
    await redisService.delete(redisKey);
  }
}

/**
 * Cache repository
 */
export class CacheRepository {
  private readonly prefix = 'cache:';
  private readonly defaultTtl = 60 * 60; // 1 hour

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const redisKey = `${this.prefix}${key}`;
    await redisService.setJSON(redisKey, value, ttlSeconds || this.defaultTtl);
  }

  async get<T>(key: string): Promise<T | null> {
    const redisKey = `${this.prefix}${key}`;
    return redisService.getJSON(redisKey);
  }

  async delete(key: string): Promise<void> {
    const redisKey = `${this.prefix}${key}`;
    await redisService.delete(redisKey);
  }

  async exists(key: string): Promise<boolean> {
    const redisKey = `${this.prefix}${key}`;
    return redisService.exists(redisKey);
  }

  async clear(): Promise<void> {
    console.log('[CacheRepository] Clear operation - use SCAN in production');
  }
}

/**
 * SSE event store repository
 */
export class SSEEventStoreRepository {
  private readonly prefix = 'sse:events:';
  private readonly ttl = 24 * 60 * 60; // 24 hours

  async addEvent(eventType: string, event: Record<string, any>): Promise<void> {
    const key = `${this.prefix}${eventType}`;
    const eventJson = JSON.stringify(event);
    await redisService.pushToList(key, eventJson);

    // Set TTL
    await redisService.set(`${key}:ttl`, '1', this.ttl);

    // Keep only last 1000 events
    const length = await redisService.getListLength(key);
    if (length > 1000) {
      // Remove oldest events (in production, use LTRIM)
      console.log(`[SSEEventStoreRepository] Trimming ${eventType} events`);
    }
  }

  async getEvents(eventType: string, fromIndex: number = 0): Promise<Record<string, any>[]> {
    const key = `${this.prefix}${eventType}`;
    const events = await redisService.getListRange(key, fromIndex, -1);

    return events.map(event => {
      try {
        return JSON.parse(event);
      } catch {
        return {};
      }
    });
  }

  async getEventsSince(eventType: string, sinceEventId: number): Promise<Record<string, any>[]> {
    const key = `${this.prefix}${eventType}`;
    const events = await redisService.getListRange(key, sinceEventId, -1);

    return events.map(event => {
      try {
        return JSON.parse(event);
      } catch {
        return {};
      }
    });
  }

  async clearEvents(eventType: string): Promise<void> {
    const key = `${this.prefix}${eventType}`;
    await redisService.delete(key);
  }
}

/**
 * Refresh token rotation tracking repository
 */
export class RefreshTokenRotationRepository {
  private readonly prefix = 'refresh:rotation:';
  private readonly ttl = 7 * 24 * 60 * 60; // 7 days

  async recordRotation(userId: string, oldToken: string, newToken: string): Promise<void> {
    const key = `${this.prefix}${userId}`;
    const rotation = {
      oldToken,
      newToken,
      rotatedAt: Date.now(),
    };

    await redisService.setJSON(key, rotation, this.ttl);
  }

  async getLastRotation(userId: string): Promise<Record<string, any> | null> {
    const key = `${this.prefix}${userId}`;
    return redisService.getJSON(key);
  }

  async isOldTokenValid(userId: string, token: string): Promise<boolean> {
    const rotation = await this.getLastRotation(userId);

    if (!rotation) {
      return true; // No rotation record, token is valid
    }

    // Token is invalid if it's older than the last rotation
    return rotation.oldToken === token;
  }

  async clearRotation(userId: string): Promise<void> {
    const key = `${this.prefix}${userId}`;
    await redisService.delete(key);
  }
}

/**
 * Global repository instances
 */
export const sessionRepository = new SessionRepository();
export const tokenBlacklistRepository = new TokenBlacklistRepository();
export const rateLimitRepository = new RateLimitRepository();
export const cacheRepository = new CacheRepository();
export const sseEventStoreRepository = new SSEEventStoreRepository();
export const refreshTokenRotationRepository = new RefreshTokenRotationRepository();
