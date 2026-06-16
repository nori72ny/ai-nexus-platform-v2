import { createClient, RedisClientType } from 'redis';
import { promisify } from 'util';

/**
 * Token blacklist service using Redis
 */
export class TokenBlacklistService {
  private client: RedisClientType | null = null;
  private setAsync: ((key: string, value: string, mode: string, ttl: number) => Promise<string>) | null = null;
  private getAsync: ((key: string) => Promise<string | null>) | null = null;
  private delAsync: ((key: string) => Promise<number>) | null = null;

  constructor() {
    this.initializeRedis();
  }

  /**
   * Initialize Redis connection
   */
  private initializeRedis(): void {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    try {
      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries: number) => {
            if (retries > 10) {
              console.error('[TokenBlacklist] Max Redis reconnection attempts reached');
              return new Error('Max reconnection attempts');
            }
            return retries * 100;
          },
        },
      });

      this.client.on('error', (err: Error) => {
        console.error('[TokenBlacklist] Redis error:', err);
      });

      this.client.on('connect', () => {
        console.log('[TokenBlacklist] Connected to Redis');
      });

      // Use async methods directly
      this.setAsync = (key: string, value: string, mode: string, ttl: number) => {
        return (this.client as any).setEx(key, ttl, value);
      };
      this.getAsync = (key: string) => (this.client as any).get(key);
      this.delAsync = (key: string) => (this.client as any).del(key);
    } catch (error) {
      console.error('[TokenBlacklist] Failed to initialize Redis:', error);
      // Fallback to in-memory storage
      this.initializeMemoryFallback();
    }
  }

  /**
   * Fallback in-memory storage for development
   */
  private memoryStore = new Map<string, number>();

  private initializeMemoryFallback(): void {
    console.warn('[TokenBlacklist] Using in-memory fallback (not suitable for production)');

    // Cleanup expired entries every minute
    setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];

      this.memoryStore.forEach((expiresAt, key) => {
        if (now > expiresAt) {
          keysToDelete.push(key);
        }
      });

      keysToDelete.forEach(key => {
        this.memoryStore.delete(key);
      });
    }, 60 * 1000);
  }

  /**
   * Add token to blacklist
   */
  async addToBlacklist(token: string, expiresIn: number): Promise<void> {
    const key = `blacklist:${token}`;

    try {
      if (this.setAsync) {
        await this.setAsync(key, '1', 'EX', expiresIn);
      } else {
        // Fallback to memory
        this.memoryStore.set(key, Date.now() + expiresIn * 1000);
      }

      console.log('[TokenBlacklist] Token added to blacklist');
    } catch (error) {
      console.error('[TokenBlacklist] Failed to add token to blacklist:', error);
      // Fallback to memory
      this.memoryStore.set(key, Date.now() + expiresIn * 1000);
    }
  }

  /**
   * Check if token is blacklisted
   */
  async isBlacklisted(token: string): Promise<boolean> {
    const key = `blacklist:${token}`;

    try {
      if (this.getAsync) {
        const result = await this.getAsync(key);
        return result !== null;
      } else {
        // Fallback to memory
        return this.memoryStore.has(key);
      }
    } catch (error) {
      console.error('[TokenBlacklist] Failed to check blacklist:', error);
      return this.memoryStore.has(key);
    }
  }

  /**
   * Remove token from blacklist
   */
  async removeFromBlacklist(token: string): Promise<void> {
    const key = `blacklist:${token}`;

    try {
      if (this.delAsync) {
        await this.delAsync(key);
      } else {
        this.memoryStore.delete(key);
      }

      console.log('[TokenBlacklist] Token removed from blacklist');
    } catch (error) {
      console.error('[TokenBlacklist] Failed to remove token from blacklist:', error);
      this.memoryStore.delete(key);
    }
  }

  /**
   * Clear entire blacklist
   */
  async clearBlacklist(): Promise<void> {
    try {
      if (this.client) {
        await (this.client as any).flushDb();
      } else {
        this.memoryStore.clear();
      }

      console.log('[TokenBlacklist] Blacklist cleared');
    } catch (error) {
      console.error('[TokenBlacklist] Failed to clear blacklist:', error);
    }
  }

  /**
   * Get blacklist size
   */
  async getBlacklistSize(): Promise<number> {
    try {
      if (this.client) {
        const size = await (this.client as any).dbSize();
        return size;
      } else {
        return this.memoryStore.size;
      }
    } catch (error) {
      console.error('[TokenBlacklist] Failed to get blacklist size:', error);
      return this.memoryStore.size;
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await (this.client as any).quit();
      console.log('[TokenBlacklist] Redis connection closed');
    }
  }
}

/**
 * Global token blacklist service instance
 */
export const tokenBlacklistService = new TokenBlacklistService();
