#!/usr/bin/env bash
set -euo pipefail
NAMESPACE=${NAMESPACE:-image-trace}
DEPLOYMENT=${DEPLOYMENT:-image-trace-backend}
CONTAINER=${CONTAINER:-backend}
IMAGE_NAME=${IMAGE_NAME:-image-trace-backend}
IMAGE_DIR=${IMAGE_DIR:-backend}
REGISTRY=${REGISTRY:-}
TAG=${TAG:-dev-$(date +%Y%m%d%H%M%S)}
if [ -n "$REGISTRY" ]; then
  FULL_IMAGE="$REGISTRY/$IMAGE_NAME:$TAG"
else
  FULL_IMAGE="$IMAGE_NAME:$TAG"
fi
docker build -t "$FULL_IMAGE" "$IMAGE_DIR"
if [ -n "$REGISTRY" ]; then
  docker push "$FULL_IMAGE"
fi
kubectl -n "$NAMESPACE" set image "deployment/$DEPLOYMENT" "$CONTAINER=$FULL_IMAGE"
kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout=180s
SERVICE=${SERVICE:-image-trace-backend}
NODE_IP=${NODE_IP:-127.0.0.1}
NODE_PORT=${NODE_PORT:-$(kubectl -n "$NAMESPACE" get svc "$SERVICE" -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo 30080)}
curl -sS -w "\nHTTP %{http_code}\n" "http://$NODE_IP:$NODE_PORT/health" || true
curl -sS -w "\nHTTP %{http_code}\n" "http://$NODE_IP:$NODE_PORT/analysis/cache/health" || true

