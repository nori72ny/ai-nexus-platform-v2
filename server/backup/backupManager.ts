import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getDb } from '../db';


const execPromise = promisify(exec);

/**
 * Backup configuration
 */
export interface BackupConfig {
  backupDir: string;
  retentionDays: number;
  maxBackups: number;
  compressionLevel: number;
}

/**
 * Backup metadata
 */
export interface BackupMetadata {
  id: string;
  timestamp: Date;
  type: 'full' | 'incremental';
  size: number;
  status: 'success' | 'failed';
  duration: number;
  tables: string[];
}

/**
 * Backup manager
 */
export class BackupManager {
  private config: BackupConfig;
  private backups: Map<string, BackupMetadata> = new Map();

  constructor(config: Partial<BackupConfig> = {}) {
    this.config = {
      backupDir: config.backupDir || '/backups',
      retentionDays: config.retentionDays || 30,
      maxBackups: config.maxBackups || 100,
      compressionLevel: config.compressionLevel || 9,
    };

    this.ensureBackupDir();
    this.loadBackupMetadata();
  }

  /**
   * Ensure backup directory exists
   */
  private ensureBackupDir(): void {
    if (!fs.existsSync(this.config.backupDir)) {
      fs.mkdirSync(this.config.backupDir, { recursive: true });
    }
  }

  /**
   * Load backup metadata from disk
   */
  private loadBackupMetadata(): void {
    const metadataFile = path.join(this.config.backupDir, 'metadata.json');

    if (fs.existsSync(metadataFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));
        Object.entries(data).forEach(([id, metadata]: [string, any]) => {
          this.backups.set(id, {
            ...metadata,
            timestamp: new Date(metadata.timestamp),
          });
        });
      } catch (error) {
        console.error('Failed to load backup metadata:', error);
      }
    }
  }

  /**
   * Save backup metadata to disk
   */
  private saveBackupMetadata(): void {
    const metadataFile = path.join(this.config.backupDir, 'metadata.json');
    const data: Record<string, BackupMetadata> = {};

    this.backups.forEach((metadata, id) => {
      data[id] = metadata;
    });

    fs.writeFileSync(metadataFile, JSON.stringify(data, null, 2));
  }

  /**
   * Create full database backup
   */
  async createFullBackup(): Promise<BackupMetadata> {
    const startTime = Date.now();
    const backupId = `backup-${Date.now()}`;
    const backupPath = path.join(this.config.backupDir, `${backupId}.sql.gz`);

    try {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Get database URL from environment
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) throw new Error('DATABASE_URL not set');

      // Parse database connection string
      const url = new URL(dbUrl);
      const host = url.hostname;
      const port = url.port || '3306';
      const user = url.username;
      const password = url.password;
      const database = url.pathname.slice(1);

      // Create mysqldump command
      const dumpCommand = `mysqldump -h ${host} -P ${port} -u ${user} -p${password} ${database}`;

      // Execute dump and compress
      const { stdout } = await execPromise(dumpCommand);

      // Compress the dump
      return new Promise((resolve, reject) => {
        const gzip = zlib.createGzip({ level: this.config.compressionLevel });
        const writeStream = fs.createWriteStream(backupPath);

        writeStream.on('finish', () => {
          const stats = fs.statSync(backupPath);
          const duration = Date.now() - startTime;

          const metadata: BackupMetadata = {
            id: backupId,
            timestamp: new Date(),
            type: 'full',
            size: stats.size,
            status: 'success',
            duration,
            tables: [database],
          };

          this.backups.set(backupId, metadata);
          this.saveBackupMetadata();

          resolve(metadata);
        });

        writeStream.on('error', reject);
        gzip.on('error', reject);

        gzip.write(stdout);
        gzip.pipe(writeStream);
        gzip.end();
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      const metadata: BackupMetadata = {
        id: backupId,
        timestamp: new Date(),
        type: 'full',
        size: 0,
        status: 'failed',
        duration,
        tables: [],
      };

      this.backups.set(backupId, metadata);
      this.saveBackupMetadata();

      console.error('Backup failed:', error);
      throw error;
    }
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(backupId: string): Promise<void> {
    const metadata = this.backups.get(backupId);
    if (!metadata) throw new Error(`Backup ${backupId} not found`);

    const backupPath = path.join(this.config.backupDir, `${backupId}.sql.gz`);
    if (!fs.existsSync(backupPath)) throw new Error(`Backup file not found: ${backupPath}`);

    try {
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) throw new Error('DATABASE_URL not set');

      const url = new URL(dbUrl);
      const host = url.hostname;
      const port = url.port || '3306';
      const user = url.username;
      const password = url.password;
      const database = url.pathname.slice(1);

      // Decompress and restore
      const gunzip = zlib.createGunzip();
      const readStream = fs.createReadStream(backupPath);

      const restoreCommand = `mysql -h ${host} -P ${port} -u ${user} -p${password} ${database}`;

      return new Promise((resolve, reject) => {
        const restoreProcess = exec(restoreCommand, (error, stdout, stderr) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });

        if (restoreProcess.stdin) {
          const stdin = restoreProcess.stdin as any;
        readStream.pipe(gunzip).pipe(stdin);
        }

        readStream.on('error', reject);
        gunzip.on('error', reject);
      });
    } catch (error) {
      console.error('Restore failed:', error);
      throw error;
    }
  }

  /**
   * List all backups
   */
  listBackups(): BackupMetadata[] {
    return Array.from(this.backups.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  /**
   * Delete old backups
   */
  async cleanupOldBackups(): Promise<void> {
    const now = Date.now();
    const retentionMs = this.config.retentionDays * 24 * 60 * 60 * 1000;

    const backupsToDelete: string[] = [];

    this.backups.forEach((metadata, id) => {
      const age = now - metadata.timestamp.getTime();

      if (age > retentionMs) {
        backupsToDelete.push(id);
      }
    });

    // Keep only the most recent maxBackups
    const sortedBackups = this.listBackups();
    if (sortedBackups.length > this.config.maxBackups) {
      sortedBackups.slice(this.config.maxBackups).forEach(backup => {
        backupsToDelete.push(backup.id);
      });
    }

    // Delete backups
    for (const id of backupsToDelete) {
      try {
        const backupPath = path.join(this.config.backupDir, `${id}.sql.gz`);
        if (fs.existsSync(backupPath)) {
          fs.unlinkSync(backupPath);
        }
        this.backups.delete(id);
      } catch (error) {
        console.error(`Failed to delete backup ${id}:`, error);
      }
    }

    this.saveBackupMetadata();
  }

  /**
   * Get backup statistics
   */
  getStatistics(): {
    totalBackups: number;
    totalSize: number;
    oldestBackup: Date | null;
    newestBackup: Date | null;
    successfulBackups: number;
    failedBackups: number;
  } {
    const backups = Array.from(this.backups.values());

    return {
      totalBackups: backups.length,
      totalSize: backups.reduce((sum, b) => sum + b.size, 0),
      oldestBackup: backups.length > 0 ? backups[backups.length - 1].timestamp : null,
      newestBackup: backups.length > 0 ? backups[0].timestamp : null,
      successfulBackups: backups.filter(b => b.status === 'success').length,
      failedBackups: backups.filter(b => b.status === 'failed').length,
    };
  }
}

/**
 * Global backup manager instance
 */
export const backupManager = new BackupManager({
  backupDir: process.env.BACKUP_DIR || '/backups',
  retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10),
  maxBackups: parseInt(process.env.MAX_BACKUPS || '100', 10),
});
