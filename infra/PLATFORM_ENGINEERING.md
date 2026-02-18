# Platform Engineering Infrastructure

This directory contains the complete platform engineering layer for the ML Task Scheduler, implementing modern cloud-native practices.

## Architecture Overview

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │                         GitOps                               │
                    │   GitHub Repo ──► ArgoCD ──► Kubernetes Cluster              │
                    └─────────────────────────────────────────────────────────────┘
                                                │
                    ┌───────────────────────────┼───────────────────────────┐
                    │                           │                           │
           ┌────────▼────────┐         ┌───────▼────────┐         ┌────────▼────────┐
           │    Terraform    │         │  Istio Mesh    │         │    Monitoring    │
           │   (AWS Infra)   │         │  (mTLS/Traffic)│         │ (Prometheus/Jaeger)│
           └─────────────────┘         └────────────────┘         └──────────────────┘
                    │                           │                           │
           ┌────────▼────────┐         ┌───────▼────────┐         ┌────────▼────────┐
           │      EKS        │         │ Rate Limiting  │         │  SLO Dashboards │
           │   RDS / Redis   │         │ Circuit Breaker│         │     Alerts      │
           └─────────────────┘         └────────────────┘         └──────────────────┘
```

## Directory Structure

```
infra/
├── argocd/                    # GitOps - ArgoCD configurations
│   ├── install.sh             # ArgoCD installation script
│   ├── argocd-app-dev.yaml    # Dev environment app
│   ├── argocd-app-staging.yaml # Staging environment app
│   └── argocd-app-prod.yaml   # Production environment app
│
├── envs/                      # Environment-specific Helm values
│   ├── dev/values.yaml        # Development values
│   ├── staging/values.yaml    # Staging values
│   └── prod/values.yaml       # Production values
│
├── terraform/                 # Infrastructure as Code
│   ├── main.tf               # Provider and backend config
│   ├── variables.tf          # Variable definitions
│   ├── vpc.tf                # VPC and networking
│   ├── eks.tf                # EKS cluster config
│   ├── rds.tf                # PostgreSQL RDS
│   ├── redis.tf              # ElastiCache Redis
│   └── outputs.tf            # Output values
│
├── chaos-mesh/               # Chaos Engineering
│   ├── install.sh            # Chaos Mesh installation
│   └── experiments/
│       ├── pod-chaos.yaml    # Pod failure tests
│       ├── network-chaos.yaml # Network failure tests
│       ├── stress-chaos.yaml  # Resource stress tests
│       └── workflows.yaml     # Scheduled chaos workflows
│
├── istio/                    # Service Mesh
│   ├── install.sh            # Istio installation
│   ├── gateway.yaml          # Istio Gateway
│   ├── canary-releases.yaml  # Traffic splitting
│   ├── canary-rollouts.yaml  # Argo Rollouts canary
│   ├── security.yaml         # mTLS and auth policies
│   ├── resiliency.yaml       # Circuit breaking/retries
│   └── rate-limiting.yaml    # Rate limiting configs
│
├── tracing/                  # Distributed Tracing
│   ├── install.sh            # Jaeger/OTel installation
│   ├── jaeger-instance.yaml  # Jaeger deployment
│   └── otel-collector.yaml   # OpenTelemetry Collector
│
├── grafana/                  # Dashboards
│   ├── dashboards/
│   │   └── slo-dashboard.json # SLO/SLI dashboard
│   └── provisioning/
│       ├── datasources/
│       └── dashboards/
│
├── prometheus/               # Metrics & Alerting
│   ├── prometheus.yml        # Prometheus config
│   └── alerts/
│       └── slo-alerts.yml    # SLO-based alerts
│
├── helm/                     # Helm charts
├── k8s/                      # Raw Kubernetes manifests
├── blue-green/               # Blue-green deployments
├── keda/                     # Event-driven autoscaling
└── load-tests/               # Load testing scripts
```

## Quick Start

### 1. Provision Infrastructure (Terraform)

```bash
cd infra/terraform

# Initialize Terraform
terraform init

# Plan changes
terraform plan -var="environment=prod"

# Apply infrastructure
terraform apply -var="environment=prod"

# Get kubeconfig
aws eks update-kubeconfig --region us-east-1 --name ml-scheduler-prod
```

### 2. Install Service Mesh (Istio)

```bash
cd infra/istio
chmod +x install.sh
./install.sh

# Apply configurations
kubectl apply -f gateway.yaml
kubectl apply -f security.yaml
kubectl apply -f resiliency.yaml
kubectl apply -f rate-limiting.yaml
```

### 3. Setup GitOps (ArgoCD)

```bash
cd infra/argocd
chmod +x install.sh
./install.sh

# Deploy applications
kubectl apply -f argocd-app-dev.yaml
kubectl apply -f argocd-app-staging.yaml
kubectl apply -f argocd-app-prod.yaml

# Access ArgoCD UI
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

### 4. Install Tracing (Jaeger + OpenTelemetry)

```bash
cd infra/tracing
chmod +x install.sh
./install.sh

# Deploy Jaeger instance
kubectl apply -f jaeger-instance.yaml

# Deploy OpenTelemetry Collector
kubectl apply -f otel-collector.yaml
```

### 5. Setup Chaos Engineering

```bash
cd infra/chaos-mesh
chmod +x install.sh
./install.sh

# Run experiments (staging only!)
kubectl apply -f experiments/pod-chaos.yaml
kubectl apply -f experiments/network-chaos.yaml
kubectl apply -f experiments/workflows.yaml
```

## SLO Definitions

| SLI | SLO Target | Alert Threshold |
|-----|------------|-----------------|
| API Availability | 99.9% | < 99.9% for 5m |
| API Latency (P95) | < 200ms | > 200ms for 5m |
| Queue Backlog | < 100 jobs | > 100 for 10m |
| Error Rate | < 1% | > 1% for 5m |
| ML Prediction Time (P95) | < 5s | > 5s for 10m |

## Canary Release Process

1. **Initial Deployment (5% traffic)**
   - 2 minutes observation
   - Automated success rate check

2. **Phase 2 (10% traffic)**
   - 5 minutes observation
   - Success rate + latency check

3. **Phase 3 (25% traffic)**
   - 10 minutes observation
   - Full analysis

4. **Phase 4 (50% traffic)**
   - 10 minutes observation
   - Full analysis with error rate

5. **Final Rollout (100% traffic)**
   - Automatic on success
   - Rollback on failure

## Rate Limiting

| Endpoint | Limit | Burst |
|----------|-------|-------|
| Global | 100/s | - |
| Per IP | 200/min | - |
| Auth Login | 10/min | - |
| Auth Register | 5/hour | - |
| ML Predict | 30/min | - |
| Batch Operations | 10/hour | - |

## Monitoring Access

| Service | Port Forward Command | URL |
|---------|---------------------|-----|
| ArgoCD | `kubectl port-forward svc/argocd-server -n argocd 8080:443` | https://localhost:8080 |
| Grafana | `kubectl port-forward svc/grafana -n monitoring 3000:80` | http://localhost:3000 |
| Jaeger | `kubectl port-forward svc/jaeger-query -n observability 16686:16686` | http://localhost:16686 |
| Prometheus | `kubectl port-forward svc/prometheus -n monitoring 9090:9090` | http://localhost:9090 |
| Chaos Dashboard | `kubectl port-forward svc/chaos-dashboard -n chaos-testing 2333:2333` | http://localhost:2333 |
| Kiali | `kubectl port-forward svc/kiali -n istio-system 20001:20001` | http://localhost:20001 |

## Next Steps

The platform is ready for:

- **Multi-region failover** - Active-active deployment across regions
- **Disaster recovery** - Backup/restore procedures with Velero
- **Data sharding** - Horizontal database scaling
- **Global load balancing** - CloudFront/Route53 setup
- **Zero trust security** - Fine-grained service-to-service auth
- **Compliance architecture** - SOC2/HIPAA controls
- **Cost optimization** - Spot instances, reserved capacity
