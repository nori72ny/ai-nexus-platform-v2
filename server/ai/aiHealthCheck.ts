import { cacheRepository } from '../redis/redisRepositories';

/**
 * AI provider health status
 */
export interface ProviderHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  lastCheck: number;
  responseTime: number;
  errorRate: number;
  availabilityScore: number; // 0-100
}

/**
 * Circuit breaker state
 */
type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/**
 * AI provider health check service
 */
export class AIHealthCheckService {
  private providers = ['chatgpt', 'gemini', 'perplexity', 'manus', 'genspark'];
  private circuitBreakers = new Map<string, { state: CircuitBreakerState; failureCount: number; lastFailure: number }>();
  private healthMetrics = new Map<string, { successCount: number; failureCount: number; totalResponseTime: number }>();

  constructor() {
    this.initializeMetrics();
    this.startHealthCheckLoop();
  }

  /**
   * Initialize metrics for all providers
   */
  private initializeMetrics(): void {
    for (const provider of this.providers) {
      this.circuitBreakers.set(provider, { state: 'closed', failureCount: 0, lastFailure: 0 });
      this.healthMetrics.set(provider, { successCount: 0, failureCount: 0, totalResponseTime: 0 });
    }
  }

  /**
   * Check provider health
   */
  async checkProviderHealth(provider: string): Promise<ProviderHealth> {
    const startTime = Date.now();

    try {
      // Check circuit breaker
      const breaker = this.circuitBreakers.get(provider);

      if (breaker?.state === 'open') {
        // Check if enough time has passed to try half-open
        if (Date.now() - breaker.lastFailure > 60 * 1000) {
          breaker.state = 'half-open';
        } else {
          return {
            name: provider,
            status: 'down',
            lastCheck: Date.now(),
            responseTime: 0,
            errorRate: 1.0,
            availabilityScore: 0,
          };
        }
      }

      // Perform health check based on provider
      const isHealthy = await this.performHealthCheck(provider);
      const responseTime = Date.now() - startTime;

      const metrics = this.healthMetrics.get(provider)!;

      if (isHealthy) {
        metrics.successCount++;
        if (breaker) {
          breaker.state = 'closed';
          breaker.failureCount = 0;
        }
      } else {
        metrics.failureCount++;
        if (breaker) {
          breaker.failureCount++;
          breaker.lastFailure = Date.now();

          if (breaker.failureCount >= 5) {
            breaker.state = 'open';
          }
        }
      }

      metrics.totalResponseTime += responseTime;

      const totalRequests = metrics.successCount + metrics.failureCount;
      const errorRate = totalRequests > 0 ? metrics.failureCount / totalRequests : 0;
      const availabilityScore = Math.max(0, 100 - Math.round(errorRate * 100));

      const health: ProviderHealth = {
        name: provider,
        status: isHealthy ? (errorRate < 0.1 ? 'healthy' : 'degraded') : 'down',
        lastCheck: Date.now(),
        responseTime,
        errorRate,
        availabilityScore,
      };

      // Cache health status
      await cacheRepository.set(`health:${provider}`, health, 60);

      return health;
    } catch (error) {
      console.error(`[AIHealthCheck] Health check failed for ${provider}:`, error);

      const metrics = this.healthMetrics.get(provider)!;
      metrics.failureCount++;

      const breaker = this.circuitBreakers.get(provider)!;
      breaker.failureCount++;
      breaker.lastFailure = Date.now();

      if (breaker.failureCount >= 5) {
        breaker.state = 'open';
      }

      return {
        name: provider,
        status: 'down',
        lastCheck: Date.now(),
        responseTime: Date.now() - startTime,
        errorRate: 1.0,
        availabilityScore: 0,
      };
    }
  }

  /**
   * Perform actual health check for provider
   */
  private async performHealthCheck(provider: string): Promise<boolean> {
    try {
      switch (provider) {
        case 'chatgpt':
          return await this.checkChatGPT();
        case 'gemini':
          return await this.checkGemini();
        case 'perplexity':
          return await this.checkPerplexity();
        case 'manus':
          return await this.checkManus();
        case 'genspark':
          return await this.checkGenspark();
        default:
          return false;
      }
    } catch (error) {
      console.error(`[AIHealthCheck] Health check error for ${provider}:`, error);
      return false;
    }
  }

  /**
   * Check ChatGPT health
   */
  private async checkChatGPT(): Promise<boolean> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        timeout: 5000,
      } as any);

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Check Gemini health
   */
  private async checkGemini(): Promise<boolean> {
    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + process.env.GEMINI_API_KEY, {
        timeout: 5000,
      } as any);

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Check Perplexity health
   */
  private async checkPerplexity(): Promise<boolean> {
    try {
      const response = await fetch('https://api.perplexity.ai/openai/v1/models', {
        headers: {
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        },
        timeout: 5000,
      } as any);

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Check Manus health
   */
  private async checkManus(): Promise<boolean> {
    try {
      const response = await fetch(process.env.BUILT_IN_FORGE_API_URL + '/v1/models', {
        headers: {
          'Authorization': `Bearer ${process.env.BUILT_IN_FORGE_API_KEY}`,
        },
        timeout: 5000,
      } as any);

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Check Genspark health
   */
  private async checkGenspark(): Promise<boolean> {
    try {
      const response = await fetch('https://api.genspark.ai/v1/health', {
        headers: {
          'Authorization': `Bearer ${process.env.GENSPARK_API_KEY}`,
        },
        timeout: 5000,
      } as any);

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get all provider health status
   */
  async getAllProviderHealth(): Promise<ProviderHealth[]> {
    const health: ProviderHealth[] = [];

    for (const provider of this.providers) {
      const cached = await cacheRepository.get<ProviderHealth>(`health:${provider}`);

      if (cached) {
        health.push(cached);
      } else {
        const providerHealth = await this.checkProviderHealth(provider);
        health.push(providerHealth);
      }
    }

    return health;
  }

  /**
   * Get best available provider
   */
  async getBestProvider(): Promise<string | null> {
    const health = await this.getAllProviderHealth();
    const healthy = health.filter(h => h.status === 'healthy' || h.status === 'degraded');

    if (healthy.length === 0) {
      return null;
    }

    // Sort by availability score and response time
    healthy.sort((a, b) => {
      if (a.availabilityScore !== b.availabilityScore) {
        return b.availabilityScore - a.availabilityScore;
      }
      return a.responseTime - b.responseTime;
    });

    return healthy[0].name;
  }

  /**
   * Check if provider is available
   */
  async isProviderAvailable(provider: string): Promise<boolean> {
    const breaker = this.circuitBreakers.get(provider);

    if (!breaker) {
      return false;
    }

    if (breaker.state === 'open') {
      return false;
    }

    const health = await this.checkProviderHealth(provider);
    return health.status !== 'down';
  }

  /**
   * Start health check loop
   */
  private startHealthCheckLoop(): void {
    // Check all providers every 5 minutes
    setInterval(async () => {
      console.log('[AIHealthCheck] Starting health check loop');

      for (const provider of this.providers) {
        try {
          await this.checkProviderHealth(provider);
        } catch (error) {
          console.error(`[AIHealthCheck] Error checking ${provider}:`, error);
        }
      }
    }, 5 * 60 * 1000);

    // Initial check
    this.getAllProviderHealth().catch(error => {
      console.error('[AIHealthCheck] Initial health check failed:', error);
    });
  }

  /**
   * Get health check status
   */
  getStatus(): {
    providers: ProviderHealth[];
    timestamp: number;
  } {
    const providers: ProviderHealth[] = [];

    for (const provider of this.providers) {
      const metrics = this.healthMetrics.get(provider);
      const breaker = this.circuitBreakers.get(provider);

      if (metrics) {
        const totalRequests = metrics.successCount + metrics.failureCount;
        const errorRate = totalRequests > 0 ? metrics.failureCount / totalRequests : 0;

        providers.push({
          name: provider,
          status: breaker?.state === 'open' ? 'down' : errorRate < 0.1 ? 'healthy' : 'degraded',
          lastCheck: Date.now(),
          responseTime: totalRequests > 0 ? Math.round(metrics.totalResponseTime / totalRequests) : 0,
          errorRate,
          availabilityScore: Math.max(0, 100 - Math.round(errorRate * 100)),
        });
      }
    }

    return {
      providers,
      timestamp: Date.now(),
    };
  }
}

/**
 * Global AI health check service
 */
export const aiHealthCheckService = new AIHealthCheckService();
