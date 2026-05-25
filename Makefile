.PHONY: dev build start test test-watch typecheck lint check

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

check: lint typecheck test build
