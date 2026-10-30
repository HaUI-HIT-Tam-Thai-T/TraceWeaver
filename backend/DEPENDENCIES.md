# Dependencies

Generated from package-lock.json by `npm run licenses`. Exact tarball URLs and integrity hashes are retained in the lockfile. Full upstream license/copyright notices are in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt).

Project code: Apache-2.0. Third-party packages retain their original licenses. This inventory records license metadata and notices, not a security audit.

## Runtime and services

| Component | Version | Role | License/source |
|---|---|---|---|
| Node.js | 24.14.1 (engines >=24.14.1 <25) | Backend runtime | [Upstream license and bundled notices](https://github.com/nodejs/node/blob/v24.14.1/LICENSE) |
| npm | 11.11.0 | Package manager | [Upstream](https://github.com/npm/cli/tree/v11.11.0) |
| PostgreSQL | 17.11 | Development database | [PostgreSQL License](https://www.postgresql.org/about/licence/) |
| PostgreSQL image | postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24 | Compose development | [Docker Official Image source](https://github.com/docker-library/postgres); image/base packages require a separate audit when distributing images |
| Keycloak image | 26.8.1@sha256:79c623a22abacf3fe6c00a5fb30f5b7843d717b234033b80995891c06116d244 | Local OIDC/PKCE IdP | [Apache-2.0](https://github.com/keycloak/keycloak/blob/26.8.1/LICENSE.txt); bundled image dependencies require separate distribution audit |

Frontend and Python dependencies are inventoried separately; see [LICENSES.md](../LICENSES.md). Model provenance is documented in [ai/artifacts/sandbox-v2/README.md](../ai/artifacts/sandbox-v2/README.md).

## npm packages (98)

| Package | Version | Scope | License | Source |
|---|---|---|---|---|
| @apidevtools/json-schema-ref-parser | 16.0.5 | development / transitive | MIT | [npm](https://www.npmjs.com/package/@apidevtools/json-schema-ref-parser/v/16.0.5) |
| @apidevtools/openapi-schemas | 2.1.0 | development / transitive | MIT | [npm](https://www.npmjs.com/package/@apidevtools/openapi-schemas/v/2.1.0) |
| @apidevtools/swagger-methods | 3.0.2 | development / transitive | MIT | [npm](https://www.npmjs.com/package/@apidevtools/swagger-methods/v/3.0.2) |
| @apidevtools/swagger-parser | 13.1.0 | development / direct | MIT | [npm](https://www.npmjs.com/package/@apidevtools/swagger-parser/v/13.1.0) |
| @scarf/scarf | 1.4.0 | runtime / transitive | Apache-2.0 | [npm](https://www.npmjs.com/package/@scarf/scarf/v/1.4.0) |
| @types/json-schema | 7.0.15 | development / transitive | MIT | [npm](https://www.npmjs.com/package/@types/json-schema/v/7.0.15) |
| accepts | 2.0.0 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/accepts/v/2.0.0) |
| ajv | 8.20.0 | runtime / direct | MIT | [npm](https://www.npmjs.com/package/ajv/v/8.20.0) |
| ajv-draft-04 | 1.0.0 | development / transitive | MIT | [npm](https://www.npmjs.com/package/ajv-draft-04/v/1.0.0) |
| ajv-formats | 3.0.1 | runtime / direct | MIT | [npm](https://www.npmjs.com/package/ajv-formats/v/3.0.1) |
| argparse | 3.0.3 | development / transitive | PSF-2.0 | [npm](https://www.npmjs.com/package/argparse/v/3.0.3) |
| body-parser | 2.4.0 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/body-parser/v/2.4.0) |
| bytes | 3.1.2 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/bytes/v/3.1.2) |
| call-bind-apply-helpers | 1.0.2 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/call-bind-apply-helpers/v/1.0.2) |
| call-bound | 1.0.4 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/call-bound/v/1.0.4) |
| call-me-maybe | 1.0.2 | development / transitive | MIT | [npm](https://www.npmjs.com/package/call-me-maybe/v/1.0.2) |
| content-disposition | 2.0.1 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/content-disposition/v/2.0.1) |
| content-type | 2.1.0 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/content-type/v/2.1.0) |
| cookie | 0.7.2 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/cookie/v/0.7.2) |
| cookie-signature | 1.2.2 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/cookie-signature/v/1.2.2) |
| debug | 4.4.3 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/debug/v/4.4.3) |
| depd | 2.0.0 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/depd/v/2.0.0) |
| dunder-proto | 1.0.1 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/dunder-proto/v/1.0.1) |
| ee-first | 1.1.1 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/ee-first/v/1.1.1) |
| encodeurl | 2.0.0 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/encodeurl/v/2.0.0) |
| es-define-property | 1.0.1 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/es-define-property/v/1.0.1) |
| es-errors | 1.3.0 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/es-errors/v/1.3.0) |
| es-object-atoms | 1.1.2 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/es-object-atoms/v/1.1.2) |
| escape-html | 1.0.3 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/escape-html/v/1.0.3) |
| etag | 1.8.1 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/etag/v/1.8.1) |
| express | 5.3.0 | runtime / direct | MIT | [npm](https://www.npmjs.com/package/express/v/5.3.0) |
| fast-deep-equal | 3.1.3 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/fast-deep-equal/v/3.1.3) |
| fast-uri | 3.1.9 | runtime / transitive | BSD-3-Clause | [npm](https://www.npmjs.com/package/fast-uri/v/3.1.9) |
| finalhandler | 2.1.1 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/finalhandler/v/2.1.1) |
| forwarded | 0.2.0 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/forwarded/v/0.2.0) |
| fresh | 2.0.0 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/fresh/v/2.0.0) |
| function-bind | 1.1.2 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/function-bind/v/1.1.2) |
| get-intrinsic | 1.3.0 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/get-intrinsic/v/1.3.0) |
| get-proto | 1.0.1 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/get-proto/v/1.0.1) |
| gopd | 1.2.0 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/gopd/v/1.2.0) |
| has-symbols | 1.1.0 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/has-symbols/v/1.1.0) |
| hasown | 2.0.4 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/hasown/v/2.0.4) |
| http-errors | 2.0.1 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/http-errors/v/2.0.1) |
| iconv-lite | 0.7.3 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/iconv-lite/v/0.7.3) |
| inherits | 2.0.4 | runtime / transitive | ISC | [npm](https://www.npmjs.com/package/inherits/v/2.0.4) |
| ipaddr.js | 1.9.1 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/ipaddr.js/v/1.9.1) |
| is-promise | 4.0.0 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/is-promise/v/4.0.0) |
| jose | 6.2.12 | runtime / direct | MIT | [npm](https://www.npmjs.com/package/jose/v/6.2.12) |
| js-yaml | 5.5.0 | development / transitive | MIT | [npm](https://www.npmjs.com/package/js-yaml/v/5.5.0) |
| json-schema-traverse | 1.0.0 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/json-schema-traverse/v/1.0.0) |
| math-intrinsics | 1.1.0 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/math-intrinsics/v/1.1.0) |
| media-typer | 1.1.1 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/media-typer/v/1.1.1) |
| merge-descriptors | 2.0.0 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/merge-descriptors/v/2.0.0) |
| mime-db | 1.54.0 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/mime-db/v/1.54.0) |
| mime-types | 3.0.2 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/mime-types/v/3.0.2) |
| ms | 2.1.3 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/ms/v/2.1.3) |
| negotiator | 1.1.0 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/negotiator/v/1.1.0) |
| object-inspect | 1.13.4 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/object-inspect/v/1.13.4) |
| on-finished | 2.4.1 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/on-finished/v/2.4.1) |
| once | 1.4.0 | runtime / transitive | ISC | [npm](https://www.npmjs.com/package/once/v/1.4.0) |
| openapi-types | 12.1.3 | development / transitive | MIT | [npm](https://www.npmjs.com/package/openapi-types/v/12.1.3) |
| parseurl | 1.3.3 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/parseurl/v/1.3.3) |
| path-to-regexp | 8.4.2 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/path-to-regexp/v/8.4.2) |
| pg | 8.23.1 | runtime / direct | MIT | [npm](https://www.npmjs.com/package/pg/v/8.23.1) |
| pg-cloudflare | 1.4.1 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/pg-cloudflare/v/1.4.1) |
| pg-connection-string | 2.14.1 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/pg-connection-string/v/2.14.1) |
| pg-int8 | 1.0.1 | runtime / transitive | ISC | [npm](https://www.npmjs.com/package/pg-int8/v/1.0.1) |
| pg-pool | 3.14.0 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/pg-pool/v/3.14.0) |
| pg-protocol | 1.16.1 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/pg-protocol/v/1.16.1) |
| pg-types | 2.2.0 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/pg-types/v/2.2.0) |
| pgpass | 1.0.5 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/pgpass/v/1.0.5) |
| postgres-array | 2.0.0 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/postgres-array/v/2.0.0) |
| postgres-bytea | 1.0.1 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/postgres-bytea/v/1.0.1) |
| postgres-date | 1.0.7 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/postgres-date/v/1.0.7) |
| postgres-interval | 1.2.0 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/postgres-interval/v/1.2.0) |
| proxy-addr | 2.0.8 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/proxy-addr/v/2.0.8) |
| qs | 6.16.1 | runtime / transitive | BSD-3-Clause | [npm](https://www.npmjs.com/package/qs/v/6.16.1) |
| range-parser | 1.3.0 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/range-parser/v/1.3.0) |
| raw-body | 3.0.2 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/raw-body/v/3.0.2) |
| require-from-string | 2.0.2 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/require-from-string/v/2.0.2) |
| router | 2.2.0 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/router/v/2.2.0) |
| safer-buffer | 2.1.2 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/safer-buffer/v/2.1.2) |
| send | 1.2.1 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/send/v/1.2.1) |
| serve-static | 2.2.1 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/serve-static/v/2.2.1) |
| setprototypeof | 1.2.0 | runtime / transitive | ISC | [npm](https://www.npmjs.com/package/setprototypeof/v/1.2.0) |
| side-channel | 1.1.1 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/side-channel/v/1.1.1) |
| side-channel-list | 1.0.1 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/side-channel-list/v/1.0.1) |
| side-channel-map | 1.0.1 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/side-channel-map/v/1.0.1) |
| side-channel-weakmap | 1.0.2 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/side-channel-weakmap/v/1.0.2) |
| split2 | 4.2.0 | runtime / transitive | ISC | [npm](https://www.npmjs.com/package/split2/v/4.2.0) |
| statuses | 2.0.2 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/statuses/v/2.0.2) |
| swagger-ui-dist | 5.34.0 | runtime / direct | Apache-2.0 | [npm](https://www.npmjs.com/package/swagger-ui-dist/v/5.34.0) |
| toidentifier | 1.0.1 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/toidentifier/v/1.0.1) |
| type-is | 2.1.0 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/type-is/v/2.1.0) |
| unpipe | 1.0.0 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/unpipe/v/1.0.0) |
| vary | 1.1.2 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/vary/v/1.1.2) |
| wrappy | 1.0.2 | runtime / transitive | ISC | [npm](https://www.npmjs.com/package/wrappy/v/1.0.2) |
| xtend | 4.0.2 | runtime / transitive | MIT | [npm](https://www.npmjs.com/package/xtend/v/4.0.2) |
