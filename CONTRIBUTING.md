# Contributing to SkyNav

Create focused branches from `develop` using `feature/*`, `fix/*`, or `hotfix/*`; never modify `main` directly. Keep ownership boundaries: web/UI, API/database/contracts, AI/ML, and simulator/telemetry/edge. Coordinate shared-file changes through review.

Before opening a pull request, run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`. New API operations require validation, authorization, tenant-isolation tests, and audit behavior. New shared events require versioned schemas and tests.
