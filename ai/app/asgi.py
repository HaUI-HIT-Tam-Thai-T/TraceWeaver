# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0
"""ASGI entry point for configured deployment servers (including TLS)."""
from ai.app.api import create_app
from ai.app.config import read_config

app = create_app(read_config())
