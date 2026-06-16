import { CronJob } from 'cron';
import { backupManager } from './backupManager';
import { logAudit } from '../auditLog';

/**
 * Backup scheduler using cron jobs
 */
export class BackupScheduler {
  private jobs: Map<string, CronJob> = new Map();

  /**
   * Schedule daily backup at 2 AM
   */
  scheduleDailyBackup(): void {
    const job = new CronJob('0 2 * * *', async () => {
      try {
        console.log('[BackupScheduler] Starting daily backup...');
        const metadata = await backupManager.createFullBackup();
        console.log('[BackupScheduler] Daily backup completed:', metadata.id);

        // Log backup event
        await logAudit(null as any, {
          action: 'BACKUP_CREATED',
          resourceType: 'backup',
          resourceId: metadata.id,
          details: {
            type: 'daily',
            size: metadata.size,
            status: metadata.status,
          },
        });
      } catch (error) {
        console.error('[BackupScheduler] Daily backup failed:', error);

        // Log backup failure
        await logAudit(null as any, {
          action: 'BACKUP_FAILED',
          resourceType: 'backup',
          details: {
            type: 'daily',
            error: String(error),
          },
        });
      }
    });

    job.start();
    this.jobs.set('daily', job);
    console.log('[BackupScheduler] Daily backup scheduled for 2 AM');
  }

  /**
   * Schedule weekly backup on Sunday at 3 AM
   */
  scheduleWeeklyBackup(): void {
    const job = new CronJob('0 3 * * 0', async () => {
      try {
        console.log('[BackupScheduler] Starting weekly backup...');
        const metadata = await backupManager.createFullBackup();
        console.log('[BackupScheduler] Weekly backup completed:', metadata.id);

        // Log backup event
        await logAudit(null as any, {
          action: 'BACKUP_CREATED',
          resourceType: 'backup',
          resourceId: metadata.id,
          details: {
            type: 'weekly',
            size: metadata.size,
            status: metadata.status,
          },
        });
      } catch (error) {
        console.error('[BackupScheduler] Weekly backup failed:', error);

        // Log backup failure
        await logAudit(null as any, {
          action: 'BACKUP_FAILED',
          resourceType: 'backup',
          details: {
            type: 'weekly',
            error: String(error),
          },
        });
      }
    });

    job.start();
    this.jobs.set('weekly', job);
    console.log('[BackupScheduler] Weekly backup scheduled for Sunday 3 AM');
  }

  /**
   * Schedule monthly backup on 1st at 4 AM
   */
  scheduleMonthlyBackup(): void {
    const job = new CronJob('0 4 1 * *', async () => {
      try {
        console.log('[BackupScheduler] Starting monthly backup...');
        const metadata = await backupManager.createFullBackup();
        console.log('[BackupScheduler] Monthly backup completed:', metadata.id);

        // Log backup event
        await logAudit(null as any, {
          action: 'BACKUP_CREATED',
          resourceType: 'backup',
          resourceId: metadata.id,
          details: {
            type: 'monthly',
            size: metadata.size,
            status: metadata.status,
          },
        });
      } catch (error) {
        console.error('[BackupScheduler] Monthly backup failed:', error);

        // Log backup failure
        await logAudit(null as any, {
          action: 'BACKUP_FAILED',
          resourceType: 'backup',
          details: {
            type: 'monthly',
            error: String(error),
          },
        });
      }
    });

    job.start();
    this.jobs.set('monthly', job);
    console.log('[BackupScheduler] Monthly backup scheduled for 1st at 4 AM');
  }

  /**
   * Schedule cleanup job every 6 hours
   */
  scheduleCleanup(): void {
    const job = new CronJob('0 */6 * * *', async () => {
      try {
        console.log('[BackupScheduler] Starting backup cleanup...');
        await backupManager.cleanupOldBackups();
        console.log('[BackupScheduler] Backup cleanup completed');

        // Log cleanup event
        await logAudit(null as any, {
          action: 'BACKUP_CLEANUP',
          resourceType: 'backup',
          details: {
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.error('[BackupScheduler] Cleanup failed:', error);
      }
    });

    job.start();
    this.jobs.set('cleanup', job);
    console.log('[BackupScheduler] Cleanup scheduled every 6 hours');
  }

  /**
   * Start all backup schedules
   */
  startAll(): void {
    console.log('[BackupScheduler] Starting all backup schedules...');
    this.scheduleDailyBackup();
    this.scheduleWeeklyBackup();
    this.scheduleMonthlyBackup();
    this.scheduleCleanup();
    console.log('[BackupScheduler] All backup schedules started');
  }

  /**
   * Stop all backup schedules
   */
  stopAll(): void {
    console.log('[BackupScheduler] Stopping all backup schedules...');
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`[BackupScheduler] Stopped ${name} backup schedule`);
    });
    this.jobs.clear();
  }

  /**
   * Get job status
   */
  getStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    this.jobs.forEach((job, name) => {
      status[name] = (job as any).running || false;
    });
    return status;
  }
}

/**
 * Global backup scheduler instance
 */
export const backupScheduler = new BackupScheduler();
