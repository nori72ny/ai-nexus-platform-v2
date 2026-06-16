import axios from 'axios';
import { logAudit } from '../auditLog';

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info',
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  enabled: boolean;
  slackWebhookUrl?: string;
  emailRecipients?: string[];
  webhookUrl?: string;
}

/**
 * Alert message
 */
export interface AlertMessage {
  severity: AlertSeverity;
  title: string;
  message: string;
  component: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Alert manager for sending notifications
 */
export class AlertManager {
  private config: AlertConfig;

  constructor(config: Partial<AlertConfig> = {}) {
    this.config = {
      enabled: true,
      slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
      emailRecipients: process.env.ALERT_EMAIL_RECIPIENTS?.split(','),
      webhookUrl: process.env.ALERT_WEBHOOK_URL,
      ...config,
    };
  }

  /**
   * Send alert through all configured channels
   */
  async sendAlert(alert: AlertMessage): Promise<void> {
    if (!this.config.enabled) {
      console.log('[AlertManager] Alerts disabled');
      return;
    }

    console.log(`[AlertManager] Sending ${alert.severity} alert: ${alert.title}`);

    const promises: Promise<void>[] = [];

    if (this.config.slackWebhookUrl) {
      promises.push(this.sendSlackAlert(alert));
    }

    if (this.config.emailRecipients && this.config.emailRecipients.length > 0) {
      promises.push(this.sendEmailAlert(alert));
    }

    if (this.config.webhookUrl) {
      promises.push(this.sendWebhookAlert(alert));
    }

    await Promise.allSettled(promises);

    // Log alert
    await logAudit(null as any, {
      action: 'ALERT_SENT',
      resourceType: 'alert',
      resourceId: alert.component,
      details: {
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        timestamp: alert.timestamp.toISOString(),
      },
    });
  }

  /**
   * Send alert to Slack
   */
  private async sendSlackAlert(alert: AlertMessage): Promise<void> {
    try {
      if (!this.config.slackWebhookUrl) return;

      const color = this.getSeverityColor(alert.severity);
      const emoji = this.getSeverityEmoji(alert.severity);

      const payload = {
        attachments: [
          {
            color,
            title: `${emoji} ${alert.title}`,
            text: alert.message,
            fields: [
              {
                title: 'Component',
                value: alert.component,
                short: true,
              },
              {
                title: 'Severity',
                value: alert.severity.toUpperCase(),
                short: true,
              },
              {
                title: 'Time',
                value: alert.timestamp.toISOString(),
                short: false,
              },
            ],
            footer: 'AI Nexus Personal Alert System',
            ts: Math.floor(alert.timestamp.getTime() / 1000),
          },
        ],
      };

      await axios.post(this.config.slackWebhookUrl, payload);

      console.log('[AlertManager] Slack alert sent');
    } catch (error) {
      console.error('[AlertManager] Failed to send Slack alert:', error);
    }
  }

  /**
   * Send alert via email
   */
  private async sendEmailAlert(alert: AlertMessage): Promise<void> {
    try {
      if (!this.config.emailRecipients || this.config.emailRecipients.length === 0) return;

      // In production, use a proper email service (SendGrid, AWS SES, etc.)
      console.log(`[AlertManager] Email alert would be sent to: ${this.config.emailRecipients.join(', ')}`);
      console.log(`[AlertManager] Subject: ${alert.title}`);
      console.log(`[AlertManager] Body: ${alert.message}`);
    } catch (error) {
      console.error('[AlertManager] Failed to send email alert:', error);
    }
  }

  /**
   * Send alert to webhook
   */
  private async sendWebhookAlert(alert: AlertMessage): Promise<void> {
    try {
      if (!this.config.webhookUrl) return;

      const payload = {
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        component: alert.component,
        timestamp: alert.timestamp.toISOString(),
        metadata: alert.metadata,
      };

      await axios.post(this.config.webhookUrl, payload, {
        timeout: 5000,
      });

      console.log('[AlertManager] Webhook alert sent');
    } catch (error) {
      console.error('[AlertManager] Failed to send webhook alert:', error);
    }
  }

  /**
   * Get color for severity level
   */
  private getSeverityColor(severity: AlertSeverity): string {
    const colors: Record<AlertSeverity, string> = {
      [AlertSeverity.CRITICAL]: '#FF0000',
      [AlertSeverity.HIGH]: '#FF6600',
      [AlertSeverity.MEDIUM]: '#FFCC00',
      [AlertSeverity.LOW]: '#00CC00',
      [AlertSeverity.INFO]: '#0099FF',
    };

    return colors[severity];
  }

  /**
   * Get emoji for severity level
   */
  private getSeverityEmoji(severity: AlertSeverity): string {
    const emojis: Record<AlertSeverity, string> = {
      [AlertSeverity.CRITICAL]: '🚨',
      [AlertSeverity.HIGH]: '⚠️',
      [AlertSeverity.MEDIUM]: '⚡',
      [AlertSeverity.LOW]: 'ℹ️',
      [AlertSeverity.INFO]: 'ℹ️',
    };

    return emojis[severity];
  }

  /**
   * Send server down alert
   */
  async alertServerDown(component: string, error?: Error): Promise<void> {
    await this.sendAlert({
      severity: AlertSeverity.CRITICAL,
      title: `Server Down: ${component}`,
      message: `The ${component} service is down and not responding.${error ? ` Error: ${error.message}` : ''}`,
      component,
      timestamp: new Date(),
      metadata: {
        error: error?.message,
        stack: error?.stack,
      },
    });
  }

  /**
   * Send database alert
   */
  async alertDatabaseIssue(issue: string, details?: Record<string, any>): Promise<void> {
    await this.sendAlert({
      severity: AlertSeverity.HIGH,
      title: 'Database Issue',
      message: `Database problem detected: ${issue}`,
      component: 'database',
      timestamp: new Date(),
      metadata: details,
    });
  }

  /**
   * Send high memory alert
   */
  async alertHighMemory(usagePercent: number): Promise<void> {
    await this.sendAlert({
      severity: usagePercent > 90 ? AlertSeverity.CRITICAL : AlertSeverity.HIGH,
      title: 'High Memory Usage',
      message: `Memory usage is at ${usagePercent.toFixed(2)}%`,
      component: 'memory',
      timestamp: new Date(),
      metadata: {
        usagePercent: usagePercent.toFixed(2),
      },
    });
  }

  /**
   * Send API error rate alert
   */
  async alertHighErrorRate(errorRate: number, timeWindow: string): Promise<void> {
    await this.sendAlert({
      severity: errorRate > 10 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
      title: 'High API Error Rate',
      message: `API error rate is ${errorRate.toFixed(2)}% in the last ${timeWindow}`,
      component: 'api',
      timestamp: new Date(),
      metadata: {
        errorRate: errorRate.toFixed(2),
        timeWindow,
      },
    });
  }

  /**
   * Send backup failure alert
   */
  async alertBackupFailure(backupId: string, error: Error): Promise<void> {
    await this.sendAlert({
      severity: AlertSeverity.HIGH,
      title: 'Backup Failure',
      message: `Backup ${backupId} failed: ${error.message}`,
      component: 'backup',
      timestamp: new Date(),
      metadata: {
        backupId,
        error: error.message,
      },
    });
  }

  /**
   * Send certificate expiration alert
   */
  async alertCertificateExpiring(domain: string, daysRemaining: number): Promise<void> {
    const severity = daysRemaining <= 7 ? AlertSeverity.CRITICAL : daysRemaining <= 14 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM;

    await this.sendAlert({
      severity,
      title: 'SSL Certificate Expiring',
      message: `SSL certificate for ${domain} will expire in ${daysRemaining} days`,
      component: 'ssl',
      timestamp: new Date(),
      metadata: {
        domain,
        daysRemaining,
      },
    });
  }
}

/**
 * Global alert manager instance
 */
export const alertManager = new AlertManager();
