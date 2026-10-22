# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0

import logging
import secrets
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException
from starlette.requests import ClientDisconnect

from ai.app.baseline import BaselineScorer, UnavailableScorer
from ai.app.config import Config
from ai.app.contracts import ContractError, strict_json_loads, validate_request, validate_response


MAX_BODY_BYTES = 1048576
logger = logging.getLogger("traceweaver.scorer")


class APIError(Exception):
    def __init__(self, status, code, message):
        self.status, self.code, self.message = status, code, message


def create_app(config: Config, scorer=None):
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, redirect_slashes=False)
    engine = scorer if scorer is not None else (
        BaselineScorer() if config.mode == "baseline" else UnavailableScorer()
    )

    def error_response(request, status, code, message):
        headers = {"WWW-Authenticate": "Bearer"} if status == 401 else None
        return JSONResponse({
            "error": {"code": code, "message": message},
            "request_id": request.state.request_id,
        }, status_code=status, headers=headers)

    @app.middleware("http")
    async def context(request: Request, call_next):
        request.state.request_id = str(uuid4())
        try:
            response = await call_next(request)
        except Exception:
            logger.error("INTERNAL_ERROR request_id=%s", request.state.request_id)
            response = error_response(request, 500, "INTERNAL_ERROR", "Internal server error")
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Scorer-Method"] = engine.method
        return response

    @app.exception_handler(APIError)
    async def known_error(request: Request, error: APIError):
        return error_response(request, error.status, error.code, error.message)

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, error: HTTPException):
        code, message = ("NOT_FOUND", "Resource not found") if error.status_code == 404 else (
            "METHOD_NOT_ALLOWED", "Method not allowed"
        )
        return error_response(request, error.status_code, code, message)

    @app.get("/health/live")
    async def live():
        return {"status": "ok"}

    @app.get("/health/ready")
    async def ready():
        if not engine.ready:
            raise APIError(503, "SCORER_UNAVAILABLE", "Scorer is not ready")
        return {"status": "ready"}

    @app.post("/internal/v1/score-pairs")
    async def score_pairs(request: Request):
        credentials = request.headers.getlist("authorization")
        scheme, _, token = credentials[0].partition(" ") if len(credentials) == 1 else ("", "", "")
        if scheme.lower() != "bearer" or not secrets.compare_digest(
                token.encode("utf-8"), config.service_secret.encode("utf-8")):
            raise APIError(401, "UNAUTHORIZED", "Valid service credential is required")
        if request.headers.get("content-encoding", "identity").lower() != "identity":
            raise APIError(415, "UNSUPPORTED_ENCODING", "Request encoding is not supported")
        media = request.headers.get("content-type", "").lower().replace(" ", "").split(";")
        if media[0] != "application/json" or any(
                parameter.startswith("charset=") and parameter not in {"charset=utf-8", 'charset="utf-8"'}
                for parameter in media[1:]):
            raise APIError(415, "UNSUPPORTED_MEDIA_TYPE", "UTF-8 application/json is required")
        body = bytearray()
        try:
            async for chunk in request.stream():
                if len(body) + len(chunk) > MAX_BODY_BYTES:
                    raise APIError(413, "PAYLOAD_TOO_LARGE", "Request body exceeds the limit")
                body.extend(chunk)
            payload = strict_json_loads(body.decode("utf-8"))
        except (ValueError, UnicodeError, RecursionError, ClientDisconnect):
            raise APIError(400, "INVALID_JSON", "Request body is not valid JSON") from None
        try:
            validate_request(payload)
        except ContractError:
            raise APIError(422, "INVALID_SCORE_REQUEST", "Request does not match the scoring contract") from None
        if not engine.ready:
            raise APIError(503, "SCORER_UNAVAILABLE", "Scorer is not ready")
        try:
            response = engine.score(payload)
            validate_response(payload, response)
        except Exception:
            logger.error("SCORING_FAILED request_id=%s", request.state.request_id)
            raise APIError(503, "SCORER_UNAVAILABLE", "Scoring is temporarily unavailable") from None
        return JSONResponse(response)

    return app
