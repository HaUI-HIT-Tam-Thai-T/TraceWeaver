// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from '../../contracts/schemas/domain.schema.json' with { type: 'json' };
const ajv = new Ajv2020({ strict: true });
addFormats(ajv);
ajv.addSchema(schema);
export const validBatch = ajv.getSchema(`${schema.$id}#/$defs/BatchRequest`);
export const validEvent = ajv.getSchema(`${schema.$id}#/$defs/EventInput`);
