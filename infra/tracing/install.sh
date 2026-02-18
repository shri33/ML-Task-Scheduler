#!/bin/bash
# =============================================================================
# Jaeger and OpenTelemetry Installation Script
# =============================================================================

set -e

echo "Installing Jaeger Operator..."

# Create observability namespace
kubectl create namespace observability --dry-run=client -o yaml | kubectl apply -f -

# Install cert-manager (required for Jaeger Operator)
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
kubectl wait --for=condition=Available deployment --all -n cert-manager --timeout=300s

# Install Jaeger Operator
kubectl create namespace observability --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f https://github.com/jaegertracing/jaeger-operator/releases/download/v1.51.0/jaeger-operator.yaml -n observability

# Wait for operator to be ready
echo "Waiting for Jaeger Operator to be ready..."
kubectl wait --for=condition=Available deployment/jaeger-operator -n observability --timeout=300s

echo "Installing OpenTelemetry Collector..."

# Add OpenTelemetry Helm repo
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
helm repo update

# Install OpenTelemetry Collector
helm upgrade --install otel-collector open-telemetry/opentelemetry-collector \
  --namespace observability \
  --values - <<EOF
mode: deployment
config:
  receivers:
    otlp:
      protocols:
        grpc:
          endpoint: 0.0.0.0:4317
        http:
          endpoint: 0.0.0.0:4318
    jaeger:
      protocols:
        grpc:
          endpoint: 0.0.0.0:14250
        thrift_http:
          endpoint: 0.0.0.0:14268
    zipkin:
      endpoint: 0.0.0.0:9411
    prometheus:
      config:
        scrape_configs:
          - job_name: 'otel-collector'
            scrape_interval: 10s
            static_configs:
              - targets: ['0.0.0.0:8888']
  processors:
    batch:
      timeout: 10s
      send_batch_size: 1000
    memory_limiter:
      check_interval: 1s
      limit_percentage: 75
      spike_limit_percentage: 25
  exporters:
    jaeger:
      endpoint: jaeger-collector.observability:14250
      tls:
        insecure: true
    prometheus:
      endpoint: "0.0.0.0:8889"
  service:
    pipelines:
      traces:
        receivers: [otlp, jaeger, zipkin]
        processors: [memory_limiter, batch]
        exporters: [jaeger]
      metrics:
        receivers: [otlp, prometheus]
        processors: [memory_limiter, batch]
        exporters: [prometheus]
EOF

echo ""
echo "Jaeger and OpenTelemetry installed successfully!"
echo ""
echo "Apply the Jaeger instance with:"
echo "  kubectl apply -f infra/tracing/jaeger-instance.yaml"
