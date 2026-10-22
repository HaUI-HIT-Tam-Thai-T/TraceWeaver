# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0

import sys

import uvicorn

from ai.app.api import create_app
from ai.app.config import read_config


def main():
    try:
        config = read_config()
    except ValueError as error:
        print(str(error), file=sys.stderr)
        return 1
    uvicorn.run(create_app(config), host=config.host, port=config.port,
                access_log=False, server_header=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
