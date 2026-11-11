# Frontend — As Crônicas de Beladona

SPA **React 19 + Vite 8 + TypeScript + Tailwind CSS v4** do monorepo Beladona VTT.

## Scripts (na raiz ou neste workspace)

| Comando | Onde | Efeito |
|---------|------|--------|
| `npm run dev` | raiz | Vite em http://localhost:5173 |
| `npm run build` | raiz | `tsc -b` + `vite build` → `frontend/dist` |
| `npm run lint` | raiz | Oxlint |
| `npm run dev` | `frontend/` | Mesmo dev server |

Em dev, `/api` é proxied para `http://localhost:4000` (`vite.config.ts`). Em produção, `VITE_API_URL` define a origem da API (vazio = mesma origem na Vercel).

## Estrutura de `src/`

| Pasta | Conteúdo |
|-------|----------|
| `app/` | `router.tsx`, guards jogador/mestre |
| `components/layout/` | `PlayerShell`, `AdminShell`, `ViewportPageShell` (`app-shell-*`) |
| `features/auth/` | Portal login/cadastro (`AuthPortalPage`) |
| `pages/` | `public/`, `user/`, `admin/`, wizard de personagem |
| `services/api.ts` | Cliente HTTP (`VITE_API_URL` + JWT no `localStorage`) |
| `stores/` | Zustand (auth, wizard) |
| `index.css` | Tokens `@theme`, utilitários (`safe-*`, `app-shell-*`, `auth-portal-*`) |

## Layout responsivo

- **Shells** (`PlayerShell`, `AdminShell`): classe `app-shell`; navegação desktop em `lg+`; nav mobile com scroll horizontal.
- **Auth**: `auth-portal-shell` / `auth-portal-main`; modal de login ADM abaixo de `lg`.
- **Home**: header sticky com safe-area; grids `sm:` / `md:`.
- **Viewport**: `index.html` usa `viewport-fit=cover` para safe-area em iOS.

Breakpoints seguem o padrão Tailwind (base &lt; 640px, `sm` 640, `md` 768, `lg` 1024, `xl` 1280).

## Variáveis de build

Definidas na raiz do monorepo (`.env` local ou Vercel):

| Variável | Uso |
|----------|-----|
| `VITE_API_URL` | Base das chamadas `fetch` (vazio = `/api/v1/...` no mesmo host) |
| `VITE_SUPABASE_*` | Opcional hoje; front fala com a API |

`VITE_*` são **públicas** (entram no bundle). Não coloque segredos com prefixo `VITE_`.

## Deploy

Build de produção é acionado pelo projeto Vercel na **raiz do monorepo** (`vercel.json`: `outputDirectory: frontend/dist`). Não use Root Directory só `frontend/` — a API serverless fica em `api/` na raiz.

Ver [`docs/DEPLOY.md`](../docs/DEPLOY.md) e [`../README.md`](../README.md).
