# SkyNav Team Execution Guide

This document explains exactly how four developers should work on SkyNav without stepping on each other's code.

## 1. Golden rule

Never treat the repository as four people editing the same project independently.

Treat it as:

**one product + four domain owners + one shared contract + pull-request integration.**

The AI coding tools are assistants; Git and CI are the controls that keep the team synchronized.

---

## 2. Team roles

### Developer 1 — Frontend

Own `apps/web` and `packages/ui`.

Focus: dashboard, maps, customer tracking, admin UI, forms, frontend testing.

### Developer 2 — Backend

Own `apps/api`, `db`, and `packages/contracts`.

Focus: API, authentication, RBAC, database, orders, missions, fleet, delivery, audit.

### Developer 3 — AI/ML

Own `services/ai` and `ml`.

Focus: route scoring, ETA, battery model, maintenance model, AI evaluation.

### Developer 4 — Simulator/Telemetry

Own `services/simulator`, `services/telemetry-worker`, and `edge`.

Focus: simulated UAV, telemetry ingestion, WebSocket updates, scenarios, PX4/ArduPilot integration.

---

## 3. Shared files

The following files are shared and must be changed carefully:

```text
packages/contracts/
db/migrations/
turbo.json
pnpm-workspace.yaml
package.json
docker-compose.yml
.github/
README.md
AGENTS.md
```

Changes to these files should normally have a reviewer from at least one other domain.

---

## 4. The Git process

### First time

```bash
git clone <repo-url>
cd skynav
pnpm install
git checkout develop
git pull origin develop
```

### Create your branch

```bash
git checkout -b feature/<your-feature>
```

Examples:

```text
feature/login-rbac
feature/fleet-dashboard
feature/route-scoring
feature/mock-telemetry
```

### Work

Make small commits.

```bash
git add .
git commit -m "feat(api): add mission creation endpoint"
```

### Keep your branch current

```bash
git fetch origin
git rebase origin/develop
```

Resolve conflicts locally, run tests, then push:

```bash
git push --force-with-lease
```

`--force-with-lease` is acceptable only on your own feature branch after a rebase. Never force-push `main` or `develop`.

### Open PR

```text
feature/<name> → develop
```

After review and CI, merge.

### Release

When `develop` is stable:

```text
develop → main
```

Prefer a merge/squash policy defined in GitHub branch protection and never bypass required checks.

---

## 5. How work stays separate

Each developer owns a domain, not a random set of pages.

Example:

```text
Developer 1
  apps/web/

Developer 2
  apps/api/
  db/
  packages/contracts/

Developer 3
  services/ai/
  ml/

Developer 4
  services/simulator/
  services/telemetry-worker/
  edge/
```

If Developer 1 needs a new API field, they create an issue/PR request to Developer 2 rather than changing backend files themselves.

If Developer 3 needs a new API contract, update the contract collaboratively before implementing both sides.

---

## 6. Contract-first integration

The shared package is the handshake between frontend, backend, AI and telemetry.

```text
packages/contracts/
├── auth/
├── orders/
├── missions/
├── drones/
├── telemetry/
├── alerts/
└── events/
```

Example workflow:

1. Backend proposes `MissionStatus`.
2. Contract PR is reviewed.
3. Backend implements it.
4. Frontend consumes it.
5. Simulator publishes matching events.
6. AI service uses only documented fields.

No contributor should invent a second version of the same type in a different package.

---

## 7. How to avoid merge conflicts

### Good

Developer 1 changes:

`apps/web/src/features/missions/`

Developer 2 changes:

`apps/api/src/modules/missions/`

Developer 3 changes:

`services/ai/src/route_scoring/`

Developer 4 changes:

`services/simulator/src/telemetry/`

### Dangerous

All four developers editing:

`package.json`

`packages/contracts/src/index.ts`

`README.md`

`docker-compose.yml`

at the same time.

When a shared change is necessary, create a small dedicated PR first.

---

## 8. Issue format

Every task should have:

```text
Title
Problem
Scope
Acceptance criteria
Owner
Dependencies
Test plan
```

Example:

```text
Title: Add mission authorization API

Problem:
Operators cannot authorize a validated mission.

Scope:
POST /api/v1/missions/:id/authorize

Acceptance:
- user permission is checked
- mission must be VALIDATING/READY
- geofence validation must pass
- battery rule must pass
- audit record is written
- response uses shared contract

Owner:
Developer 2

Dependencies:
contracts/mission.ts

Test plan:
unit + integration
```

---

## 9. Testing responsibility

### Developer 1

- component tests
- form validation tests
- dashboard state tests
- Playwright user flows

### Developer 2

- domain unit tests
- API integration tests
- authorization tests
- tenant-isolation tests

### Developer 3

- model/unit tests
- route-scoring correctness
- evaluation datasets
- inference latency tests

### Developer 4

- telemetry parser tests
- simulation scenarios
- WebSocket integration
- failure/recovery tests

---

## 10. The integration test that matters most

Before calling a milestone complete, all four developers must be able to run:

```text
create user
   ↓
create organization
   ↓
register drone
   ↓
create order
   ↓
create mission
   ↓
validate mission
   ↓
score route
   ↓
authorize
   ↓
start simulator
   ↓
receive telemetry
   ↓
show drone on live map
   ↓
simulate arrival
   ↓
OTP/QR verification
   ↓
proof of delivery
```

If one member's feature cannot be exercised by the other three, integration is incomplete.

---

## 11. Coding-agent workflow

Before asking an AI coding agent to change anything, give it:

```text
1. Read README.md.
2. Read AGENTS.md.
3. Read the module's existing code.
4. Read tests.
5. Explain what files it will change.
6. Implement only the requested scope.
7. Run lint, typecheck and tests.
8. Show changed files and test results.
```

Do not ask the agent to “build the whole project” on a live shared branch.

Use one focused task per branch.

---

## 12. Recommended `AGENTS.md` rules

```md
# SkyNav Agent Rules

- Do not edit main directly.
- Do not change shared contracts without tests.
- Follow existing architecture before introducing abstractions.
- Keep API, domain, persistence and UI concerns separated.
- Validate all external input.
- Enforce organization/tenant authorization server-side.
- Do not put secrets in source code.
- Do not add duplicate dependencies.
- Do not change mission states without updating the state machine and tests.
- AI recommendations cannot override deterministic safety rules.
- Simulation code must remain isolated from production flight-control code.
- Run lint, typecheck and tests before finishing.
```

---

## 13. Daily team routine

### Start of day

```bash
git checkout develop
git pull --rebase origin develop
git checkout feature/<branch>
git rebase develop
pnpm install
pnpm lint
pnpm typecheck
```

### Before pushing

```bash
pnpm lint
pnpm typecheck
pnpm test
```

For end-to-end changes:

```bash
pnpm test:e2e
```

### Before opening PR

```bash
git status
git diff --stat
git log --oneline -5
```

---

## 14. PR review checklist

Reviewer should verify:

- Does this belong to the stated module?
- Does it preserve the architecture?
- Is authorization enforced?
- Are tenant boundaries safe?
- Are contracts consistent?
- Are tests present?
- Are failure states handled?
- Did the change introduce unnecessary dependencies?
- Can the change be tested without another developer's machine?
- Does CI pass?

---

## 15. Release workflow

```text
feature branch
      ↓
PR → develop
      ↓
CI
      ↓
Code review
      ↓
Merge
      ↓
Integration testing
      ↓
Release candidate
      ↓
main
      ↓
Deployment
```

Never merge an untested feature directly to `main` just because a demo is close.

---

## 16. Milestone ownership

### Milestone 1 — Foundation

Owner: Developer 2

Support: all

Exit criteria:

- monorepo
- database
- auth
- contracts
- CI
- local stack

### Milestone 2 — Vertical slice

Owners: all four

Exit criteria:

- order
- mission
- simulated telemetry
- live map
- delivery completion

### Milestone 3 — Safety

Owners: Developer 2 + 4

Support: Developer 3

Exit criteria:

- geofences
- weather rules
- battery rules
- incidents

### Milestone 4 — AI

Owner: Developer 3

Support: Developer 2 + 4

Exit criteria:

- route scoring
- ETA
- battery prediction

### Milestone 5 — Research

Owner: Developer 3 + 4

Exit criteria:

- computer vision
- digital twin
- swarm research prototype

---

## 17. Definition of Done for every PR

```text
[ ] Correct branch
[ ] Small scope
[ ] Tests added
[ ] Authorization checked
[ ] Validation added
[ ] Logs/errors handled
[ ] Documentation updated
[ ] No secrets
[ ] Lint passes
[ ] Typecheck passes
[ ] Tests pass
[ ] Build passes
```

---

## 18. The most important rule for this project

Do not try to prove that SkyNav has 50 advanced features.

Prove that one mission works from beginning to end, then show how the architecture safely extends it.

That produces a much stronger engineering project and makes four-person collaboration dramatically easier.
