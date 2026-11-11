# Infraestrutura — Beladona VTT

Recursos versionados no Git que descrevem **como** o app sobe em produção ou em Docker local. Não substituem criar o projeto Supabase no painel.

## Mapa rápido

| Recurso | Arquivo(s) | Quem provisiona |
|---------|------------|-----------------|
| Schema Postgres + RLS | `supabase/migrations/*.sql` | Supabase (`db push` / workflow CI) |
| SPA + API serverless (opção A) | `vercel.json`, `api/index.ts` | Vercel (root = **raiz do monorepo**) |
| API Docker 24/7 (opção B) | `infrastructure/render.yaml`, `docker/Dockerfile.backend.prod` | Render Web Service `beladona-api` |
| Stack local | `compose.yaml`, `compose.prod.yaml`, `docker/*` | `npm run docker:dev` / `docker:prod` |
| CI testes + imagem API | `.github/workflows/ci.yml`, `cd.yml` | GitHub Actions (não publica na internet) |
| Migrações automáticas | `.github/workflows/supabase-migrate.yml` | Secrets `SUPABASE_*` no GitHub |
| Monitor uptime | `.github/workflows/monitor.yml` | Secrets `HEALTH_URL`, `SITE_URL` |

Guia operacional completo: [`docs/DEPLOY.md`](../docs/DEPLOY.md).

## Opção A — Vercel (recomendada)

1. Conectar repo na Vercel com **Root Directory = raiz** (onde estão `vercel.json` e `api/`).
2. Build: `npm run build` · Output: `frontend/dist`.
3. Environment: `SUPABASE_*`, `CORS_ORIGIN`, `ALLOW_DEV_AUTH=false`, `RESEND_*` (opcional).
4. `VITE_API_URL` **vazio** em Production.

## Opção B — Vercel (SPA) + Render (API)

1. **Render:** Blueprint → `infrastructure/render.yaml` → serviço `beladona-api`.
2. **Environment no Render:** `SUPABASE_*`, `CORS_ORIGIN=https://seu-app.vercel.app`, `RUN_STANDALONE=true`, `ALLOW_DEV_AUTH=false`, `RESEND_*` (opcional).
3. **Vercel:** só `VITE_API_URL=https://sua-api.onrender.com` (tipo **Config**, sem Sensitive).
4. **GitHub monitor:** `HEALTH_URL=https://sua-api.onrender.com/health`, `SITE_URL=https://seu-app.vercel.app/`.

Render **não** publica o site nem o Postgres — só o processo Node.

## Supabase

- Criar projeto em [supabase.com/dashboard](https://supabase.com/dashboard).
- Fonte oficial de migrações: **`supabase/migrations/`** (workflow `supabase db push`).
## Docker local

```bash
npm run docker:dev    # compose.yaml — API :4000, Vite :5173
npm run docker:prod   # compose.prod.yaml — nginx :8080, API :4000
npm run docker:test   # compose.test.yaml — suíte Vitest
```

Variáveis: `.env` na raiz ou `env_file` nos compose.

## Ordem sugerida (ambiente novo)

1. Supabase + migrações + URLs de Auth.
2. GitHub Secrets (migrate, keepalive, monitor).
3. Vercel (opção A ou B).
4. Render somente se opção B.
5. Resend quando precisar de e-mail transacional da API.
