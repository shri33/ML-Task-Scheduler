#!/bin/bash
# =============================================================================
# Blue/Green Deployment Script
#
# Usage:
#   ./deploy.sh green v1.1.0    # Deploy new version to green
#   ./deploy.sh switch green    # Switch traffic to green
#   ./deploy.sh rollback blue   # Rollback to blue
#   ./deploy.sh cleanup blue    # Remove old deployment
# =============================================================================

set -e

NAMESPACE=${NAMESPACE:-default}
SERVICE_NAME="api"

deploy() {
    local COLOR=$1
    local VERSION=$2
    
    echo "Deploying $COLOR with version $VERSION..."
    
    kubectl set image deployment/api-$COLOR api=registry/api:$VERSION -n $NAMESPACE
    kubectl rollout status deployment/api-$COLOR -n $NAMESPACE
    
    echo "Deployment $COLOR updated to $VERSION"
}

switch_traffic() {
    local COLOR=$1
    
    echo "Switching traffic to $COLOR..."
    
    kubectl patch service $SERVICE_NAME -n $NAMESPACE \
        -p "{\"spec\":{\"selector\":{\"app\":\"api\",\"version\":\"$COLOR\"}}}"
    
    echo "Traffic now flowing to $COLOR"
}

smoke_test() {
    local COLOR=$1
    
    echo "Running smoke tests against $COLOR..."
    
    # Get pod IP for direct testing
    POD=$(kubectl get pods -n $NAMESPACE -l app=api,version=$COLOR -o jsonpath='{.items[0].metadata.name}')
    
    kubectl exec -n $NAMESPACE $POD -- curl -sf http://localhost:3000/health || {
        echo "Smoke test failed!"
        exit 1
    }
    
    echo "Smoke tests passed"
}

rollback() {
    local COLOR=$1
    
    echo "Rolling back to $COLOR..."
    switch_traffic $COLOR
    echo "Rollback complete"
}

cleanup() {
    local COLOR=$1
    
    echo "Cleaning up $COLOR deployment..."
    kubectl scale deployment/api-$COLOR --replicas=0 -n $NAMESPACE
    echo "Cleanup complete"
}

full_deploy() {
    local NEW_COLOR=$1
    local VERSION=$2
    
    deploy $NEW_COLOR $VERSION
    smoke_test $NEW_COLOR
    switch_traffic $NEW_COLOR
    
    echo "Full deployment complete. Traffic now on $NEW_COLOR"
}

case "$1" in
    deploy)
        deploy $2 $3
        ;;
    switch)
        switch_traffic $2
        ;;
    smoke)
        smoke_test $2
        ;;
    rollback)
        rollback $2
        ;;
    cleanup)
        cleanup $2
        ;;
    full)
        full_deploy $2 $3
        ;;
    *)
        echo "Usage: $0 {deploy|switch|smoke|rollback|cleanup|full} <color> [version]"
        exit 1
        ;;
esac
