import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logAudit } from '../auditLog';

const execPromise = promisify(exec);

/**
 * SSL certificate configuration
 */
export interface SSLConfig {
  domain: string;
  email: string;
  certDir: string;
  renewalCheckInterval: number; // in days
  autoRenew: boolean;
}

/**
 * Certificate information
 */
export interface CertificateInfo {
  domain: string;
  issuer: string;
  validFrom: Date;
  validUntil: Date;
  daysRemaining: number;
  isValid: boolean;
  needsRenewal: boolean;
}

/**
 * SSL certificate manager using Let's Encrypt
 */
export class SSLCertificateManager {
  private config: SSLConfig;
  private renewalTimer: NodeJS.Timeout | null = null;

  constructor(config: SSLConfig) {
    this.config = config;

    this.ensureCertDir();
  }

  /**
   * Ensure certificate directory exists
   */
  private ensureCertDir(): void {
    if (!fs.existsSync(this.config.certDir)) {
      fs.mkdirSync(this.config.certDir, { recursive: true });
    }
  }

  /**
   * Get certificate file paths
   */
  private getCertPaths(): {
    cert: string;
    key: string;
    chain: string;
    fullchain: string;
  } {
    const domain = this.config.domain;
    const baseDir = path.join(this.config.certDir, domain);

    return {
      cert: path.join(baseDir, 'cert.pem'),
      key: path.join(baseDir, 'key.pem'),
      chain: path.join(baseDir, 'chain.pem'),
      fullchain: path.join(baseDir, 'fullchain.pem'),
    };
  }

  /**
   * Issue new certificate using Let's Encrypt
   */
  async issueCertificate(): Promise<void> {
    try {
      console.log(`[SSLCertificateManager] Issuing certificate for ${this.config.domain}...`);

      const certPaths = this.getCertPaths();
      const baseDir = path.dirname(certPaths.cert);

      // Ensure domain directory exists
      if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
      }

      // Use certbot to issue certificate
      const command = `certbot certonly --standalone \
        -d ${this.config.domain} \
        -m ${this.config.email} \
        --agree-tos \
        --non-interactive \
        --cert-path ${certPaths.cert} \
        --key-path ${certPaths.key} \
        --chain-path ${certPaths.chain} \
        --fullchain-path ${certPaths.fullchain}`;

      const { stdout, stderr } = await execPromise(command);

      console.log('[SSLCertificateManager] Certificate issued successfully');
      console.log(stdout);

      // Log certificate issuance
      await logAudit(null as any, {
        action: 'SSL_CERT_ISSUED',
        resourceType: 'ssl_certificate',
        resourceId: this.config.domain,
        details: {
          domain: this.config.domain,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('[SSLCertificateManager] Certificate issuance failed:', error);

      // Log certificate issuance failure
      await logAudit(null as any, {
        action: 'SSL_CERT_ISSUE_FAILED',
        resourceType: 'ssl_certificate',
        resourceId: this.config.domain,
        details: {
          domain: this.config.domain,
          error: String(error),
        },
      });

      throw error;
    }
  }

  /**
   * Renew existing certificate
   */
  async renewCertificate(): Promise<void> {
    try {
      console.log(`[SSLCertificateManager] Renewing certificate for ${this.config.domain}...`);

      const command = `certbot renew \
        -d ${this.config.domain} \
        --non-interactive \
        --quiet`;

      const { stdout, stderr } = await execPromise(command);

      console.log('[SSLCertificateManager] Certificate renewed successfully');

      // Log certificate renewal
      await logAudit(null as any, {
        action: 'SSL_CERT_RENEWED',
        resourceType: 'ssl_certificate',
        resourceId: this.config.domain,
        details: {
          domain: this.config.domain,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('[SSLCertificateManager] Certificate renewal failed:', error);

      // Log certificate renewal failure
      await logAudit(null as any, {
        action: 'SSL_CERT_RENEWAL_FAILED',
        resourceType: 'ssl_certificate',
        resourceId: this.config.domain,
        details: {
          domain: this.config.domain,
          error: String(error),
        },
      });

      throw error;
    }
  }

  /**
   * Get certificate information
   */
  async getCertificateInfo(): Promise<CertificateInfo> {
    try {
      const certPaths = this.getCertPaths();

      if (!fs.existsSync(certPaths.cert)) {
        throw new Error('Certificate not found');
      }

      // Use openssl to get certificate information
      const command = `openssl x509 -in ${certPaths.cert} -noout -subject -issuer -dates`;

      const { stdout } = await execPromise(command);

      // Parse certificate information
      const lines = stdout.split('\n');
      let issuer = '';
      let validFrom = new Date();
      let validUntil = new Date();

      lines.forEach(line => {
        if (line.startsWith('issuer=')) {
          issuer = line.replace('issuer=', '').trim();
        } else if (line.startsWith('notBefore=')) {
          validFrom = new Date(line.replace('notBefore=', '').trim());
        } else if (line.startsWith('notAfter=')) {
          validUntil = new Date(line.replace('notAfter=', '').trim());
        }
      });

      const now = new Date();
      const daysRemaining = Math.floor((validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const isValid = now >= validFrom && now <= validUntil;
      const needsRenewal = daysRemaining <= 30;

      return {
        domain: this.config.domain,
        issuer,
        validFrom,
        validUntil,
        daysRemaining,
        isValid,
        needsRenewal,
      };
    } catch (error) {
      console.error('[SSLCertificateManager] Failed to get certificate info:', error);
      throw error;
    }
  }

  /**
   * Start automatic renewal scheduler
   */
  startAutoRenewal(): void {
    if (!this.config.autoRenew) {
      console.log('[SSLCertificateManager] Auto-renewal is disabled');
      return;
    }

    console.log('[SSLCertificateManager] Starting auto-renewal scheduler...');

    // Check certificate every day
    this.renewalTimer = setInterval(async () => {
      try {
        const certInfo = await this.getCertificateInfo();

        if (certInfo.needsRenewal) {
          console.log(`[SSLCertificateManager] Certificate needs renewal (${certInfo.daysRemaining} days remaining)`);
          await this.renewCertificate();
        }
      } catch (error) {
        console.error('[SSLCertificateManager] Auto-renewal check failed:', error);
      }
    }, 24 * 60 * 60 * 1000); // Check every 24 hours
  }

  /**
   * Stop automatic renewal scheduler
   */
  stopAutoRenewal(): void {
    if (this.renewalTimer) {
      clearInterval(this.renewalTimer);
      this.renewalTimer = null;
      console.log('[SSLCertificateManager] Auto-renewal scheduler stopped');
    }
  }

  /**
   * Copy certificates to nginx directory
   */
  async copyCertsToNginx(nginxCertDir: string): Promise<void> {
    try {
      const certPaths = this.getCertPaths();

      // Ensure nginx cert directory exists
      if (!fs.existsSync(nginxCertDir)) {
        fs.mkdirSync(nginxCertDir, { recursive: true });
      }

      // Copy certificate and key
      fs.copyFileSync(certPaths.fullchain, path.join(nginxCertDir, 'cert.pem'));
      fs.copyFileSync(certPaths.key, path.join(nginxCertDir, 'key.pem'));

      console.log('[SSLCertificateManager] Certificates copied to Nginx');

      // Reload nginx
      await execPromise('nginx -s reload');

      console.log('[SSLCertificateManager] Nginx reloaded');
    } catch (error) {
      console.error('[SSLCertificateManager] Failed to copy certificates:', error);
      throw error;
    }
  }

  /**
   * Get renewal status
   */
  async getRenewalStatus(): Promise<{
    domain: string;
    certificateInfo: CertificateInfo;
    autoRenewalEnabled: boolean;
    nextRenewalCheck: Date;
  }> {
    const certificateInfo = await this.getCertificateInfo();

    return {
      domain: this.config.domain,
      certificateInfo,
      autoRenewalEnabled: this.config.autoRenew && this.renewalTimer !== null,
      nextRenewalCheck: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }
}

/**
 * Global SSL certificate manager instance
 */
export const sslCertManager = new SSLCertificateManager({
  domain: process.env.SSL_DOMAIN || 'localhost',
  email: process.env.SSL_EMAIL || 'admin@example.com',
  certDir: process.env.SSL_CERT_DIR || '/etc/letsencrypt/live',
  renewalCheckInterval: 30,
  autoRenew: process.env.SSL_AUTO_RENEW !== 'false',
});
