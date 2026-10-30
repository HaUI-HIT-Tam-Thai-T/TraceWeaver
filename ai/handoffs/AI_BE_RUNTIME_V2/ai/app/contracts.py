# SPDX-FileCopyrightText: 2026 TraceWeaver contributors
# SPDX-License-Identifier: Apache-2.0

"""Validate using the repository's single source of JSON Schema definitions."""

from functools import lru_cache
import json
import math
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker


SCHEMA_PATH = Path(__file__).resolve().parents[2] / "backend/contracts/schemas/domain.schema.json"


class ContractError(ValueError):
    """Safe error message; never includes an input value or validator traceback."""


def _finite(value):
    if isinstance(value, dict):
        return all(_finite(item) for item in value.values())
    if isinstance(value, list):
        return all(_finite(item) for item in value)
    if type(value) in (float, int):
        try:
            return math.isfinite(value)
        except OverflowError:
            return False
    return True


@lru_cache(maxsize=16)
def validator(name):
    domain = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    schema = {"$schema": domain["$schema"], "$defs": domain["$defs"], "$ref": f"#/$defs/{name}"}
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema, format_checker=FormatChecker())


def validate(name, value):
    try:
        valid = _finite(value) and validator(name).is_valid(value)
    except (RecursionError, OverflowError):
        valid = False
    if not valid:
        raise ContractError(f"Payload does not conform to {name}")


def validate_request(value):
    validate("ScoreRequest", value)
    ids = [pair["pair_id"] for pair in value["pairs"]]
    if len(set(ids)) != len(ids):
        raise ContractError("pair_id values must be unique")
    return value


def validate_response(request, response):
    validate("ScoreResponse", response)
    expected = {pair["pair_id"] for pair in request["pairs"]}
    actual = [prediction["pair_id"] for prediction in response["predictions"]]
    if len(actual) != len(expected) or set(actual) != expected:
        raise ContractError("Prediction IDs do not match the requested pair IDs")
    return response


def strict_json_loads(raw):
    def constant(_):
        raise ValueError("Non-standard JSON constant")

    def unique_object(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError("Duplicate JSON object key")
            result[key] = value
        return result

    return json.loads(raw, parse_constant=constant, object_pairs_hook=unique_object)
