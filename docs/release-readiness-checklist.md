# Release Readiness Checklist (User Center)

This checklist is for production launch with 10k+ users.

## Already implemented in code

- Scalable storage backend switch:
  - PostgreSQL supported (`USER_CENTER_BACKEND=postgres`)
  - Production hard-fail guard (`USER_CENTER_REQUIRE_SCALABLE_DB=1`)
- Admin API protection:
  - API key verification for all `/api/admin/*`
  - Env guard: `ADMIN_API_KEY` + `ADMIN_REQUIRE_KEY=1`
- Password security:
  - New users use `scrypt-v1` hashing
  - Legacy users remain compatible (`sha256-v1`) for login migration period
- Leaderboard scalability:
  - SQL sorting with leaderboard index
- DB migration tooling:
  - JSON -> PostgreSQL migration script included
- Security headers:
  - `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`

## Must be completed by deployment environment

- HTTPS termination enabled (Nginx/Caddy/Cloudflare, TLS1.2+)
- DB network isolation:
  - PostgreSQL private network only
  - No public 0.0.0.0/0 access
- Secrets management:
  - `USER_CENTER_DATABASE_URL` / `ADMIN_API_KEY` managed via secret manager
  - no plaintext secrets in repo
- Backups:
  - daily logical backup + retention + restore drill
- Monitoring and alerting:
  - API 5xx rate
  - DB CPU/memory/connections
  - latency p95 / p99

## Recommended next hardening

- Replace user-id based session trust with signed JWT/session-token.
- Add login rate limiting + IP/device abuse controls.
- Add structured audit logs for admin operations.
