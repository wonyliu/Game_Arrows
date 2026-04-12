# User Center PostgreSQL Deployment

This project now supports a scalable user-center backend with PostgreSQL.

## 1. Backend mode switch

Set environment variables before starting `scripts/dev-server.mjs`:

```powershell
$env:USER_CENTER_BACKEND = "postgres"
$env:USER_CENTER_DATABASE_URL = "postgresql://USER:PASSWORD@HOST:5432/DBNAME"
$env:USER_CENTER_REQUIRE_SCALABLE_DB = "1"
$env:ADMIN_API_KEY = "replace-with-strong-secret"
$env:ADMIN_REQUIRE_KEY = "1"
node scripts/dev-server.mjs
```

Notes:
- `USER_CENTER_BACKEND=postgres` enables PostgreSQL storage.
- `USER_CENTER_DATABASE_URL` (or `DATABASE_URL`) must point to your DB.
- `USER_CENTER_REQUIRE_SCALABLE_DB=1` makes startup fail fast if backend is not PostgreSQL.
- `ADMIN_API_KEY` + `ADMIN_REQUIRE_KEY=1` protects all `/api/admin/*` APIs.
- Ensure backend runtime includes Node package `pg`.

## 2. Database schema

Schema SQL file:

- `/scripts/sql/user-center-postgres.sql`

It creates:
- `user_center_users` table
- `user_center_user_seq` / `user_center_temp_seq` sequences
- leaderboard and lookup indexes

## 3. Migrate existing JSON users

Migration script:

- `/scripts/migrate-user-center-json-to-postgres.mjs`

Run:

```powershell
$env:USER_CENTER_DATABASE_URL = "postgresql://USER:PASSWORD@HOST:5432/DBNAME"
# Optional: custom source JSON path
# $env:USER_CENTER_JSON_PATH = "D:\\Projects\\Game_Arrows\\.local-data\\user-center-db-v1.json"
node scripts/migrate-user-center-json-to-postgres.mjs
```

## 4. Scale notes (10k+ users)

- Leaderboard query is served by SQL ordering with index:
  - `(max_cleared_level DESC, coins DESC, last_active_at DESC)`
- User lookups use indexed keys:
  - `user_id` primary key
  - `username_lower` unique index
- API no longer depends on scanning full JSON files when PostgreSQL mode is enabled.

## 5. Admin DB panel

In `admin.html`, a new "数据库管理" tab is available:
- View DB backend mode and user counts
- Search users by `userId` / username
- Inspect user detail JSON

All DB admin APIs are under `/api/admin/db/*` and require admin key when enabled.

## 6. Operational recommendation

- Keep JSON mode only for local/dev fallback.
- In production, always set:
  - `USER_CENTER_BACKEND=postgres`
  - `USER_CENTER_REQUIRE_SCALABLE_DB=1`
  - `ADMIN_REQUIRE_KEY=1`
- Put backend behind HTTPS reverse proxy (Nginx/Caddy/Cloudflare Tunnel).
- Never expose admin pages/APIs on public network without IP allowlist + API key.
