# Local Identity dependency simulation

Postman CLI tested: 1.74.0. No cloud account/workspace is used.

`oidc-jwks.openapi.json` captures the Keycloak public certs response shape. Mock was generated from that contract then adapted to receive ephemeral PUBLIC JWKS via OIDC_TEST_JWKS. Private keys stay in the Node test process. Unmodeled calls return 501. This is local-only, not login infrastructure.

`simulations/identity.sim.yaml` routes under `/oidc`. `npm run test:identity` starts each simulation on an explicit available loopback port, points the real JOSE client at its certs URL, checks request logs and stops only its own process tree. JSON/HTML/slow variants use OIDC_TEST_FAILURE. Slow response: 1000ms versus BE test timeout 300ms. Tests wait for asynchronous request logs after verification rejects.

Owner search was skipped because CLI is signed out. No mock push/deploy. The simulation establishes BE JWKS HTTP behavior, not a live Keycloak/SSO deployment.
