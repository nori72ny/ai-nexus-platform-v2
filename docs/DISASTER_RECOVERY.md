# AI Nexus Personal - Disaster Recovery Runbook

**Document Version:** 1.0  
**Last Updated:** 2026-06-16  
**RTO Target:** 30 minutes  
**RPO Target:** 24 hours  

---

## Table of Contents

1. [Overview](#overview)
2. [Backup Strategy](#backup-strategy)
3. [Recovery Procedures](#recovery-procedures)
4. [Incident Response](#incident-response)
5. [Testing & Validation](#testing--validation)
6. [Contact & Escalation](#contact--escalation)

---

## Overview

This runbook provides step-by-step procedures for recovering AI Nexus Personal from various failure scenarios. The system is designed to meet:

- **RTO (Recovery Time Objective):** 30 minutes maximum downtime
- **RPO (Recovery Point Objective):** 24 hours maximum data loss

### Backup Architecture

```
Daily Backup (2 AM UTC)
    ↓
Weekly Backup (Sunday 3 AM UTC)
    ↓
Monthly Backup (1st at 4 AM UTC)
    ↓
Retention Policy: 30 days (max 100 backups)
```

---

## Backup Strategy

### Backup Schedule

| Frequency | Time (UTC) | Retention | Purpose |
|-----------|-----------|-----------|---------|
| Daily | 2:00 AM | 7 days | Quick recovery from recent failures |
| Weekly | 3:00 AM Sunday | 30 days | Mid-term recovery point |
| Monthly | 4:00 AM 1st | 90 days | Long-term archival |

### Backup Components

Each backup includes:

1. **Database** - Full MySQL dump (compressed with gzip)
2. **Configuration** - Environment variables and secrets
3. **User Data** - Tasks, reports, analysis results
4. **Metadata** - Backup timestamp, size, status

### Backup Storage

- **Location:** `/backups` directory (mounted volume in production)
- **Format:** `backup-{timestamp}.sql.gz`
- **Compression:** gzip level 9 (maximum compression)
- **Metadata:** `metadata.json` (tracks all backups)

---

## Recovery Procedures

### Scenario 1: Database Corruption

**Symptoms:** Database queries fail, application errors, data inconsistency

**Recovery Steps:**

1. **Assess the situation**
   ```bash
   # Check database status
   docker-compose -f docker-compose.prod.yml exec mysql mysqladmin ping -h localhost
   
   # Check error logs
   docker-compose -f docker-compose.prod.yml logs mysql | tail -100
   ```

2. **Stop the application**
   ```bash
   docker-compose -f docker-compose.prod.yml stop app
   ```

3. **List available backups**
   ```bash
   # SSH to production server
   ssh user@production-host
   
   # List backups
   ls -lh /backups/*.sql.gz
   cat /backups/metadata.json | jq '.'
   ```

4. **Select appropriate backup**
   - Choose the most recent successful backup before corruption occurred
   - Verify backup status is "success" in metadata

5. **Restore from backup**
   ```bash
   # Run restore script
   docker-compose -f docker-compose.prod.yml exec mysql bash -c '
     gunzip < /backups/backup-{TIMESTAMP}.sql.gz | mysql -u root -p{PASSWORD} {DATABASE}
   '
   ```

6. **Verify restoration**
   ```bash
   # Check row counts in key tables
   docker-compose -f docker-compose.prod.yml exec mysql mysql -u root -p{PASSWORD} {DATABASE} -e "
     SELECT COUNT(*) as users FROM users;
     SELECT COUNT(*) as tasks FROM tasks;
     SELECT COUNT(*) as reports FROM reports;
   "
   ```

7. **Restart application**
   ```bash
   docker-compose -f docker-compose.prod.yml start app
   docker-compose -f docker-compose.prod.yml logs -f app
   ```

8. **Health check**
   ```bash
   curl https://production-host/health
   ```

**Estimated Recovery Time:** 10-15 minutes

### Scenario 2: Complete Server Failure

**Symptoms:** Server unreachable, all services down, infrastructure failure

**Recovery Steps:**

1. **Provision new server**
   - Create new VM with same specifications
   - Install Docker and Docker Compose
   - Configure networking and firewall

2. **Restore from backup**
   ```bash
   # Copy backup to new server
   scp /backups/backup-{TIMESTAMP}.sql.gz user@new-host:/backups/
   
   # SSH to new server
   ssh user@new-host
   
   # Extract and restore
   gunzip < /backups/backup-{TIMESTAMP}.sql.gz | mysql -u root -p{PASSWORD} {DATABASE}
   ```

3. **Deploy application**
   ```bash
   # Clone repository
   git clone https://github.com/your-org/ai-nexus-platform-v2.git
   cd ai-nexus-platform-v2
   
   # Copy environment file
   cp .env.production .env
   
   # Start services
   docker-compose -f docker-compose.prod.yml up -d
   ```

4. **Verify services**
   ```bash
   # Check all containers
   docker-compose -f docker-compose.prod.yml ps
   
   # Check health endpoints
   curl https://new-host/health
   curl https://new-host/ready
   ```

5. **Update DNS**
   - Point domain to new server IP
   - Wait for DNS propagation (typically 5-15 minutes)

6. **Monitor and validate**
   - Check application logs
   - Verify data integrity
   - Run smoke tests

**Estimated Recovery Time:** 20-30 minutes

### Scenario 3: Data Loss

**Symptoms:** Missing user data, deleted records, accidental data modification

**Recovery Steps:**

1. **Identify data loss scope**
   - Determine when data was lost
   - Identify affected records/users
   - Calculate RPO (how much data lost)

2. **Select backup point**
   ```bash
   # List backups with timestamps
   ls -lh /backups/*.sql.gz | awk '{print $6, $7, $8, $9}'
   ```

3. **Restore to point-in-time**
   ```bash
   # Create backup of current state (for comparison)
   mysqldump -u root -p{PASSWORD} {DATABASE} > /backups/current-state.sql
   
   # Restore from backup
   gunzip < /backups/backup-{TIMESTAMP}.sql.gz | mysql -u root -p{PASSWORD} {DATABASE}
   ```

4. **Verify data restoration**
   ```bash
   # Check specific tables
   docker-compose -f docker-compose.prod.yml exec mysql mysql -u root -p{PASSWORD} {DATABASE} -e "
     SELECT * FROM tasks WHERE id = {TASK_ID};
     SELECT * FROM reports WHERE id = {REPORT_ID};
   "
   ```

5. **Notify affected users**
   - Send notification about data recovery
   - Explain what data was recovered
   - Provide support contact information

**Estimated Recovery Time:** 5-10 minutes

### Scenario 4: Application Crash

**Symptoms:** Application not responding, 500 errors, service unavailable

**Recovery Steps:**

1. **Check application status**
   ```bash
   docker-compose -f docker-compose.prod.yml ps
   docker-compose -f docker-compose.prod.yml logs app | tail -50
   ```

2. **Restart application**
   ```bash
   docker-compose -f docker-compose.prod.yml restart app
   ```

3. **Check dependencies**
   ```bash
   # Verify database is accessible
   docker-compose -f docker-compose.prod.yml exec app curl http://mysql:3306
   
   # Verify Redis is accessible
   docker-compose -f docker-compose.prod.yml exec app redis-cli -h redis ping
   ```

4. **Monitor recovery**
   ```bash
   docker-compose -f docker-compose.prod.yml logs -f app
   ```

5. **Health check**
   ```bash
   curl https://production-host/health
   ```

**Estimated Recovery Time:** 2-5 minutes

---

## Incident Response

### Severity Levels

| Level | Impact | Response Time | Action |
|-------|--------|---------------|--------|
| Critical | Complete outage | Immediate | Page on-call engineer |
| High | Partial outage | 15 minutes | Start recovery procedure |
| Medium | Degraded performance | 1 hour | Investigate and plan fix |
| Low | Minor issues | 4 hours | Schedule maintenance |

### Response Checklist

- [ ] Assess severity and impact
- [ ] Notify stakeholders
- [ ] Start recovery procedure
- [ ] Monitor progress
- [ ] Verify restoration
- [ ] Document incident
- [ ] Post-mortem analysis

### Communication Template

```
INCIDENT ALERT
==============
Severity: [CRITICAL/HIGH/MEDIUM/LOW]
Service: AI Nexus Personal
Status: [INVESTIGATING/RECOVERING/RESOLVED]
Impact: [Description of impact]
ETA: [Estimated time to resolution]
Updates: [Periodic updates]
```

---

## Testing & Validation

### Monthly Backup Test

**Schedule:** First Sunday of each month

**Procedure:**

1. Select a random backup from the past month
2. Restore to a test environment
3. Verify data integrity
4. Run smoke tests
5. Document results

### Quarterly Disaster Recovery Drill

**Schedule:** Quarterly (every 3 months)

**Procedure:**

1. Simulate complete server failure
2. Restore from backup to new environment
3. Verify all services operational
4. Measure actual RTO
5. Document lessons learned

### Backup Verification Script

```bash
#!/bin/bash
# verify_backups.sh - Verify backup integrity

BACKUP_DIR="/backups"
METADATA_FILE="$BACKUP_DIR/metadata.json"

# Check metadata file exists
if [ ! -f "$METADATA_FILE" ]; then
  echo "ERROR: Metadata file not found"
  exit 1
fi

# Verify each backup
jq -r '.[] | .id' "$METADATA_FILE" | while read backup_id; do
  BACKUP_FILE="$BACKUP_DIR/$backup_id.sql.gz"
  
  if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file missing: $BACKUP_FILE"
    continue
  fi
  
  # Test gzip integrity
  if gunzip -t "$BACKUP_FILE" 2>/dev/null; then
    echo "OK: $backup_id"
  else
    echo "ERROR: Corrupted backup: $backup_id"
  fi
done
```

---

## Contact & Escalation

### On-Call Engineer

- **Primary:** [Engineer Name] - [Phone] - [Email]
- **Secondary:** [Engineer Name] - [Phone] - [Email]
- **Manager:** [Manager Name] - [Phone] - [Email]

### Escalation Path

1. **Tier 1:** On-call engineer (first responder)
2. **Tier 2:** Engineering manager (if Tier 1 unavailable)
3. **Tier 3:** Director of Engineering (if critical and unresolved)

### External Contacts

- **Infrastructure Provider:** [Provider] - [Support URL] - [Phone]
- **Database Support:** [Support Contact]
- **Backup Service:** [Support Contact]

---

## Appendix

### A. Environment Variables

Required environment variables for recovery:

```bash
DATABASE_URL=mysql://user:password@mysql:3306/database
REDIS_URL=redis://:password@redis:6379
JWT_SECRET=your-secret-key
VITE_APP_ID=your-app-id
```

### B. Useful Commands

```bash
# List all backups
ls -lh /backups/*.sql.gz

# Show backup metadata
cat /backups/metadata.json | jq '.'

# Test backup integrity
gunzip -t /backups/backup-{TIMESTAMP}.sql.gz

# Restore specific backup
gunzip < /backups/backup-{TIMESTAMP}.sql.gz | mysql -u root -p{PASSWORD} {DATABASE}

# Check database size
du -sh /var/lib/mysql

# Monitor backup progress
watch -n 5 'ls -lh /backups/*.sql.gz | tail -1'
```

### C. Recovery Time Estimates

| Scenario | RTO | RPO | Complexity |
|----------|-----|-----|-----------|
| Database Corruption | 15 min | 24 h | Low |
| Server Failure | 30 min | 24 h | High |
| Data Loss | 10 min | 24 h | Medium |
| App Crash | 5 min | 0 h | Low |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-16 | DevOps Team | Initial version |

---

**Last Tested:** [Date]  
**Next Test Scheduled:** [Date]  
**Approved By:** [Name/Title]
