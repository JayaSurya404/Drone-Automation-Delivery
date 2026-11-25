# SkyNav — Terraform (Fly.io)

**Status: written, not applied.** Phase 13 produced this as ready-to-review
infrastructure-as-code — no `terraform plan`/`apply` has been run against a
real Fly.io account in this environment (none was available). Treat it as a
reviewed starting point, not a verified one; run `terraform plan` yourself
before `apply` and expect to adjust resource arguments against whatever the
`fly-apps/fly` provider version you pin actually supports at the time.

## What's here vs. what isn't

Terraform cleanly expresses the three `fly_app` resources (API,
customer-web, admin-web) and their attached volumes. **Postgres and Redis
are deliberately *not* expressed as Terraform resources here** — Fly's own
recommended path for both is its CLI (`flyctl postgres create`, and Redis
via the Upstash integration in the Fly dashboard or `flyctl redis create`),
not a first-party Terraform resource; forcing them into Terraform anyway
would produce something that looks like real IaC but doesn't match how Fly
actually expects these to be provisioned or managed day to day. See
`docs/DEPLOYMENT.md` for the exact `flyctl` commands — the connection
strings they produce feed into the `fly_app` secrets Terraform *does*
manage.

## Layout

- `main.tf` — provider + backend configuration.
- `variables.tf` — inputs (org, region, image tags, non-secret config).
- `apps.tf` — the three `fly_app` resources and their volumes.
- `secrets.tf` — `fly_secret` resources referencing variables, never literal
  values (see "Secrets" below).

## Secrets

No secret is a Terraform literal. Every `fly_secret` resource's value comes
from a Terraform variable marked `sensitive = true`, sourced at apply time
from your shell environment (`TF_VAR_*`) or a proper secrets backend (a
Terraform Cloud workspace's own encrypted variables, or a vault of your
choosing) — never committed, never in `terraform.tfvars` if that file is
tracked by git (it isn't — see the root `.gitignore`).

## Usage (once you have a real Fly.io account)

```bash
cd infra/terraform
terraform init
terraform plan -var-file=production.tfvars   # review every change first
terraform apply -var-file=production.tfvars
```

`production.tfvars` is intentionally not included — copy `terraform.tfvars.example`
and fill in your own org/region/secret values locally; it's gitignored.
