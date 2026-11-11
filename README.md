# As Crônicas de Beladona — Sanguis & Shadow

Monorepo de **mesa virtual (VTT)** para a campanha **Beladona**, em tom feudal-sombrio inspirado em crônicas vampíricas. Jogadores criam fichas, entram na sessão ao vivo e navegam loja, acervo e bestiário; narradores administram mesas, conteúdo publicado e progressão da crônica.

> **Escopo:** ferramenta de jogo e organização de mesa. Regras e materiais oficiais de terceiros permanecem sob licença dos respectivos titulares.

## Visão geral

| Papel | Área | Principais funções |
|-------|------|--------------------|
| Jogador | `/user/*` | Personagens, ficha por espécie, sessões com código, sala ao vivo, inventário, loja, acervo, downloads |
| Narrador | `/admin/*` | Agendar mesas, painel ao vivo, NPCs/ameaças, XP, handouts, loja/acervo/bestiário, usuários |
| Público | `/`, `/auth/*` | Home, login/cadastro, recuperação de senha |

A interface usa **React 19 + Vite + Tailwind v4**, paleta escura (carmim, ouro relicário, azul ritual) e tipografia **Noto Serif** (títulos) + **Inter** (dados e formulários). Tokens em `frontend/src/index.css`.

### Interface adaptativa

O frontend é **mobile-first** (breakpoints Tailwind `sm` / `md` / `lg` / `xl`):

- Navegação jogador/mestre: menu completo no desktop; **faixa rolável** no mobile.
- **Safe-area** (`viewport-fit=cover`) em headers, shells e portal de auth (notch / gesture bar).
- Altura de viewport com **`dvh`/`svh`**; conteúdo com `min-w-0` para não estourar largura.
- Portal `/auth/*`: scroll só na área central se a tela for baixa; login ADM em **modal** abaixo de `1024px`.

Detalhes de deploy e env vars: [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Funcionalidades

### Jogador

- Wizard de criação em **6 etapas** (linhagem → identidade → arquétipo → atributos/virtudes → habilidades → resumo)
- **Ficha** adaptada por espécie (mortal: HP + mana; vampiro: sangue + vontade; outras espécies modulares)
- **XP** com barra por nível; jogador não concede XP (apenas ADM na mesa)
- **Sessões**: entrada por código, ficha na mesa, habilidades com custo de mana, dano/morte na sessão, bônus de equipamento
- Conteúdo publicado: loja, arquivos, bestiário, downloads (handouts após publicação)

### Narrador

- **Criar mesa** com ficha da sessão (RPG, campanha, arco, missão, grupo, duração, nível recomendado) — visível no ADM e na sala do jogador
- Abrir/encerrar mesa, **excluir** mesas antigas (agendadas ou encerradas; não ao vivo)
- Centro de comando: clima da crônica, ameaças/NPCs em cena, modo descanso, concessão de XP
- Editores de entidades (equipamento, consumíveis, monstros, NPCs, grimórios, downloads)
- Métricas no dashboard (linha de sessões, personagens, atividade da mesa)

### API (`/api/v1`)

- Auth: **Supabase** (JWT) em produção; tokens `dev-*` só local/`ALLOW_DEV_AUTH` — ver [`docs/DEPLOY.md`](docs/DEPLOY.md)
- Cadastro com confirmação de e-mail no Supabase retorna **202**; o front orienta a confirmar o corvo antes do login
- Crônica: entidades, handouts, sessões agendadas, cena ao vivo, catálogos
- Catálogo e perfis em **Supabase** quando as chaves estão configuradas; parte da mesa ainda em memória na instância da API

## Tecnologias

| Camada | Stack |
|--------|--------|
| Frontend | React 19, Vite 8, TypeScript, Tailwind CSS v4, React Router 7, TanStack Query, Zustand, Zod |
| Backend | Node.js, Express, TypeScript, Zod, Vitest |
| Dados (prod.) | Supabase (Postgres, Auth, Storage) |
| E-mail (opc.) | Resend (transacional; Auth continua no Supabase) |
| Deploy típico | **A:** Vercel (SPA + `api/index.ts`) · **B:** Vercel (SPA) + Render (`infrastructure/render.yaml`) — [`docs/DEPLOY.md`](docs/DEPLOY.md) |

```text
Browser :5173  ──proxy /api──►  Express :4000  ──►  Supabase (prod.) / dev auth (local)
```

## Estrutura do repositório

```text
Vampiro a mascara/
├── package.json              # workspaces: frontend + backend
├── .env.example
├── vercel.json               # build SPA + rewrites /api e /health
├── api/index.ts              # entrada serverless Vercel
├── compose.yaml              # Docker dev (npm run docker:dev)
├── compose.prod.yaml
├── compose.test.yaml
├── infrastructure/
│   └── render.yaml           # blueprint API Docker (opção B)
├── docker/                   # Dockerfiles backend/frontend
├── supabase/migrations/      # schema oficial (CI db push)
├── docs/DEPLOY.md
├── test/                     # Vitest unificado (ver test/README.md)
├── frontend/
│   └── src/
│       ├── app/              # router, guards
│       ├── components/       # UI, admin, sessão, layout (app-shell)
│       ├── features/auth/    # portal login/cadastro
│       ├── pages/            # public, user, admin, wizard
│       ├── services/         # cliente API (VITE_API_URL)
│       └── stores/
└── backend/src/
    ├── index.ts
    ├── routes/
    └── services/             # supabaseAuth, chronicleStore, resendClient, …
```

## Início rápido

### Pré-requisitos

- **Node.js 20+** e npm
- (Produção) projeto Supabase; Vercel e/ou Render conforme [`docs/DEPLOY.md`](docs/DEPLOY.md)

### Instalação

Na raiz do monorepo:

```bash
npm install
cp .env.example .env
```

Windows (CMD): `copy .env.example .env`  
Se o PowerShell bloquear `npm`, use **`npm.cmd`**.

### Variáveis de ambiente (local)

Copie de [`.env.example`](.env.example). Mínimo para dev com Supabase:

```env
VITE_API_URL=http://localhost:4000
PORT=4000
CORS_ORIGIN=http://localhost:5173
SUPABASE_URL=https://SEU_REF.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ALLOW_DEV_AUTH=true
RUN_STANDALONE=true
```

Sem Supabase: API usa login de desenvolvimento (`ALLOW_DEV_AUTH` ou omitir chaves).

### Executar em desenvolvimento

**Um comando (API + web):**

```bash
npm run dev:all
```

**Ou dois terminais:**

| Comando | URL |
|---------|-----|
| `npm run dev:api` | http://localhost:4000 |
| `npm run dev` | http://localhost:5173 (proxy `/api` → `:4000`) |

### Auth de desenvolvimento

- **Jogador:** e-mail válido + senha com 8+ caracteres em `/auth/register` ou `/auth/login`
- **Narrador/ADM:** painel ADM (desktop inline; mobile modal) com e-mails `narrador@…`, `mestre@…` ou `admin@…`

### Scripts na raiz

| Comando | Ação |
|---------|------|
| `npm run dev` | Frontend (Vite) |
| `npm run dev:api` | Backend (tsx watch) |
| `npm run dev:all` | API + frontend juntos |
| `npm run build` | Build do frontend |
| `npm run test:ci` | Testes em `test/` |
| `npm run lint` | Lint do frontend |
| `npm run docker:dev` | `compose.yaml` |
| `npm run docker:prod` | `compose.prod.yaml` |
| `npm run docker:test` | `compose.test.yaml` |

Mais detalhes de container: [`infrastructure/README.md`](infrastructure/README.md).

## Rotas principais

| Rota | Descrição |
|------|-----------|
| `/` | Home |
| `/auth/login`, `/auth/register`, `/auth/recover` | Portal de autenticação |
| `/user` | Dashboard do jogador |
| `/user/characters`, `/user/characters/:id` | Lista e hub da ficha |
| `/user/characters/new/*` | Wizard (6 etapas) |
| `/user/sessions`, `/user/sessions/:id/table` | Agenda e sala ao vivo |
| `/user/shop`, `/user/archive`, `/user/bestiary`, `/user/downloads` | Conteúdo publicado |
| `/admin` | Dashboard do narrador |
| `/admin/sessions` | Criar/listar/excluir mesas |
| `/admin/mesa/:sessionId` | Painel da mesa ao vivo |

Redirect legado: `/app/*` → `/user/*`.

## Regras de jogo (implementadas)

### Progressão (XP e nível)

| Regra | Detalhe |
|-------|---------|
| Níveis | 1 a **20** |
| Subida | Automática quando a barra do nível atual enche |
| Fórmula | XP para sair do nível `L`: `50 × L × (L + 1) / 2` |
| Concessão | Apenas narrador (`award-xp` na mesa) |

### Ficha por espécie

| Espécie | Recursos (hub) | Foco da ficha |
|---------|----------------|---------------|
| Mortal / caçador | Vitalidade, mana, XP | Atributos, perícias, habilidades criadas, inventário |
| Vampiro / cainita | Vitalidade, sangue, vontade, XP | Linhagem, disciplinas, trilha |
| Outras espécies | Conforme perfil | Painéis modulares |

## Deploy (resumo)

Guia completo: **[`docs/DEPLOY.md`](docs/DEPLOY.md)**.

| Opção | Front | API | `VITE_API_URL` (Vercel) |
|-------|--------|-----|-------------------------|
| **A (recomendada)** | Vercel, raiz do monorepo | `api/index.ts` na mesma URL | **vazio** |
| **B** | Vercel (só SPA) | Render `beladona-api` | URL pública do Render (tipo **Config**, não Sensitive) |

Também: migrações `supabase/migrations/` (GitHub Actions), monitor (`HEALTH_URL` / `SITE_URL`), Resend opcional só nas env da API.

## Qualidade e contribuição

Antes de abrir PR:

```bash
npm run test:ci
npm run lint
npm run build
```

1. Branch a partir da linha principal.
2. Alinhe tipos entre `frontend/src/types` e contratos da API.
3. Teste em pelo menos **mobile (~375px)** e **desktop (~1280px)** nas telas que alterou.

Testes: [`test/README.md`](test/README.md). Frontend: [`frontend/README.md`](frontend/README.md).

## Licença e contato

Projeto de crônica / VTT — uso conforme combinado com a mesa Beladona. Materiais de terceiros permanecem com seus titulares.

Para suporte técnico, abra uma issue com erro do terminal, URL afetada e sistema operacional.
