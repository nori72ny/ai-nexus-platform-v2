/**
 * Environment variable validator
 */
export class EnvironmentValidator {
  /**
   * Required environment variables for production
   */
  private static readonly REQUIRED_VARS = [
    'NODE_ENV',
    'DATABASE_URL',
    'JWT_SECRET',
    'VITE_APP_ID',
    'OAUTH_SERVER_URL',
  ];

  /**
   * Optional environment variables with defaults
   */
  private static readonly OPTIONAL_VARS: Record<string, string> = {
    'REDIS_URL': 'redis://localhost:6379',
    'PORT': '3000',
    'LOG_LEVEL': 'info',
    'RATE_LIMIT_WINDOW_MS': '900000',
    'RATE_LIMIT_MAX_REQUESTS': '1000',
  };

  /**
   * Validate all environment variables
   */
  static validate(): void {
    console.log('[EnvironmentValidator] Validating environment variables...');

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required variables
    for (const varName of this.REQUIRED_VARS) {
      if (!process.env[varName]) {
        errors.push(`Missing required environment variable: ${varName}`);
      }
    }

    // Check optional variables
    for (const [varName, defaultValue] of Object.entries(this.OPTIONAL_VARS)) {
      if (!process.env[varName]) {
        warnings.push(`Using default for ${varName}: ${defaultValue}`);
        process.env[varName] = defaultValue;
      }
    }

    // Production-specific checks
    if (process.env.NODE_ENV === 'production') {
      this.validateProduction(errors, warnings);
    }

    // Report results
    if (errors.length > 0) {
      console.error('[EnvironmentValidator] ❌ Validation failed:');
      errors.forEach(err => console.error(`  - ${err}`));
      process.exit(1);
    }

    if (warnings.length > 0) {
      console.warn('[EnvironmentValidator] ⚠️ Warnings:');
      warnings.forEach(warn => console.warn(`  - ${warn}`));
    }

    console.log('[EnvironmentValidator] ✅ Environment validation passed');
  }

  /**
   * Production-specific validation
   */
  private static validateProduction(errors: string[], warnings: string[]): void {
    // Check JWT_SECRET is not default
    if (process.env.JWT_SECRET === 'dev-secret-key-change-in-production') {
      errors.push('JWT_SECRET must be changed from default in production');
    }

    // Check for HTTPS
    if (process.env.HTTPS !== 'true') {
      warnings.push('HTTPS is not enabled. Consider enabling it in production.');
    }

    // Check for Redis
    if (!process.env.REDIS_URL) {
      warnings.push('REDIS_URL not set. Using in-memory storage (not suitable for production).');
    }

    // Check for Sentry
    if (!process.env.SENTRY_DSN) {
      warnings.push('SENTRY_DSN not set. Error monitoring is disabled.');
    }

    // Check for monitoring
    if (!process.env.PROMETHEUS_ENABLED) {
      warnings.push('Prometheus monitoring is not enabled.');
    }
  }

  /**
   * Get environment variable with validation
   */
  static get(varName: string, defaultValue?: string): string {
    const value = process.env[varName];

    if (!value && !defaultValue) {
      throw new Error(`Environment variable not found: ${varName}`);
    }

    return value || defaultValue || '';
  }

  /**
   * Get boolean environment variable
   */
  static getBoolean(varName: string, defaultValue: boolean = false): boolean {
    const value = process.env[varName];

    if (!value) {
      return defaultValue;
    }

    return value.toLowerCase() === 'true' || value === '1';
  }

  /**
   * Get number environment variable
   */
  static getNumber(varName: string, defaultValue: number = 0): number {
    const value = process.env[varName];

    if (!value) {
      return defaultValue;
    }

    const num = parseInt(value, 10);
    return isNaN(num) ? defaultValue : num;
  }

  /**
   * Get array environment variable (comma-separated)
   */
  static getArray(varName: string, defaultValue: string[] = []): string[] {
    const value = process.env[varName];

    if (!value) {
      return defaultValue;
    }

    return value.split(',').map(v => v.trim());
  }

  /**
   * Print environment summary
   */
  static printSummary(): void {
    console.log('[EnvironmentValidator] Environment Summary:');
    console.log(`  - NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`  - Database: ${process.env.DATABASE_URL?.substring(0, 50)}...`);
    console.log(`  - Redis: ${process.env.REDIS_URL || 'Not configured'}`);
    console.log(`  - Port: ${process.env.PORT || 3000}`);
    console.log(`  - Log Level: ${process.env.LOG_LEVEL || 'info'}`);
  }
}

// Validate on module load
EnvironmentValidator.validate();
