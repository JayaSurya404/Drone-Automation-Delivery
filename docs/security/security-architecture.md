# Security architecture

All tenant data is scoped and authorized server-side. Credentials and tokens are never logged. Sensitive operations require authentication, authorization, deterministic policy validation, and audit logging.
