# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0

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

.PHONY: check smoke licenses
check:
	npm run check:base
	npm run licenses:check
smoke:
	npm run smoke
licenses:
	npm run licenses
