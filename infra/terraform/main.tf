terraform {
  required_version = ">= 1.6"

  required_providers {
    fly = {
      source  = "fly-apps/fly"
      version = "~> 0.0.23"
    }
  }

  # Remote state is required for a real team deployment (local state has no
  # locking and would conflict the moment a second person or CI runs this).
  # Left commented rather than pointed at a bucket that doesn't exist yet —
  # uncomment and fill in once you've created one.
  # backend "s3" {
  #   bucket = "skynav-terraform-state"
  #   key    = "production/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

provider "fly" {
  # Reads FLY_API_TOKEN from the environment — never put a real token in
  # this file or in a tracked .tfvars file.
}
