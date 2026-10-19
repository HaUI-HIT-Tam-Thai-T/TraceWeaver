.PHONY: install dev start test migrate db-up db-stop

install:
	npm ci
dev:
	npm run dev:be
start:
	npm run start:be
test:
	npm test
migrate:
	npm run db:migrate
db-up:
	npm run db:up
db-stop:
	npm run db:stop
