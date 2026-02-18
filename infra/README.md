# Infrastructure Guide

Complete infrastructure documentation for deploying ML Task Scheduler to production.

## Architecture Overview

```
                                    ┌─────────────────────────────────────────┐
                                    │              Load Balancer              │
                                    │           (nginx-ingress/ALB)           │
                                    └─────────────────┬───────────────────────┘
                                                      │
                    ┌─────────────────────────────────┼─────────────────────────────────┐
                    │                                 │                                 │
           ┌────────▼────────┐               ┌───────▼────────┐              ┌─────────▼────────┐
           │    Frontend     │               │   API Server   │              │    WebSocket     │
           │    (Nginx)      │               │   (Node.js)    │              │   (Socket.IO)    │
           │  Static Files   │               │   REST API     │              │   Real-time      │
           └─────────────────┘               └───────┬────────┘              └────────┬─────────┘
                                                     │                                 │
                              ┌──────────────────────┼─────────────────────────────────┤
                              │                      │                                 │
                    ┌─────────▼─────────┐   ┌───────▼────────┐              ┌─────────▼────────┐
                    │      Redis        │   │   PostgreSQL   │              │   ML Service     │
                    │  Cache/Queues     │   │    Database    │              │   (Python)       │
                    │  Socket.IO Pub    │   │    Prisma      │              │   Predictions    │
                    └─────────┬─────────┘   └────────────────┘              └──────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Queue Workers   │
                    │   BullMQ Jobs     │
                    │   Predictions     │
                    └───────────────────┘
```

## Deployment Options

### 1. Docker Compose (Development/Staging)

```bash
# Development
docker-compose up -d

# Production (with observability)
docker-compose -f docker-compose.production.yml up -d
```

### 2. Kubernetes (Raw Manifests)

```bash
# Apply all resources
kubectl apply -k infra/k8s/

# Or individually
kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f infra/k8s/configmap.yaml
kubectl apply -f infra/k8s/secrets.yaml
kubectl apply -f infra/k8s/postgres.yaml
kubectl apply -f infra/k8s/redis.yaml
kubectl apply -f infra/k8s/api-deployment.yaml
kubectl apply -f infra/k8s/ml-worker-deployment.yaml
kubectl apply -f infra/k8s/queue-worker-deployment.yaml
kubectl apply -f infra/k8s/ingress.yaml
```

### 3. Helm (Recommended for Production)

```bash
# Add dependencies
cd infra/helm/ml-scheduler
helm dependency update

# Install
helm install ml-scheduler ./infra/helm/ml-scheduler \
  --namespace ml-scheduler \
  --create-namespace \
  -f values-production.yaml

# Upgrade
helm upgrade ml-scheduler ./infra/helm/ml-scheduler \
  --namespace ml-scheduler \
  -f values-production.yaml

# Uninstall
helm uninstall ml-scheduler -n ml-scheduler
```

## Directory Structure

```
infra/
├── helm/
│   ├── app/                    # Simplified production Helm chart
│   │   ├── Chart.yaml
│   │   ├── values.yaml
│   │   └── templates/
│   └── ml-scheduler/           # Full-featured Helm chart
│       ├── Chart.yaml
│       ├── values.yaml
│       └── templates/
├── k8s/                        # Raw K8s manifests
│   ├── kustomization.yaml
│   ├── namespace.yaml
│   ├── api-deployment.yaml
│   ├── ml-worker-deployment.yaml
│   ├── queue-worker-deployment.yaml
│   ├── redis.yaml
│   ├── postgres.yaml
│   ├── configmap.yaml
│   ├── secrets.yaml
│   └── ingress.yaml
├── keda/                       # Queue-based autoscaling
│   └── scaled-objects.yaml
├── blue-green/                 # Zero-downtime deployments
│   ├── deployments.yaml
│   ├── deploy.sh
│   └── argo-rollouts.yaml
├── loadtest/                   # k6 load tests (simplified)
│   ├── api.js
│   └── queue-stress.js
├── load-tests/                 # k6 load tests (comprehensive)
│   ├── api-load-test.js
│   ├── websocket-load-test.js
│   └── README.md
├── nginx/
│   └── nginx.conf
└── prometheus/
    ├── prometheus.yml
    └── alerts/
        └── rules.yml
```

## Quick Start - Simplified Helm Chart

```bash
# Deploy simplified app
helm install app ./infra/helm/app \
  --set secrets.DATABASE_URL=postgresql://... \
  --set secrets.JWT_SECRET=... \
  --set secrets.REDIS_URL=redis://...
```

## KEDA Queue-Based Autoscaling

```bash
# Install KEDA
kubectl apply -f https://github.com/kedacore/keda/releases/download/v2.12.0/keda-2.12.0.yaml

# Apply scaled objects
kubectl apply -f infra/keda/scaled-objects.yaml
```

ML workers auto-scale based on Redis queue depth.

## Blue/Green Deployments

```bash
# Deploy green version
./infra/blue-green/deploy.sh deploy green v1.1.0

# Run smoke tests
./infra/blue-green/deploy.sh smoke green

# Switch traffic
./infra/blue-green/deploy.sh switch green

# Rollback if needed
./infra/blue-green/deploy.sh rollback blue
```

## Argo Rollouts (Advanced)

```bash
# Install Argo Rollouts
kubectl create namespace argo-rollouts
kubectl apply -n argo-rollouts -f https://github.com/argoproj/argo-rollouts/releases/latest/download/install.yaml

# Deploy with automated analysis
kubectl apply -f infra/blue-green/argo-rollouts.yaml
```

## Load Testing

```bash
# Simple health check (100 VUs, 60s)
k6 run infra/loadtest/api.js

# Queue stress test
k6 run infra/loadtest/queue-stress.js

# Full load test suite
k6 run infra/load-tests/api-load-test.js
```

## Environment Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Secret for JWT tokens (64+ chars) | Random 64-byte string |
| `REDIS_URL` | Redis connection string | `redis://redis:6379` |
| `NODE_ENV` | Environment mode | `production` |

### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | API server port |
| `LOG_LEVEL` | `info` | Logging level |
| `CORS_ORIGIN` | `*` | Allowed CORS origins |
| `ML_SERVICE_URL` | `http://ml-worker:5000` | ML service endpoint |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Rate limit per window |

## Secrets Management

### Option 1: Kubernetes Secrets (Basic)
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: ml-scheduler-secrets
type: Opaque
data:
  JWT_SECRET: <base64-encoded>
  DATABASE_URL: <base64-encoded>
```

### Option 2: Sealed Secrets (Recommended)
```bash
# Install controller
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.0/controller.yaml

# Seal secrets
kubeseal --format yaml < secret.yaml > sealed-secret.yaml

# Apply sealed secret (safe to commit)
kubectl apply -f sealed-secret.yaml
```

### Option 3: External Secrets Operator
```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: ml-scheduler-external
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: aws-secrets-manager
  target:
    name: ml-scheduler-secrets
  data:
    - secretKey: JWT_SECRET
      remoteRef:
        key: production/ml-scheduler
        property: jwt_secret
```

## Autoscaling

### Horizontal Pod Autoscaler (HPA)

All deployments include HPA configurations:

| Component | Min | Max | Metric | Target |
|-----------|-----|-----|--------|--------|
| API | 2 | 10 | CPU | 70% |
| ML Worker | 2 | 8 | CPU | 70% |
| Queue Worker | 2 | 10 | CPU/Queue Depth | 70% / 100 |

### Vertical Pod Autoscaler (VPA)

Optionally install VPA for automatic resource recommendations:
```bash
kubectl apply -f https://github.com/kubernetes/autoscaler/releases/latest/download/vpa-v1-0-0.yaml
```

## Monitoring & Observability

### Prometheus Metrics

- Endpoint: `/metrics`
- Scrape interval: 15s
- Metrics: HTTP requests, latency, errors, queue depth, ML predictions

### Grafana Dashboards

Import dashboards for:
- API performance
- ML predictions
- Queue metrics
- Resource utilization

### Alerting

Pre-configured alerts in `prometheus/alerts/rules.yml`:
- High error rate (> 5%)
- High latency (p95 > 2s)
- Database connection failures
- ML service unavailable
- Queue depth too high

## Blue/Green Deployment

Using Helm:
```bash
# Deploy green
helm install ml-scheduler-green ./infra/helm/ml-scheduler \
  -f values-green.yaml

# Test green deployment
kubectl port-forward svc/ml-scheduler-green-api 3001:3000

# Switch traffic
kubectl patch ingress ml-scheduler \
  -p '{"spec":{"rules":[{"host":"api.example.com","http":{"paths":[{"backend":{"service":{"name":"ml-scheduler-green-api"}}}]}}]}}'

# Remove blue
helm uninstall ml-scheduler-blue
```

Using Argo Rollouts:
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: ml-scheduler-api
spec:
  strategy:
    blueGreen:
      activeService: ml-scheduler-api
      previewService: ml-scheduler-api-preview
      autoPromotionEnabled: false
```

## Troubleshooting

### Common Issues

**Pods not starting:**
```bash
kubectl describe pod <pod-name> -n ml-scheduler
kubectl logs <pod-name> -n ml-scheduler --previous
```

**Database connection errors:**
```bash
kubectl exec -it <api-pod> -n ml-scheduler -- npx prisma db push
```

**Redis connection issues:**
```bash
kubectl exec -it <redis-pod> -n ml-scheduler -- redis-cli ping
```

**HPA not scaling:**
```bash
kubectl describe hpa <hpa-name> -n ml-scheduler
kubectl top pods -n ml-scheduler
```

### Health Checks

| Endpoint | Expected |
|----------|----------|
| `/health` | `200 OK` |
| `/health/ready` | `200 OK` |
| `/metrics` | Prometheus metrics |

### Useful Commands

```bash
# View all resources
kubectl get all -n ml-scheduler

# Watch pods
kubectl get pods -n ml-scheduler -w

# Check HPA status
kubectl get hpa -n ml-scheduler

# View logs
kubectl logs -l app.kubernetes.io/component=api -n ml-scheduler -f

# Port forward for debugging
kubectl port-forward svc/ml-scheduler-api 3000:3000 -n ml-scheduler

# Run migrations
kubectl exec -it deploy/api -n ml-scheduler -- npx prisma migrate deploy
```

## Security Checklist

- [ ] All secrets use Sealed Secrets or External Secrets
- [ ] Network policies restrict pod-to-pod communication
- [ ] Pod security policies/standards enforced
- [ ] TLS enabled on ingress
- [ ] Rate limiting configured
- [ ] RBAC configured for service accounts
- [ ] Container images scanned for vulnerabilities
- [ ] Non-root containers
- [ ] Resource limits set on all containers

## Performance Tuning

### Database
- Connection pooling: Prisma default pool size is 10
- Add read replicas for scaling reads
- Use PgBouncer for connection pooling at scale

### Redis
- Enable AOF persistence
- Configure maxmemory policy
- Use Redis Sentinel/Cluster for HA

### API
- Increase Node.js heap: `NODE_OPTIONS=--max-old-space-size=4096`
- Enable HTTP keep-alive
- Use compression middleware

### ML Service
- Pre-load models at startup
- Use model caching
- Consider GPU pods for inference
