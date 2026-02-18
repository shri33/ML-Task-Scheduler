# Production Deployment Guide

This guide covers deploying the ML Task Scheduler to a production environment.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Infrastructure Requirements](#infrastructure-requirements)
3. [Environment Setup](#environment-setup)
4. [Deployment Steps](#deployment-steps)
5. [Database Migration](#database-migration)
6. [Scaling](#scaling)
7. [Monitoring](#monitoring)
8. [Backup & Recovery](#backup--recovery)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Software Requirements

| Software | Version | Purpose |
|----------|---------|---------|
| Docker | 24.0+ | Container runtime |
| Docker Compose | 2.20+ | Container orchestration |
| PostgreSQL | 15+ | Primary database |
| Redis | 7+ | Cache, queue, socket adapter |
| Node.js | 20 LTS | Runtime (for local testing) |
| Python | 3.10+ | ML service |

### Hardware Requirements (Minimum)

| Component | Specs |
|-----------|-------|
| CPU | 4 cores |
| RAM | 8 GB |
| Storage | 50 GB SSD |
| Network | 100 Mbps |

### Recommended Production Specs

| Component | Specs |
|-----------|-------|
| CPU | 8+ cores |
| RAM | 16+ GB |
| Storage | 200 GB SSD |
| Network | 1 Gbps |

---

## Infrastructure Requirements

### Network Ports

| Port | Service | Access |
|------|---------|--------|
| 80 | HTTP | Public |
| 443 | HTTPS | Public |
| 3001 | API (internal) | Internal only |
| 5432 | PostgreSQL | Internal only |
| 6379 | Redis | Internal only |
| 9090 | Prometheus | Internal only |
| 3002 | Grafana | Internal/VPN |

### DNS & SSL

1. Point your domain to the server IP
2. Obtain SSL certificate (Let's Encrypt recommended)
3. Place certificates in `infra/certs/`

```bash
# Using certbot
certbot certonly --standalone -d yourdomain.com
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem infra/certs/
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem infra/certs/
```

---

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/ml-task-scheduler.git
cd ml-task-scheduler
```

### 2. Create Production Environment File

```bash
cp backend/.env.example .env.production
```

### 3. Configure Environment Variables

Edit `.env.production`:

```env
# Server
NODE_ENV=production
PORT=3001

# Database (use strong password)
DB_USER=scheduler_prod
DB_PASSWORD=<STRONG_PASSWORD_HERE>
DB_NAME=task_scheduler_prod
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}

# Redis
REDIS_URL=redis://redis:6379

# Security (generate with: openssl rand -base64 32)
JWT_SECRET=<GENERATED_SECRET_HERE>
CORS_ORIGIN=https://yourdomain.com

# ML Service
ML_SERVICE_URL=http://ml-worker:5001
ML_WORKER_CONCURRENCY=4

# Queue Workers
QUEUE_WORKER_CONCURRENCY=5

# Swagger Protection
SWAGGER_USER=admin
SWAGGER_PASS=<ADMIN_PASSWORD>

# Monitoring
GRAFANA_USER=admin
GRAFANA_PASSWORD=<GRAFANA_PASSWORD>
GRAFANA_ROOT_URL=https://yourdomain.com/grafana

# Email Notifications (optional)
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=notifications@yourdomain.com
SMTP_PASS=<EMAIL_PASSWORD>
EMAIL_FROM=noreply@yourdomain.com

# Logging
LOG_LEVEL=INFO
```

### 4. Secure the Environment File

```bash
chmod 600 .env.production
```

---

## Deployment Steps

### Step 1: Build Images

```bash
docker-compose -f docker-compose.production.yml --env-file .env.production build
```

### Step 2: Start Infrastructure Services

```bash
# Start database and Redis first
docker-compose -f docker-compose.production.yml --env-file .env.production up -d db redis
```

### Step 3: Wait for Services

```bash
# Wait for PostgreSQL to be ready
docker-compose -f docker-compose.production.yml exec db pg_isready -U scheduler_prod

# Wait for Redis
docker-compose -f docker-compose.production.yml exec redis redis-cli ping
```

### Step 4: Run Database Migrations

```bash
docker-compose -f docker-compose.production.yml --env-file .env.production \
  run --rm api npx prisma migrate deploy
```

### Step 5: Start All Services

```bash
docker-compose -f docker-compose.production.yml --env-file .env.production up -d
```

### Step 6: Verify Deployment

```bash
# Check all services are running
docker-compose -f docker-compose.production.yml ps

# Check API health
curl http://localhost/api/health

# Check logs
docker-compose -f docker-compose.production.yml logs -f api
```

---

## Database Migration

### Initial Setup

```bash
# Generate Prisma client
docker-compose -f docker-compose.production.yml run --rm api npx prisma generate

# Push schema (development only)
docker-compose -f docker-compose.production.yml run --rm api npx prisma db push

# Apply migrations (production)
docker-compose -f docker-compose.production.yml run --rm api npx prisma migrate deploy
```

### Creating New Migrations

```bash
# On development machine
cd backend
npx prisma migrate dev --name your_migration_name

# Deploy to production
docker-compose -f docker-compose.production.yml run --rm api npx prisma migrate deploy
```

---

## Scaling

### Scale API Servers

```bash
# Scale to 3 API replicas
docker-compose -f docker-compose.production.yml up -d --scale api=3
```

### Scale ML Workers

```bash
# Scale to 4 ML workers
docker-compose -f docker-compose.production.yml up -d --scale ml-worker=4
```

### Scale Queue Workers

```bash
# Scale to 3 queue workers
docker-compose -f docker-compose.production.yml up -d --scale queue-worker=3
```

### View Current Scale

```bash
docker-compose -f docker-compose.production.yml ps
```

---

## Monitoring

### Access Grafana

1. Navigate to `https://yourdomain.com/grafana`
2. Login with configured credentials
3. Import dashboards from `infra/grafana/dashboards/`

### Prometheus Endpoints

- Prometheus UI: `http://prometheus:9090` (internal)
- Metrics endpoint: `https://yourdomain.com/metrics`

### Key Metrics to Monitor

| Metric | Alert Threshold |
|--------|-----------------|
| `http_requests_total{status_code=~"5.."}` | > 5% error rate |
| `http_request_duration_seconds` | p95 > 2s |
| `queue_depth{queue="ml-prediction"}` | > 1000 |
| `circuit_breaker_state{service="ml-service"}` | = 1 (open) |
| `process_resident_memory_bytes` | > 450MB |

### View Logs

```bash
# All services
docker-compose -f docker-compose.production.yml logs -f

# Specific service
docker-compose -f docker-compose.production.yml logs -f api

# With timestamps
docker-compose -f docker-compose.production.yml logs -f --timestamps api
```

---

## Backup & Recovery

### Database Backup

```bash
# Manual backup
docker-compose -f docker-compose.production.yml exec db \
  pg_dump -U scheduler_prod task_scheduler_prod > backup_$(date +%Y%m%d_%H%M%S).sql

# Automated daily backup via cron
0 2 * * * /path/to/backup-script.sh
```

### Database Restore

```bash
# Stop API servers first
docker-compose -f docker-compose.production.yml stop api queue-worker

# Restore from backup
docker-compose -f docker-compose.production.yml exec -T db \
  psql -U scheduler_prod task_scheduler_prod < backup_file.sql

# Restart services
docker-compose -f docker-compose.production.yml up -d api queue-worker
```

### Redis Backup

Redis persistence is enabled via AOF. Backup `/var/lib/redis/`:

```bash
docker-compose -f docker-compose.production.yml exec redis redis-cli BGSAVE
docker cp $(docker-compose ps -q redis):/data/dump.rdb ./redis_backup.rdb
```

---

## Troubleshooting

### Common Issues

#### API Not Starting

```bash
# Check logs
docker-compose -f docker-compose.production.yml logs api

# Check environment variables
docker-compose -f docker-compose.production.yml run --rm api env

# Verify database connection
docker-compose -f docker-compose.production.yml run --rm api npx prisma db pull
```

#### Database Connection Refused

```bash
# Check PostgreSQL status
docker-compose -f docker-compose.production.yml exec db pg_isready

# Check connection from API container
docker-compose -f docker-compose.production.yml run --rm api \
  sh -c "apt-get install -y postgresql-client && psql \$DATABASE_URL -c 'SELECT 1'"
```

#### High Memory Usage

```bash
# Check container stats
docker stats

# Restart specific service
docker-compose -f docker-compose.production.yml restart api
```

#### Queue Jobs Not Processing

```bash
# Check queue worker logs
docker-compose -f docker-compose.production.yml logs queue-worker

# Check Redis connection
docker-compose -f docker-compose.production.yml exec redis redis-cli info
```

### Health Checks

```bash
# API health
curl -s http://localhost/api/health | jq

# Queue health
curl -s http://localhost/api/v1/metrics/queue | jq

# Redis health
docker-compose -f docker-compose.production.yml exec redis redis-cli ping
```

### Emergency Procedures

#### Rollback Deployment

```bash
# Stop current deployment
docker-compose -f docker-compose.production.yml down

# Checkout previous version
git checkout <previous-tag>

# Rebuild and deploy
docker-compose -f docker-compose.production.yml build
docker-compose -f docker-compose.production.yml up -d
```

#### Clear Queue Backlog

```bash
# Connect to Redis
docker-compose -f docker-compose.production.yml exec redis redis-cli

# Clear prediction queue (CAUTION: data loss)
> DEL bull:ml-prediction:waiting
> DEL bull:ml-prediction:active
```

---

## Security Checklist

- [ ] Environment file has restricted permissions (600)
- [ ] All default passwords changed
- [ ] SSL/TLS enabled
- [ ] Database not exposed to public network
- [ ] Redis not exposed to public network
- [ ] Swagger protected with authentication
- [ ] Rate limiting configured
- [ ] Security headers enabled in Nginx
- [ ] Regular backups configured
- [ ] Monitoring and alerting active

---

## Support

For issues:

1. Check this guide's troubleshooting section
2. Review application logs
3. Check Grafana dashboards for anomalies
4. Create issue in repository with:
   - Error messages
   - Relevant logs
   - Steps to reproduce
