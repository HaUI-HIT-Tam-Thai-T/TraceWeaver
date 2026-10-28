# Dashboard

BE-21 adds `GET /api/v1/workspaces/{wid}/dashboard`. Backend contract progress is **17/21 implemented**, four planned. Restart the source server or rebuild the API image before using this route in Docker.

The route requires a verified user-client JWT, active workspace membership and a reader role (viewer/operator/reviewer/admin). Every counted run requires current direct/group read grants for **all requested sources**, including sources with no events. Admin does not bypass grants. Missing/revoked membership returns404; a member without a reader role receives403. Hidden runs contribute no counters. Operational failures return sanitized503.

| Counter | Meaning |
|---|---|
| `runs` | Visible runs created within the filter range |
| `degraded_runs` | Those runs whose persisted result is degraded |
| `unresolved_events` | Event occurrences outside the current root component in completed runs, summed per run |
| `waiting_cases` | Cases on those runs whose latest workflow state is `new` or `assigned` |

Pending and accepted links connect the graph in either direction; rejected links do not. Latest reviews and manual links affect the unresolved counter immediately. An event present in two run snapshots can count twice. The response contains these four integer counters and a `filters` object echoing the provided time filters. One PostgreSQL statement captures membership, grants, reviews, workflow states and counts in one MVCC snapshot.

Optional `from` and `to` are inclusive UTC instants filtering **parent run `created_at`**, for every metric. They do not filter event occurrence, case creation or transition time. Arbitrary fractions are preserved in the response; SQL rounds lower bounds up and upper bounds down to PostgreSQL microseconds. Unknown/repeated query keys, empty/invalid times and reversed ranges return400. Each time value is limited to128 characters.

For case drill-down, send the same `from`/`to` to `GET /cases` and request `state=new` and `state=assigned` separately for waiting cases. Optional `owner_id` further narrows the list. Signed case cursors bind both time filters, actor/workspace/state/owner/limit/current scope; changing filters requires a new first page. Separate requests observe live state and may differ after concurrent changes.

Run detail and graph remain available at `GET /runs/{rid}` and `GET /runs/{rid}/graph` for known run IDs. There is no global run-list endpoint or aggregate unresolved-event list. This route adds no frontend, scorer or claim of representative performance: the five-user/10k-event target remains unmeasured. Three core workflow HTTP operations and scorer remain planned.

## Verification

```powershell
node --test backend/tests/backend/dashboard.test.js
node --env-file-if-exists=.env --test backend/tests/integration/dashboard.test.js
node --env-file-if-exists=.env --test backend/tests/identity/dashboard.integration.test.js
```

Tests use real PostgreSQL and JOSE/Express/HTTP with the existing local Postman JWKS simulation. They check schema, counters against current graph/workflow, manual/review changes, exact time bounds, matching case filters, cursor binding, token/client isolation, direct/group/membership/role revocation and sanitized errors. Live Keycloak SSO is a separate integration check.
