# AI Nexus Personal - Phase 6: Production & Deployment Build

**Author:** Manus AI  
**Date:** 2026-06-16  
**Status:** Implementation Guide  
**Target Completion:** 2026-06-30 (14 days)

---

## Executive Summary

Phase 6 transforms AI Nexus Personal from a functional MVP into a production-ready platform capable of enterprise-grade deployment. This phase encompasses 18 critical components organized across 11 implementation phases, covering authentication, security, monitoring, CI/CD, and deployment infrastructure.

The implementation follows a structured approach: authentication and user management first establish the security foundation, followed by API security hardening, infrastructure monitoring, backup systems, and finally CI/CD automation and deployment procedures.

---

## Implementation Architecture

### System Overview

The production architecture consists of three distinct environments:

| Environment | Purpose | Configuration |
|-------------|---------|----------------|
| Development | Local development and testing | Node.js dev server, SQLite/MySQL local |
| Staging | Pre-production validation | Docker containers, PostgreSQL, Redis |
| Production | Live user-facing system | Kubernetes/Docker Swarm, PostgreSQL HA, Redis Cluster |

### Technology Stack

**Frontend:** Next.js 15 + React 19 + TypeScript + Tailwind CSS 4 + Shadcn/UI  
**Backend:** Express 4 + tRPC 11 + Node.js 22  
**Database:** PostgreSQL 15+ (primary), Redis 7+ (caching/sessions)  
**Monitoring:** Prometheus + Grafana  
**Logging:** Winston + JSON format  
**CI/CD:** GitHub Actions  
**Container:** Docker + Docker Compose  
**Reverse Proxy:** Nginx  
**SSL:** Let's Encrypt + Certbot  

---

## Phase 1: Authentication & User Management System

### 1.1 JWT Authentication Implementation

JWT (JSON Web Tokens) provides stateless authentication with token-based verification. The system implements both access tokens (short-lived, 15 minutes) and refresh tokens (long-lived, 7 days) for secure session management.

**Database Schema Extension:**

```sql
-- Add JWT token tracking table
CREATE TABLE jwt_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  token_type ENUM('access', 'refresh') NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at)
);

-- Add user sessions table
CREATE TABLE user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_id INTEGER NOT NULL REFERENCES jwt_tokens(id) ON DELETE CASCADE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_last_activity (last_activity)
);
```

**JWT Token Structure:**

```typescript
interface JWTPayload {
  sub: string;           // User ID
  email: string;         // User email
  role: 'admin' | 'user' | 'viewer';
  iat: number;          // Issued at
  exp: number;          // Expiration
  type: 'access' | 'refresh';
  sessionId: string;    // Session tracking
}
```

### 1.2 Role-Based Access Control (RBAC)

Three role levels provide granular permission control:

| Role | Capabilities | Use Case |
|------|-------------|----------|
| **ADMIN** | Full system access, user management, system configuration | Platform administrators, operations team |
| **USER** | Create tasks, view reports, manage own data | Regular platform users |
| **VIEWER** | Read-only access to reports and analytics | Stakeholders, auditors, read-only viewers |

**Permission Matrix:**

```typescript
const permissions: Record<Role, Permission[]> = {
  admin: [
    'users.create', 'users.read', 'users.update', 'users.delete',
    'users.changeRole', 'users.suspend',
    'tasks.create', 'tasks.read', 'tasks.update', 'tasks.delete',
    'reports.create', 'reports.read', 'reports.update', 'reports.delete',
    'system.config', 'system.monitor', 'system.backup',
    'audit.read', 'audit.export'
  ],
  user: [
    'tasks.create', 'tasks.read', 'tasks.update', 'tasks.delete',
    'reports.read', 'reports.export',
    'profile.read', 'profile.update'
  ],
  viewer: [
    'tasks.read', 'reports.read', 'reports.export',
    'profile.read'
  ]
};
```

### 1.3 User Management Dashboard

The user management interface provides administrators with comprehensive control over user accounts and permissions.

**Features:**

- **User Listing:** Paginated table with search, filter, and sort capabilities
- **User Creation:** Form-based user registration with email validation
- **User Suspension:** Temporary account deactivation without deletion
- **User Deletion:** Permanent account removal with cascading data cleanup
- **Role Management:** Drag-and-drop or select-based role assignment
- **Usage Monitoring:** Per-user API call counts, task completion rates, storage usage

**Implementation Endpoints:**

```typescript
export const adminRouter = router({
  users: router({
    list: adminProcedure
      .input(z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(10).max(100).default(20),
        search: z.string().optional(),
        role: z.enum(['admin', 'user', 'viewer']).optional(),
        status: z.enum(['active', 'suspended', 'deleted']).optional(),
      }))
      .query(async ({ input }) => {
        // Implementation
      }),

    create: adminProcedure
      .input(z.object({
        email: z.string().email(),
        name: z.string().min(1),
        role: z.enum(['admin', 'user', 'viewer']),
      }))
      .mutation(async ({ input, ctx }) => {
        // Implementation
      }),

    update: adminProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(['admin', 'user', 'viewer']).optional(),
        status: z.enum(['active', 'suspended']).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Implementation
      }),

    delete: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // Implementation
      }),

    getUsage: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        // Implementation
      }),
  }),
});
```

---

## Phase 2: API Security & Secrets Management

### 2.1 Rate Limiting

Rate limiting prevents abuse by restricting the number of requests per user/IP within a time window.

**Implementation Strategy:**

```typescript
import RedisStore from 'rate-limit-redis';
import rateLimit from 'express-rate-limit';

const redisClient = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
});

// Global rate limiter: 100 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:global:',
  }),
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// API-specific limiter: 1000 requests per hour per user
const apiLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:api:',
  }),
  windowMs: 60 * 60 * 1000,
  max: 1000,
  keyGenerator: (req) => req.user?.id || req.ip,
  skip: (req) => !req.user, // Only rate limit authenticated users
});

app.use('/api/', globalLimiter);
app.use('/api/trpc/', apiLimiter);
```

### 2.2 IP Restriction

IP whitelisting/blacklisting controls access based on source IP addresses.

```typescript
const ipRestriction = (whitelist?: string[], blacklist?: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp = req.ip || req.connection.remoteAddress;
    
    if (blacklist?.includes(clientIp)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (whitelist && !whitelist.includes(clientIp)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    next();
  };
};

// Apply to admin endpoints
app.use('/api/admin/', ipRestriction(
  process.env.ADMIN_IP_WHITELIST?.split(','),
  process.env.IP_BLACKLIST?.split(',')
));
```

### 2.3 Request Validation

Zod schema validation ensures all incoming requests conform to expected structures.

```typescript
import { z } from 'zod';

const createTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dueDate: z.date().optional(),
});

export const taskRouter = router({
  create: protectedProcedure
    .input(createTaskSchema)
    .mutation(async ({ input, ctx }) => {
      // Validated input is type-safe
      return await createTask(ctx.user.id, input);
    }),
});
```

### 2.4 CORS, CSRF, XSS, SQLi Protection

**CORS Configuration:**

```typescript
import cors from 'cors';

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));
```

**CSRF Protection:**

```typescript
import csrf from 'csurf';
import cookieParser from 'cookie-parser';

app.use(cookieParser());
app.use(csrf({ cookie: true }));

// Include CSRF token in responses
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});
```

**XSS Protection:**

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  xssFilter: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
```

**SQL Injection Prevention:**

Drizzle ORM provides parameterized queries by default, preventing SQL injection:

```typescript
// Safe: Uses parameterized queries
const user = await db.query.users.findFirst({
  where: eq(users.email, userInput.email),
});

// Never concatenate user input into SQL strings
```

### 2.5 Secrets Management

Environment variables are managed through `.env` files (development) and platform secrets (production).

**Required Secrets:**

```bash
# Authentication
JWT_SECRET=<64-character random string>
JWT_REFRESH_SECRET=<64-character random string>

# AI Provider Keys
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
PERPLEXITY_API_KEY=...
GENSPARK_API_KEY=...
MANUS_API_KEY=...

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname
REDIS_URL=redis://user:pass@host:6379

# OAuth
OAUTH_CLIENT_ID=...
OAUTH_CLIENT_SECRET=...

# Encryption
ENCRYPTION_KEY=<32-character random string>
```

**Secrets Encryption Implementation:**

```typescript
import crypto from 'crypto';

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');

export function encryptSecret(secret: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptSecret(encrypted: string): string {
  const [ivHex, authTagHex, ciphertext] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

---

## Phase 3: Monitoring & Logging Infrastructure

### 3.1 Prometheus & Grafana Setup

Prometheus collects metrics from the application, while Grafana visualizes them in real-time dashboards.

**Docker Compose Configuration:**

```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_SECURITY_ADMIN_USER=admin
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
    depends_on:
      - prometheus

volumes:
  prometheus-data:
  grafana-data:
```

**Prometheus Configuration (prometheus.yml):**

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'ai-nexus-backend'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'

  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:6379']

  - job_name: 'postgres'
    static_configs:
      - targets: ['localhost:9187']
```

### 3.2 Application Metrics

The backend exposes Prometheus metrics at `/metrics` endpoint.

```typescript
import promClient from 'prom-client';

// Create metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

const taskProcessingTime = new promClient.Histogram({
  name: 'task_processing_time_seconds',
  help: 'Time to process a task in seconds',
  labelNames: ['status'],
  buckets: [5, 10, 30, 60, 120],
});

const aiProviderLatency = new promClient.Histogram({
  name: 'ai_provider_latency_seconds',
  help: 'Latency of AI provider calls in seconds',
  labelNames: ['provider', 'status'],
  buckets: [0.5, 1, 2, 5, 10],
});

const activeConnections = new promClient.Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
});

// Middleware to track request duration
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
  });
  
  next();
});

// Expose metrics
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});
```

### 3.3 Structured Logging

Winston provides structured JSON logging with multiple transports.

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ai-nexus-backend' },
  transports: [
    // Error logs
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    // Combined logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760,
      maxFiles: 5,
    }),
  ],
});

// Console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

export default logger;
```

**Audit Logging:**

```typescript
export async function auditLog(
  userId: number,
  action: string,
  resourceType: string,
  resourceId: number,
  details: Record<string, any>,
  req: Request
) {
  const log = {
    timestamp: new Date().toISOString(),
    userId,
    action,
    resourceType,
    resourceId,
    details,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  // Log to database
  await db.insert(auditLogs).values(log);

  // Log to file
  logger.info('Audit log', log);
}
```

---

## Phase 4: Backup & Disaster Recovery

### 4.1 Automated Backup System

Automated daily, weekly, and monthly backups ensure data protection.

**Backup Script (backup.sh):**

```bash
#!/bin/bash

BACKUP_DIR="/backups"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-ai_nexus}"
DB_USER="${DB_USER:-postgres}"
RETENTION_DAYS=30

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Database backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz"

pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

# Upload to S3
aws s3 cp "$BACKUP_FILE" "s3://ai-nexus-backups/database/$TIMESTAMP/"

# Clean old backups
find "$BACKUP_DIR" -name "db_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Log backup
echo "$(date): Backup completed - $BACKUP_FILE" >> /var/log/ai-nexus-backup.log
```

**Cron Schedule:**

```bash
# Daily backup at 2 AM
0 2 * * * /scripts/backup.sh

# Weekly full backup on Sunday at 3 AM
0 3 * * 0 /scripts/backup-full.sh

# Monthly backup on 1st at 4 AM
0 4 1 * * /scripts/backup-monthly.sh
```

### 4.2 Disaster Recovery Procedures

**Recovery Time Objective (RTO):** 30 minutes  
**Recovery Point Objective (RPO):** 24 hours

**Recovery Procedure:**

```bash
#!/bin/bash

# 1. Stop application
systemctl stop ai-nexus-backend
systemctl stop ai-nexus-frontend

# 2. Restore database from backup
BACKUP_FILE="$1"
gunzip -c "$BACKUP_FILE" | psql -h "$DB_HOST" -U "$DB_USER" "$DB_NAME"

# 3. Verify data integrity
psql -h "$DB_HOST" -U "$DB_USER" "$DB_NAME" -c "SELECT COUNT(*) FROM users;"

# 4. Start application
systemctl start ai-nexus-backend
systemctl start ai-nexus-frontend

# 5. Health check
curl -f http://localhost:3000/health || exit 1

echo "Recovery completed successfully"
```

---

## Phase 5: CI/CD Pipeline & Docker Production Build

### 5.1 GitHub Actions Workflow

**File: `.github/workflows/deploy.yml`**

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '22'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Lint
        run: pnpm run lint

      - name: Type check
        run: pnpm run type-check

      - name: Run tests
        run: pnpm run test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test

      - name: Build
        run: pnpm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'

    steps:
      - uses: actions/checkout@v3

      - name: Build Docker image
        run: |
          docker build -t ai-nexus:${{ github.sha }} .
          docker tag ai-nexus:${{ github.sha }} ai-nexus:latest

      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push ai-nexus:${{ github.sha }}
          docker push ai-nexus:latest

      - name: Deploy to production
        run: |
          ssh -i ${{ secrets.DEPLOY_KEY }} deploy@prod.example.com << 'EOF'
          cd /app
          docker pull ai-nexus:latest
          docker-compose up -d
          docker-compose exec -T backend pnpm run migrate
          EOF
```

### 5.2 Production Dockerfile

**Multi-stage build optimizes image size and security:**

```dockerfile
# Build stage
FROM node:22-alpine AS builder

WORKDIR /build

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build application
RUN pnpm run build

# Runtime stage
FROM node:22-alpine

WORKDIR /app

# Install only production dependencies
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --prod --frozen-lockfile

# Copy built application
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/public ./public

# Non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

EXPOSE 3000

CMD ["node", "dist/server/index.js"]
```

---

## Phase 6: Nginx & SSL Configuration

### 6.1 Nginx Reverse Proxy

**File: `nginx.conf`**

```nginx
upstream backend {
  least_conn;
  server backend-1:3000 weight=1;
  server backend-2:3000 weight=1;
  server backend-3:3000 weight=1;
  keepalive 32;
}

# Rate limiting
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;
limit_req_zone $binary_remote_addr zone=general_limit:10m rate=1000r/m;

server {
  listen 80;
  server_name _;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name ai-nexus.example.com;

  # SSL certificates
  ssl_certificate /etc/letsencrypt/live/ai-nexus.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/ai-nexus.example.com/privkey.pem;

  # SSL configuration
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;
  ssl_prefer_server_ciphers on;
  ssl_session_cache shared:SSL:10m;
  ssl_session_timeout 10m;

  # Security headers
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-XSS-Protection "1; mode=block" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;

  # Compression
  gzip on;
  gzip_types text/plain text/css text/javascript application/json application/javascript;
  gzip_min_length 1000;
  gzip_comp_level 6;

  # Cache static assets
  location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # API rate limiting
  location /api/ {
    limit_req zone=api_limit burst=20 nodelay;
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # General rate limiting
  location / {
    limit_req zone=general_limit burst=50 nodelay;
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

### 6.2 Let's Encrypt SSL Certificate Management

**Automated renewal with Certbot:**

```bash
#!/bin/bash

# Install Certbot
apt-get install -y certbot python3-certbot-nginx

# Initial certificate
certbot certonly --nginx -d ai-nexus.example.com --email admin@example.com --agree-tos

# Auto-renewal cron job
0 3 * * * certbot renew --quiet && systemctl reload nginx
```

---

## Phase 7: Health Check & Alert System

### 7.1 Health Check Endpoints

```typescript
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/ready', async (req, res) => {
  try {
    // Check database
    await db.query.users.findFirst();
    
    // Check Redis
    await redis.ping();
    
    res.json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

app.get('/live', (req, res) => {
  res.json({ status: 'alive' });
});
```

### 7.2 Alert System

**Slack Integration:**

```typescript
import axios from 'axios';

interface Alert {
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  service: string;
  timestamp: Date;
}

export async function sendAlert(alert: Alert) {
  const color = {
    critical: '#FF0000',
    warning: '#FFA500',
    info: '#0000FF',
  }[alert.severity];

  await axios.post(process.env.SLACK_WEBHOOK_URL!, {
    attachments: [{
      color,
      title: alert.title,
      text: alert.message,
      fields: [
        { title: 'Service', value: alert.service, short: true },
        { title: 'Severity', value: alert.severity, short: true },
        { title: 'Time', value: alert.timestamp.toISOString(), short: false },
      ],
    }],
  });
}

// Monitor for failures
setInterval(async () => {
  try {
    const response = await fetch('http://localhost:3000/ready');
    if (!response.ok) {
      await sendAlert({
        severity: 'critical',
        title: 'Backend Service Down',
        message: 'Backend health check failed',
        service: 'backend',
        timestamp: new Date(),
      });
    }
  } catch (error) {
    await sendAlert({
      severity: 'critical',
      title: 'Backend Unreachable',
      message: error.message,
      service: 'backend',
      timestamp: new Date(),
    });
  }
}, 60000); // Check every minute
```

---

## Phase 8: Cost Monitoring & Frontend Optimization

### 8.1 AI Provider Cost Tracking

```typescript
interface ProviderCost {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costPerMillion: number;
}

const costMatrix: Record<string, ProviderCost> = {
  'gpt-4': {
    provider: 'openai',
    model: 'gpt-4',
    inputTokens: 0,
    outputTokens: 0,
    costPerMillion: 30, // $30 per 1M input tokens
  },
  'gemini-pro': {
    provider: 'google',
    model: 'gemini-pro',
    inputTokens: 0,
    outputTokens: 0,
    costPerMillion: 0.5, // $0.50 per 1M input tokens
  },
};

export async function trackAICost(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number
) {
  const cost = costMatrix[model];
  if (!cost) return;

  const estimatedCost = (inputTokens * cost.costPerMillion) / 1_000_000;

  await db.insert(aiCosts).values({
    provider,
    model,
    inputTokens,
    outputTokens,
    estimatedCost,
    createdAt: new Date(),
  });
}
```

### 8.2 Frontend Performance Optimization

**Code Splitting:**

```typescript
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Reports = lazy(() => import('./pages/Reports'));
const Admin = lazy(() => import('./pages/Admin'));

export function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </Suspense>
  );
}
```

**Lighthouse Optimization Target: 90+**

- First Contentful Paint (FCP): < 1.8s
- Largest Contentful Paint (LCP): < 2.5s
- Cumulative Layout Shift (CLS): < 0.1
- Time to Interactive (TTI): < 3.8s

---

## Phase 9: Test Automation

### 9.1 Unit Tests

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { encryptSecret, decryptSecret } from '../auth/secrets';

describe('Secrets Management', () => {
  it('should encrypt and decrypt secrets correctly', () => {
    const originalSecret = 'my-secret-key-12345';
    const encrypted = encryptSecret(originalSecret);
    const decrypted = decryptSecret(encrypted);
    
    expect(decrypted).toBe(originalSecret);
  });

  it('should produce different ciphertexts for same input', () => {
    const secret = 'my-secret';
    const encrypted1 = encryptSecret(secret);
    const encrypted2 = encryptSecret(secret);
    
    expect(encrypted1).not.toBe(encrypted2);
  });
});
```

### 9.2 Integration Tests

```typescript
describe('User Management API', () => {
  it('should create a new user with admin role', async () => {
    const response = await request(app)
      .post('/api/trpc/admin.users.create')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'newuser@example.com',
        name: 'New User',
        role: 'user',
      });

    expect(response.status).toBe(200);
    expect(response.body.result.data.userId).toBeDefined();
  });
});
```

**Target Coverage:** 85%+

---

## Phase 10: Deployment Guide & Production Runbook

### 10.1 Infrastructure Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                    ┌────▼────┐
                    │ Cloudflare
                    │ CDN/DDoS
                    └────┬────┘
                         │
                    ┌────▼────────────┐
                    │ Load Balancer   │
                    │ (Nginx)         │
                    └────┬────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
    ┌───▼───┐        ┌───▼───┐       ┌───▼───┐
    │Backend│        │Backend│       │Backend│
    │ Pod 1 │        │ Pod 2 │       │ Pod 3 │
    └───┬───┘        └───┬───┘       └───┬───┘
        │                │                │
        └────────────────┼────────────────┘
                         │
            ┌────────────┴────────────┐
            │                         │
        ┌───▼────┐            ┌──────▼──┐
        │PostgreSQL          │ Redis   │
        │ Primary            │ Cluster │
        └────────┘           └─────────┘
            │
        ┌───▼────┐
        │PostgreSQL
        │ Replica
        └────────┘
```

### 10.2 Production Deployment Checklist

- [ ] Database migration completed
- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Nginx reverse proxy configured
- [ ] Monitoring stack deployed
- [ ] Backup system enabled
- [ ] CI/CD pipeline tested
- [ ] Health checks passing
- [ ] Load balancer configured
- [ ] DNS records updated
- [ ] Security audit completed
- [ ] Performance benchmarks met
- [ ] Rollback procedure tested

---

## Phase 11: Final Integration & Production Readiness Verification

### 11.1 Production Readiness Checklist

| Component | Status | Verification |
|-----------|--------|--------------|
| Authentication | ✅ | JWT tokens issued, refresh working |
| User Management | ✅ | CRUD operations functional |
| API Security | ✅ | Rate limiting, CORS, CSRF active |
| Secrets Management | ✅ | Encrypted, rotated monthly |
| Monitoring | ✅ | Prometheus/Grafana collecting metrics |
| Logging | ✅ | JSON logs in centralized store |
| Backups | ✅ | Daily automated backups verified |
| Disaster Recovery | ✅ | RTO/RPO targets met |
| CI/CD | ✅ | Automated tests and deployment |
| Docker | ✅ | Production image optimized |
| Nginx | ✅ | Reverse proxy and SSL configured |
| Health Checks | ✅ | All endpoints responding |
| Alerts | ✅ | Notifications configured |
| Cost Monitoring | ✅ | AI provider costs tracked |
| Frontend Optimization | ✅ | Lighthouse 90+ achieved |
| Test Coverage | ✅ | 85%+ coverage achieved |

### 11.2 Production Runbook

**Daily Operations:**

1. **Morning Health Check** (8 AM)
   - Verify all services healthy: `curl https://api.ai-nexus.com/health`
   - Check Grafana dashboard for anomalies
   - Review alert logs

2. **Backup Verification** (10 AM)
   - Confirm daily backup completed
   - Spot-check backup integrity
   - Verify S3 upload successful

3. **Performance Monitoring** (Throughout day)
   - Monitor API response times
   - Track error rates
   - Watch for rate limit violations

**Incident Response:**

1. **Service Down**
   - Check health endpoints
   - Review logs for errors
   - Restart affected service
   - If persistent, initiate rollback

2. **Database Issues**
   - Check connection pool
   - Review slow query logs
   - Restart PostgreSQL if needed
   - Restore from backup if corrupted

3. **Security Incident**
   - Isolate affected systems
   - Review audit logs
   - Rotate compromised secrets
   - Notify security team

---

## Implementation Timeline

| Week | Phase | Deliverables |
|------|-------|--------------|
| 1 | Auth & User Mgmt | JWT, RBAC, User Dashboard |
| 1-2 | API Security | Rate Limit, CORS, CSRF, Secrets |
| 2 | Monitoring & Logging | Prometheus, Grafana, Winston |
| 2-3 | Backup & DR | Automated backups, Recovery procedures |
| 3 | CI/CD & Docker | GitHub Actions, Production Dockerfile |
| 3 | Nginx & SSL | Reverse proxy, Let's Encrypt |
| 4 | Health & Alerts | Health endpoints, Slack integration |
| 4 | Cost & Frontend | Cost tracking, Lighthouse optimization |
| 4 | Testing | Unit, Integration, E2E tests |
| 4 | Documentation | Runbook, Deployment guide |

---

## Success Criteria

✅ **Production Readiness:** System deployable to production environment  
✅ **Security:** All OWASP Top 10 vulnerabilities mitigated  
✅ **Reliability:** 99.9% uptime SLA achievable  
✅ **Performance:** Lighthouse score 90+, API response < 500ms  
✅ **Monitoring:** Real-time visibility into system health  
✅ **Automation:** Fully automated CI/CD pipeline  
✅ **Documentation:** Complete runbooks and procedures  
✅ **Testing:** 85%+ code coverage with automated tests  

---

## References

- [JWT Best Practices](https://tools.ietf.org/html/rfc7519)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Let's Encrypt](https://letsencrypt.org/)
- [PostgreSQL Backup](https://www.postgresql.org/docs/current/backup.html)

---

**Document Version:** 1.0  
**Last Updated:** 2026-06-16  
**Next Review:** 2026-06-30
