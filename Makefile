SHELL := /bin/bash

.PHONY: deploy update panels proxy health redis-health e2e

NODE_IP ?= 127.0.0.1
PORT ?= 30080

deploy:
	bash scripts/deploy_stack.sh

update:
	bash scripts/update_backend.sh

panels:
	bash scripts/setup_panels.sh

proxy:
	kubectl proxy --port=8001 --address=127.0.0.1 --accept-hosts='.*'

health:
	curl -sS -w "\nHTTP %{http_code}\n" http://$(NODE_IP):$(PORT)/health

redis-health:
	curl -sS -w "\nHTTP %{http_code}\n" http://$(NODE_IP):$(PORT)/analysis/cache/health

e2e:
	PROJECT_JSON=$$(curl -sS -X POST http://$(NODE_IP):$(PORT)/projects -H "Content-Type: application/json" -d '{"name":"自动化E2E项目","description":"Makefile触发"}'); \
	PROJECT_ID=$$(echo $$PROJECT_JSON | jq -r .id); \
	IMG_PATH=$$(ls data/uploads/*/test_image.jpg | head -n1); \
	curl -sS -X POST "http://$(NODE_IP):$(PORT)/upload/batch?project_id=$$PROJECT_ID" -H "Content-Type: multipart/form-data" -F files=@"$$IMG_PATH"; \
	ANALYSIS_JSON=$$(curl -sS -X POST "http://$(NODE_IP):$(PORT)/analysis/start?project_id=$$PROJECT_ID"); \
	ANALYSIS_ID=$$(echo $$ANALYSIS_JSON | jq -r .analysis_id); \
	for i in $$(seq 1 20); do \
	  STATUS_JSON=$$(curl -sS "http://$(NODE_IP):$(PORT)/analysis/status/$$ANALYSIS_ID"); \
	  STATUS=$$(echo $$STATUS_JSON | jq -r .status); \
	  echo $$STATUS_JSON; \
	  if [ "$$STATUS" = "completed" ] || [ "$$STATUS" = "failed" ]; then break; fi; \
	  sleep 2; \
	done; \
	curl -sS "http://$(NODE_IP):$(PORT)/analysis/results/$$ANALYSIS_ID" | jq -r '{status, results: (.results | keys)}'
