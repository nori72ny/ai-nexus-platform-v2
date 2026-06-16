import { createClient, RedisClientType } from 'redis';

/**
 * Redis service for centralized data management
 */
export class RedisService {
  private client: RedisClientType | null = null;
  private isConnected = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize Redis connection
   */
  private async initialize(): Promise<void> {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    try {
      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries: number) => {
            if (retries > 10) {
              console.error('[RedisService] Max reconnection attempts reached');
              return new Error('Max reconnection attempts');
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      this.client.on('error', (err: Error) => {
        console.error('[RedisService] Redis error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('[RedisService] Connected to Redis');
        this.isConnected = true;
      });

      this.client.on('reconnecting', () => {
        console.log('[RedisService] Reconnecting to Redis...');
      });

      // Connect
      await this.client.connect();
      this.isConnected = true;
      console.log('[RedisService] ✅ Redis service initialized');
    } catch (error) {
      console.error('[RedisService] Failed to initialize Redis:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Check if connected
   */
  getIsConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get value
   */
  async get(key: string): Promise<string | null> {
    if (!this.client) return null;

    try {
      return await this.client.get(key);
    } catch (error) {
      console.error(`[RedisService] Failed to get ${key}:`, error);
      return null;
    }
  }

  /**
   * Get JSON value
   */
  async getJSON<T>(key: string): Promise<T | null> {
    const value = await this.get(key);

    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`[RedisService] Failed to parse JSON for ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value with TTL
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;

    try {
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      console.error(`[RedisService] Failed to set ${key}:`, error);
    }
  }

  /**
   * Set JSON value with TTL
   */
  async setJSON<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const jsonString = JSON.stringify(value);
    await this.set(key, jsonString, ttlSeconds);
  }

  /**
   * Delete key
   */
  async delete(key: string): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.del(key);
    } catch (error) {
      console.error(`[RedisService] Failed to delete ${key}:`, error);
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`[RedisService] Failed to check existence of ${key}:`, error);
      return false;
    }
  }

  /**
   * Increment counter
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    if (!this.client) return 0;

    try {
      return await this.client.incrBy(key, amount);
    } catch (error) {
      console.error(`[RedisService] Failed to increment ${key}:`, error);
      return 0;
    }
  }

  /**
   * Decrement counter
   */
  async decrement(key: string, amount: number = 1): Promise<number> {
    if (!this.client) return 0;

    try {
      return await this.client.decrBy(key, amount);
    } catch (error) {
      console.error(`[RedisService] Failed to decrement ${key}:`, error);
      return 0;
    }
  }

  /**
   * Push to list
   */
  async pushToList(key: string, value: string): Promise<number> {
    if (!this.client) return 0;

    try {
      return await this.client.rPush(key, value);
    } catch (error) {
      console.error(`[RedisService] Failed to push to list ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get list range
   */
  async getListRange(key: string, start: number = 0, stop: number = -1): Promise<string[]> {
    if (!this.client) return [];

    try {
      return await this.client.lRange(key, start, stop);
    } catch (error) {
      console.error(`[RedisService] Failed to get list range ${key}:`, error);
      return [];
    }
  }

  /**
   * Get list length
   */
  async getListLength(key: string): Promise<number> {
    if (!this.client) return 0;

    try {
      return await this.client.lLen(key);
    } catch (error) {
      console.error(`[RedisService] Failed to get list length ${key}:`, error);
      return 0;
    }
  }

  /**
   * Add to set
   */
  async addToSet(key: string, ...members: string[]): Promise<number> {
    if (!this.client) return 0;

    try {
      return await this.client.sAdd(key, members);
    } catch (error) {
      console.error(`[RedisService] Failed to add to set ${key}:`, error);
      return 0;
    }
  }

  /**
   * Check set membership
   */
  async isSetMember(key: string, member: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      const result = await this.client.sIsMember(key, member);
      return result === 1;
    } catch (error) {
      console.error(`[RedisService] Failed to check set membership ${key}:`, error);
      return false;
    }
  }

  /**
   * Remove from set
   */
  async removeFromSet(key: string, ...members: string[]): Promise<number> {
    if (!this.client) return 0;

    try {
      return await this.client.sRem(key, members);
    } catch (error) {
      console.error(`[RedisService] Failed to remove from set ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get all set members
   */
  async getSetMembers(key: string): Promise<string[]> {
    if (!this.client) return [];

    try {
      return await this.client.sMembers(key);
    } catch (error) {
      console.error(`[RedisService] Failed to get set members ${key}:`, error);
      return [];
    }
  }

  /**
   * Set hash field
   */
  async setHashField(key: string, field: string, value: string): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.hSet(key, field, value);
    } catch (error) {
      console.error(`[RedisService] Failed to set hash field ${key}:${field}:`, error);
    }
  }

  /**
   * Get hash field
   */
  async getHashField(key: string, field: string): Promise<string | null> {
    if (!this.client) return null;

    try {
      return await this.client.hGet(key, field);
    } catch (error) {
      console.error(`[RedisService] Failed to get hash field ${key}:${field}:`, error);
      return null;
    }
  }

  /**
   * Get all hash fields
   */
  async getHashAll(key: string): Promise<Record<string, string>> {
    if (!this.client) return {};

    try {
      return await this.client.hGetAll(key);
    } catch (error) {
      console.error(`[RedisService] Failed to get hash ${key}:`, error);
      return {};
    }
  }

  /**
   * Delete hash field
   */
  async deleteHashField(key: string, field: string): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.hDel(key, field);
    } catch (error) {
      console.error(`[RedisService] Failed to delete hash field ${key}:${field}:`, error);
    }
  }

  /**
   * Flush all data
   */
  async flushAll(): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.flushDb();
      console.log('[RedisService] Database flushed');
    } catch (error) {
      console.error('[RedisService] Failed to flush database:', error);
    }
  }

  /**
   * Get database size
   */
  async getDbSize(): Promise<number> {
    if (!this.client) return 0;

    try {
      return await this.client.dbSize();
    } catch (error) {
      console.error('[RedisService] Failed to get database size:', error);
      return 0;
    }
  }

  /**
   * Get info
   */
  async getInfo(): Promise<string> {
    if (!this.client) return '';

    try {
      return await this.client.info();
    } catch (error) {
      console.error('[RedisService] Failed to get info:', error);
      return '';
    }
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
        this.isConnected = false;
        console.log('[RedisService] Connection closed');
      } catch (error) {
        console.error('[RedisService] Failed to close connection:', error);
      }
    }
  }
}

/**
 * Global Redis service instance
 */
export const redisService = new RedisService();
