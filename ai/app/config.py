# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0

from dataclasses import dataclass, field
import os


@dataclass(frozen=True)
class Config:
    service_secret: str = field(repr=False)
    mode: str = "model"
    app_env: str = "development"
    host: str = "127.0.0.1"
    port: int = 8000

    def __post_init__(self):
        if (not isinstance(self.service_secret, str) or len(self.service_secret) < 32
                or any(character.isspace() for character in self.service_secret)):
            raise ValueError("SCORER_SERVICE_SECRET must have at least 32 non-whitespace characters")
        if self.app_env not in {"development", "test", "production"}:
            raise ValueError("APP_ENV must be development, test or production")
        if self.mode not in {"model", "baseline"}:
            raise ValueError("SCORER_MODE must be model or baseline")
        if self.mode == "baseline" and self.app_env == "production":
            raise ValueError("Baseline mode is restricted to development and test")
        if not self.host or type(self.port) is not int or not 1 <= self.port <= 65535:
            raise ValueError("SCORER_HOST/SCORER_PORT configuration is invalid")


def read_config(env=None):
    env = os.environ if env is None else env
    port = env.get("SCORER_PORT", "8000")
    if not port.isascii() or not port.isdigit():
        raise ValueError("SCORER_PORT must be an integer between 1 and 65535")
    return Config(
        service_secret=env.get("SCORER_SERVICE_SECRET", ""),
        mode=env.get("SCORER_MODE", "model"),
        app_env=env.get("APP_ENV", "development"),
        host=env.get("SCORER_HOST", "127.0.0.1"),
        port=int(port),
    )
