#!/bin/bash
# =============================================================================
# Chaos Mesh Installation Script
# =============================================================================

set -e

echo "Installing Chaos Mesh..."

# Add Helm repo
helm repo add chaos-mesh https://charts.chaos-mesh.org
helm repo update

# Create namespace
kubectl create namespace chaos-testing --dry-run=client -o yaml | kubectl apply -f -

# Install Chaos Mesh
helm upgrade --install chaos-mesh chaos-mesh/chaos-mesh \
  --namespace chaos-testing \
  --set chaosDaemon.runtime=containerd \
  --set chaosDaemon.socketPath=/run/containerd/containerd.sock \
  --set dashboard.securityMode=false \
  --wait

# Wait for pods to be ready
echo "Waiting for Chaos Mesh pods to be ready..."
kubectl wait --for=condition=Ready pods --all -n chaos-testing --timeout=300s

echo ""
echo "Chaos Mesh installed successfully!"
echo ""
echo "To access Chaos Dashboard, run:"
echo "  kubectl port-forward svc/chaos-dashboard -n chaos-testing 2333:2333"
echo ""
echo "Then open: http://localhost:2333"
