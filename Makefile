.PHONY: dev build start test test-watch typecheck lint check deploy

dev:
	npm run dev

build:
	npm run build

start:
	npm run start

test:
	npm test

test-watch:
	npm run test:watch

typecheck:
	npm run typecheck

lint:
	npm run lint

check: typecheck test build

GCP_PROJECT  := tpu-service-473302
REGION       := us-central1
SERVICE      := sgl-jax-dashboard
SERVICE_SA   := sgl-jax-dashboard-runtime@$(GCP_PROJECT).iam.gserviceaccount.com
GCS_BUCKET   := observability-storage-sglang

deploy:
	gcloud run deploy $(SERVICE) \
	  --source=. \
	  --region=$(REGION) \
	  --project=$(GCP_PROJECT) \
	  --service-account=$(SERVICE_SA) \
	  --allow-unauthenticated \
	  --set-env-vars=GCS_BUCKET=$(GCS_BUCKET) \
	  --cpu=1 --memory=512Mi --max-instances=3 --min-instances=0
	@echo ""
	@echo "Preview: $$(gcloud run services describe $(SERVICE) \
	  --region=$(REGION) --project=$(GCP_PROJECT) \
	  --format='value(status.url)')"
