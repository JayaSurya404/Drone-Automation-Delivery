variable "fly_org" {
  description = "Fly.io organization slug that owns every app in this stack."
  type        = string
}

variable "region" {
  description = "Primary Fly.io region (e.g. \"iad\" for Ashburn, VA)."
  type        = string
  default     = "iad"
}

variable "environment" {
  description = "\"staging\" or \"production\" — used to suffix app names so both can coexist."
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be \"staging\" or \"production\"."
  }
}

variable "api_image" {
  description = "Fully-qualified image ref for apps/api, e.g. registry.fly.io/skynav-api-production:<git-sha> — built and pushed by CI before this is applied."
  type        = string
}

variable "customer_web_image" {
  description = "Fully-qualified image ref for apps/customer-web."
  type        = string
}

variable "admin_web_image" {
  description = "Fully-qualified image ref for apps/admin-web."
  type        = string
}

# --- Secrets (sensitive — see infra/terraform/README.md) ---

variable "database_url" {
  description = "Postgres connection string from `flyctl postgres create` / attach (see docs/DEPLOYMENT.md) — never the local dev database."
  type        = string
  sensitive   = true
}

variable "redis_url" {
  description = "Redis connection string (Upstash via Fly, or `flyctl redis create`)."
  type        = string
  sensitive   = true
}

variable "storage_access_key" {
  type      = string
  sensitive = true
}

variable "storage_secret_key" {
  type      = string
  sensitive = true
}

variable "jwt_access_secret" {
  description = "A freshly generated random value — must NOT reuse the local-dev default in .env.example."
  type        = string
  sensitive   = true
}

variable "telemetry_ingest_api_key" {
  type      = string
  sensitive = true
}

variable "bootstrap_super_admin_password" {
  description = "Only used the first time the production database is seeded; rotate immediately after first login."
  type        = string
  sensitive   = true
}

variable "stripe_secret_key" {
  description = "Leave as the empty string to keep Stripe in test mode / disabled (see docs/DEPLOYMENT.md's Payments section) — only set a real sk_live_ key once you've deliberately decided to accept live payments."
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_webhook_secret" {
  type      = string
  sensitive = true
  default   = ""
}
