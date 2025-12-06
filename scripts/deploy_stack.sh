#!/usr/bin/env bash
set -euo pipefail
NS=${NAMESPACE:-image-trace}
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/minio.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/backend.yaml
DB_USER=${DB_USER:-image_trace}
DB_PASS=${DB_PASS:-image_trace_pw}
DB_NAME=${DB_NAME:-image_trace}
DB_HOST=${DB_HOST:-image-trace-postgres}
DATABASE_URL=${DATABASE_URL:-postgresql+psycopg2://$DB_USER:$DB_PASS@$DB_HOST:5432/$DB_NAME}
MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY:-minioadmin}
MINIO_SECRET_KEY=${MINIO_SECRET_KEY:-minioadmin123}
kubectl -n "$NS" get secret image-trace-secrets >/dev/null 2>&1 || kubectl -n "$NS" create secret generic image-trace-secrets --from-literal=DATABASE_URL="$DATABASE_URL" --from-literal=MINIO_ACCESS_KEY="$MINIO_ACCESS_KEY" --from-literal=MINIO_SECRET_KEY="$MINIO_SECRET_KEY"
docker build -t image-trace-backend:dev backend
kubectl -n "$NS" rollout status deployment image-trace-redis --timeout=180s || true
kubectl -n "$NS" rollout status statefulset image-trace-postgres --timeout=180s || true
kubectl -n "$NS" rollout status statefulset image-trace-minio --timeout=180s || true
kubectl -n "$NS" rollout status deployment image-trace-backend --timeout=180s || true
NODE_IP=${NODE_IP:-127.0.0.1}
BACKEND_PORT=${BACKEND_PORT:-30080}
MINIO_CONSOLE=${MINIO_CONSOLE:-30901}
curl -sS -w "\nHTTP %{http_code}\n" "http://$NODE_IP:$BACKEND_PORT/health" || true
curl -sS -w "\nHTTP %{http_code}\n" "http://$NODE_IP:$BACKEND_PORT/analysis/cache/health" || true
echo "BACKEND=http://$NODE_IP:$BACKEND_PORT/"
echo "MINIO_CONSOLE=http://$NODE_IP:$MINIO_CONSOLE/"

