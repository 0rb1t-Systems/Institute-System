# BRCE Management System

Multi-tenant education center management system (frontend + Supabase).

## Stack

- **Frontend:** React, Vite, TypeScript, Tailwind
- **Backend:** Supabase (Postgres, Auth, RLS, Edge Functions)

## Setup

### 1. Clone & install

```bash
cd frontend
npm install
```

### 2. Environment

Copy the example env and fill in your values (never commit real secrets):

```bash
cp .env.example .env
```

Required (browser-safe):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Optional:

- `VITE_APP_ROOT_DOMAIN` (tenant subdomains in production)
- EmailJS public keys (fallback only)

**Do not** put `SUPABASE_SERVICE_ROLE_KEY`, Resend, or payment secrets in `.env` / Vite. Set those in Supabase Dashboard → Edge Functions → Secrets.

### 3. Run locally

```bash
npm run dev
```

App runs on port `3000`.

### 4. Database & functions

- Migrations: `supabase/migrations/`
- Edge Functions: `supabase/functions/`
- Deploy helpers: `scripts/deploy-edge.ps1` / `scripts/deploy-edge.sh`

## Security notes

| Commit | Do not commit |
|--------|----------------|
| Source (`frontend/src`, `supabase/…`) | `.env` with real keys |
| `.env.example` | `node_modules/`, `dist/` |
| Docs & scripts | Service role / API secrets |

Prefer a **private** GitHub repo until you are ready to open-source.

## Scripts (frontend)

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run test:rls` | Cross-tenant RLS tests |
