# Every value here is sourced from a `sensitive = true` variable (see
# variables.tf) — never a literal. `fly_secret` writes to Fly's own secrets
# store (encrypted at rest, injected as env vars at the machine's runtime),
# not to this state file's plain-text representation of the resource
# itself... though note Terraform state IS a plaintext blob by default, so
# remote state (see main.tf) with encryption at rest is not optional for
# real use — a local terraform.tfstate would otherwise be the single
# biggest secret-leak risk in this entire setup.

locals {
  api_secrets = {
    DATABASE_URL                    = var.database_url
    REDIS_URL                       = var.redis_url
    STORAGE_ACCESS_KEY              = var.storage_access_key
    STORAGE_SECRET_KEY              = var.storage_secret_key
    JWT_ACCESS_SECRET               = var.jwt_access_secret
    TELEMETRY_INGEST_API_KEY        = var.telemetry_ingest_api_key
    BOOTSTRAP_SUPER_ADMIN_PASSWORD  = var.bootstrap_super_admin_password
    STRIPE_SECRET_KEY               = var.stripe_secret_key
    STRIPE_WEBHOOK_SECRET           = var.stripe_webhook_secret
  }
}

resource "fly_secret" "api" {
  for_each = local.api_secrets
  app      = fly_app.api.name
  name     = each.key
  value    = each.value
}
