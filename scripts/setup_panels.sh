#!/usr/bin/env bash
set -euo pipefail
kubectl apply -f https://raw.githubusercontent.com/kubernetes/dashboard/v2.7.0/aio/deploy/recommended.yaml
kubectl -n kubernetes-dashboard create serviceaccount admin-user >/dev/null 2>&1 || true
kubectl create clusterrolebinding admin-user-binding --clusterrole=cluster-admin --serviceaccount=kubernetes-dashboard:admin-user >/dev/null 2>&1 || true
TOKEN=$(kubectl -n kubernetes-dashboard create token admin-user)
echo "$TOKEN"
kubectl get ns image-trace >/dev/null 2>&1 || kubectl create ns image-trace
cat <<'EOF' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redisinsight
  namespace: image-trace
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redisinsight
  template:
    metadata:
      labels:
        app: redisinsight
    spec:
      containers:
        - name: redisinsight
          image: redis/redisinsight:latest
          ports:
            - containerPort: 5540
          env:
            - name: RI_HOST
              value: "0.0.0.0"
---
apiVersion: v1
kind: Service
metadata:
  name: redisinsight
  namespace: image-trace
spec:
  type: NodePort
  selector:
    app: redisinsight
  ports:
    - name: web
      port: 5540
      targetPort: 5540
      nodePort: 30540
EOF
kubectl -n image-trace rollout status deployment redisinsight --timeout=180s || true
echo "Kubernetes Dashboard: http://127.0.0.1:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/"
echo "RedisInsight: http://127.0.0.1:30540/"
echo "Use TOKEN above to login Dashboard"

