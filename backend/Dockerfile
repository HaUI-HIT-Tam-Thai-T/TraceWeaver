# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0

FROM node:24.14.1-alpine@sha256:8510330d3eb72c804231a834b1a8ebb55cb3796c3e4431297a24d246b8add4d5 AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
RUN npm ci --omit=dev --ignore-scripts --workspace=@traceweaver/backend --include-workspace-root=false --no-audit --no-fund

FROM node:24.14.1-alpine@sha256:8510330d3eb72c804231a834b1a8ebb55cb3796c3e4431297a24d246b8add4d5 AS runtime
LABEL org.opencontainers.image.title="TraceWeaver API" org.opencontainers.image.licenses="Apache-2.0"
ENV NODE_ENV=production API_HOST=0.0.0.0 API_PORT=8080
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json LICENSE NOTICE ./
COPY backend/package.json backend/THIRD_PARTY_NOTICES.txt ./backend/
COPY backend/src ./backend/src
COPY backend/contracts/schemas ./backend/contracts/schemas
COPY backend/scripts/migrate.js backend/scripts/container-env.js ./backend/scripts/
WORKDIR /app/backend
USER node
EXPOSE 8080
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=10 CMD ["node", "-e", "fetch('http://127.0.0.1:8080/health/ready',{signal:AbortSignal.timeout(2000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "--import", "./scripts/container-env.js", "src/server.js"]
