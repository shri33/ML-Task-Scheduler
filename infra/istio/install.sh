#!/bin/bash
# =============================================================================
# Istio Installation Script
# =============================================================================

set -e

ISTIO_VERSION="1.20.0"

echo "Installing Istio ${ISTIO_VERSION}..."

# Download Istio
curl -L https://istio.io/downloadIstio | ISTIO_VERSION=${ISTIO_VERSION} sh -

# Add istioctl to PATH
export PATH="$PWD/istio-${ISTIO_VERSION}/bin:$PATH"

# Install Istio with production profile
istioctl install --set profile=default \
  --set meshConfig.accessLogFile=/dev/stdout \
  --set meshConfig.enableTracing=true \
  --set meshConfig.defaultConfig.tracing.sampling=100 \
  --set values.global.tracer.zipkin.address=jaeger-collector.observability:9411 \
  -y

# Wait for Istio to be ready
echo "Waiting for Istio pods to be ready..."
kubectl wait --for=condition=Ready pods --all -n istio-system --timeout=300s

# Enable sidecar injection for ml-scheduler namespace
kubectl label namespace ml-scheduler istio-injection=enabled --overwrite

echo ""
echo "Istio installed successfully!"
echo ""
echo "To access Kiali dashboard, run:"
echo "  kubectl port-forward svc/kiali -n istio-system 20001:20001"
echo ""
echo "Then open: http://localhost:20001"
