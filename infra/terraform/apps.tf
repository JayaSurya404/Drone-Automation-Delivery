# Three separate Fly apps — one per deployable process. This mirrors how
# they already run as three independent processes in dev (ports
# 4000/3000/3001); it is a deployment-topology decision, not a departure
# from the modular-monolith rule (that rule is about apps/api's own
# internals, not about frontend/backend process separation, which has been
# true since Phase 1).

resource "fly_app" "api" {
  name = "skynav-api-${var.environment}"
  org  = var.fly_org
}

resource "fly_app" "customer_web" {
  name = "skynav-customer-web-${var.environment}"
  org  = var.fly_org
}

resource "fly_app" "admin_web" {
  name = "skynav-admin-web-${var.environment}"
  org  = var.fly_org
}

# Public IPv4 + IPv6 for each app so a custom domain can point at it.
resource "fly_ip" "api_v4" {
  app  = fly_app.api.name
  type = "v4"
}
resource "fly_ip" "api_v6" {
  app  = fly_app.api.name
  type = "v6"
}
resource "fly_ip" "customer_web_v4" {
  app  = fly_app.customer_web.name
  type = "v4"
}
resource "fly_ip" "customer_web_v6" {
  app  = fly_app.customer_web.name
  type = "v6"
}
resource "fly_ip" "admin_web_v4" {
  app  = fly_app.admin_web.name
  type = "v4"
}
resource "fly_ip" "admin_web_v6" {
  app  = fly_app.admin_web.name
  type = "v6"
}

# TLS certificates — only meaningful once you own the domain and have
# pointed its DNS at the IPs above; `terraform apply` will simply leave
# these pending until that DNS step is done outside Terraform.
resource "fly_cert" "api" {
  app      = fly_app.api.name
  hostname = "api.${var.environment == "production" ? "" : "${var.environment}."}skynav.example"
}
resource "fly_cert" "customer_web" {
  app      = fly_app.customer_web.name
  hostname = var.environment == "production" ? "skynav.example" : "${var.environment}.skynav.example"
}
resource "fly_cert" "admin_web" {
  app      = fly_app.admin_web.name
  hostname = "admin${var.environment == "production" ? "" : "-${var.environment}"}.skynav.example"
}
