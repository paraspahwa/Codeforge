# Authentication

CodeForge supports multiple sign-in methods. **Native email/password** is the default for local Docker and self-hosted deployments.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (`apps/web`) |
| API | FastAPI (`services/api`) |
| Database | PostgreSQL (Docker) or SQLite (host dev) |
| Password hashing | bcrypt (cost 12) |
| Sessions | JWT (HS256) + HttpOnly cookie via `/api/auth/session` |

## User flows

### Sign up — `/signup`

1. User submits email, username, and password.
2. API validates strength (8+ chars, upper, lower, digit).
3. Password is bcrypt-hashed; account stored in `user_accounts`.
4. API returns JWT; web stores token in `sessionStorage` and HttpOnly cookie.

### Sign in — `/login`

1. Email + password → `POST /api/v1/auth/login`.
2. On failure: **401 Invalid credentials** (no user enumeration).
3. On success: same session handling as sign-up.

### Sign out

Settings → **Sign out**, or `POST /api/auth/logout` (clears HttpOnly cookie).

### Protected routes

`apps/web/middleware.js` redirects unauthenticated users from `/app`, `/code`, `/settings`, etc. to `/login?next=...`.

### Account settings — `/settings` → Profile

- View email, username, member since
- Change password (requires current password)
- Sign out

## API endpoints

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/auth/config` | Public |
| POST | `/api/v1/auth/register` | Public |
| POST | `/api/v1/auth/login` | Public |
| GET | `/api/v1/auth/me` | Bearer JWT |
| POST | `/api/v1/auth/change-password` | Bearer JWT |

## Environment

```env
CODEFORGE_NATIVE_AUTH_ENABLED=true
CODEFORGE_AUTH_JWT_SECRET=<long-random-secret>
CODEFORGE_AUTH_JWT_TTL_HOURS=168
CODEFORGE_ALLOW_DEV_LOGIN=false   # disable mock dev-user in production
```

For gateway deployments, browser calls `/api/v1/*` on port 8080; Next.js BFF routes `/api/auth/*` stay on the web container (see `docs/microservices.md`).

## Alternative providers

- **Supabase Auth** — set `NEXT_PUBLIC_SUPABASE_*` + `SUPABASE_JWT_SECRET`
- **OIDC / SSO** — `CODEFORGE_OIDC_ENABLED=true`
- **Dev login** — `CODEFORGE_ALLOW_DEV_LOGIN=true` (development only)

## Security notes

- Passwords never stored in plain text.
- Rate limits on register/login (20/min per IP).
- JWT signed with `CODEFORGE_AUTH_JWT_SECRET` (falls back to `SUPABASE_JWT_SECRET` in dev).
- HttpOnly `codeforge_session` cookie for SSR middleware protection.
