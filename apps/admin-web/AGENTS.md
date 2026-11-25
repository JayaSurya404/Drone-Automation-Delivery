# SkyNav AI Coding-Agent Rules

## Purpose

These rules apply to Codex, Cursor, Antigravity, Kiro, Trae, Devin and other coding agents working in this repository.

## Architecture rules

1. Read `README.md`, this file, the relevant module documentation and existing tests before changing code.
2. Do not modify `main` directly.
3. Work only on the requested feature/fix scope.
4. Preserve module boundaries and existing architecture.
5. Do not introduce a new framework/library when the repository already has an adequate solution.
6. Keep frontend, API/domain, persistence, AI and simulation responsibilities separated.
7. Do not leak ORM/database models into shared API contracts.
8. All tenant-owned resources must be authorized and scoped server-side.
9. Never trust tenant IDs, role claims or permissions supplied by the UI.
10. Validate all external input at the application boundary.
11. Sensitive operations require authentication, authorization, policy validation and audit logging.
12. AI recommendations must never bypass deterministic safety rules.
13. Simulation and research code must remain isolated from real flight-control execution paths.
14. Never commit passwords, API keys, tokens, certificates or private keys.
15. Do not silently change mission statuses or event schemas.
16. New API endpoints require validation, authorization and tests.
17. New events require versioned schemas and test coverage.
18. Keep shared contract changes small and coordinated.
19. Do not edit database migrations casually; migrations are shared architecture assets.
20. Do not rewrite unrelated code while implementing a feature.

## Before coding

Determine:

- target module
- existing abstractions
- existing contracts
- dependencies
- tests that already cover the area
- files that must change

State the intended change briefly before making a large modification.

## After coding

Run the narrowest relevant checks first, then the repository checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run E2E tests when the change affects a complete user workflow.

## Git rules

Use feature branches:

```text
feature/*
fix/*
hotfix/*
```

Never force-push `main` or `develop`.

After a rebase, a developer may use:

```bash
git push --force-with-lease
```

only on their own feature branch.

## Contract rules

Shared schemas live under `packages/contracts`.

Do not define duplicate versions of the same domain type in frontend, backend, simulator or AI code.

When a contract changes:

1. update the shared schema
2. update affected producers
3. update affected consumers
4. add/update tests
5. document the change

## Mission safety rules

The mission pipeline is:

```text
Plan → Validate → Score → Safety Check → Authorize → Execute
```

The AI route score is advisory. Mandatory safety rules are authoritative.

No agent may implement a feature that makes AI output directly override:

- geofence constraints
- payload limits
- battery reserve rules
- configured weather restrictions
- operator authorization
- emergency procedures

## Telemetry rules

Telemetry is a streaming workload.

Do not create a design where every raw telemetry point is broadcast to every browser.

Normalize, validate and authenticate telemetry before downstream processing.

## Security rules

Never bypass authorization with test-only shortcuts in production paths.

Do not log:

- passwords
- access tokens
- refresh tokens
- private keys
- unnecessary sensitive personal data

## Testing rules

For business logic:

- unit test pure functions and state transitions

For infrastructure boundaries:

- integration test database, Redis, external adapters and authentication

For user workflows:

- use E2E tests

For flight-related logic:

- prefer simulation/failure-injection tests over physical UAV testing

## Dependency rules

Before adding a dependency:

1. check whether an existing dependency already solves the problem
2. verify the dependency is required for the target module
3. keep the change isolated in the correct workspace package
4. update lockfile consistently

## Definition of done

A task is complete only when:

- implementation is correct
- authorization is correct
- validation exists
- tests exist
- errors are handled
- documentation is updated where needed
- lint passes
- typecheck passes
- relevant tests pass
- build passes when applicable
