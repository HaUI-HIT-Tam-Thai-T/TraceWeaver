# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0
FROM python:3.12-slim@sha256:aa943ce411423c7582288f18707ff66eddcbaeb510502d747a72aeb34f30d159
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app
COPY ai/requirements.txt ./ai/requirements.txt
RUN python -m pip install --no-cache-dir --only-binary=:all: -r ai/requirements.txt
COPY LICENSE NOTICE ./
COPY ai/DEPENDENCIES.md ai/THIRD_PARTY_NOTICES.txt ./ai/
COPY ai/app ./ai/app
COPY backend/contracts/schemas/domain.schema.json ./backend/contracts/schemas/domain.schema.json
COPY ai/artifacts/sandbox-v2/model_sandbox_v2.json ai/artifacts/sandbox-v2/manifest.json ./ai/artifacts/sandbox-v2/
RUN python -c "import json; from ai.app.contracts import SCHEMA_PATH; assert json.loads(SCHEMA_PATH.read_text())['$defs']['ScoreRequest']"
USER 65532:65532
EXPOSE 8443
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=12 CMD ["python", "-c", "import ssl,urllib.request; urllib.request.urlopen('https://localhost:8443/health/ready',context=ssl.create_default_context(cafile='/run/scorer-tls/server.crt'),timeout=2).close()"]
CMD ["python", "-m", "uvicorn", "ai.app.asgi:app", "--host", "0.0.0.0", "--port", "8443", "--ssl-keyfile", "/run/scorer-tls/server.key", "--ssl-certfile", "/run/scorer-tls/server.crt", "--no-access-log", "--no-server-header"]
