# As Crônicas de Beladona — Sanguis & Shadow

Monorepo de **mesa virtual (VTT)** para a campanha **Beladona**, em tom feudal-sombrio inspirado em crônicas vampíricas. Jogadores criam fichas, entram na sessão ao vivo e navegam loja, acervo e bestiário; narradores administram mesas, conteúdo publicado e progressão da crônica.

> **Escopo:** ferramenta de jogo e organização de mesa. Regras e materiais oficiais de terceiros permanecem sob licença dos respectivos titulares.

## Visão geral

| Papel | Área | Principais funções |
|-------|------|--------------------|
| Jogador | `/user/*` | Personagens, ficha por espécie, sessões com código, sala ao vivo, inventário, loja, acervo, downloads |
| Narrador | `/admin/*` | Agendar mesas, painel ao vivo, NPCs/ameaças, XP, handouts, loja/acervo/bestiário, usuários |
| Público | `/`, `/auth/*` | Home, login/cadastro, recuperação de senha |

A interface usa **React 19 + Vite + Tailwind v4**, paleta escura (carmim, ouro relicário, azul ritual) e tipografia **Noto Serif** (títulos) + **Inter** (dados e formulários). Tokens vivem no CSS do frontend (`frontend/src`).

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
- Crônica: entidades, handouts, sessões agendadas, cena ao vivo, catálogos
- Em **dev**, persistência em memória; em **produção**, planejado Supabase (PostgreSQL, Auth, Storage)

## Tecnologias

| Camada | Stack |
|--------|--------|
| Frontend | React 19, Vite 8, TypeScript, Tailwind CSS v4, React Router 7, TanStack Query, Zustand, Zod |
| Backend | Node.js, Express, TypeScript, Zod, Vitest |
| Dados (prod.) | Supabase |
| E-mail (opc.) | Resend |
| Deploy típico | Vercel (SPA + API serverless em `api/index.ts`) **ou** Vercel (SPA) + Render/Docker (API) — [`docs/DEPLOY.md`](docs/DEPLOY.md) |

```text
Browser :5173  ──proxy /api──►  Express :4000  ──►  memória (dev) / Supabase (prod.)
```

## Estrutura do repositório

```text
Vampiro a mascara/
├── package.json          # workspaces: frontend + backend
├── .env.example
├── vercel.json
├── docker-compose.yml
├── compose.test.yaml
├── frontend/
│   ├── src/
│   │   ├── app/          # router, guards
│   │   ├── components/   # UI, admin, sessão, personagens
│   │   ├── pages/        # public, user, admin, wizard
│   │   ├── services/     # cliente API
│   │   ├── stores/       # auth, wizard
│   │   └── lib/          # regras de ficha, mesa, equipamento
│   └── public/           # logo, assets
└── backend/
    └── src/
        ├── index.ts
        ├── routes/       # auth, me, content, admin/chronicle, catalog, …
        ├── services/     # profileStore, chronicleStore, auth dev
        └── tests/
```

## Início rápido

### Pré-requisitos

- **Node.js 20+** e npm
- (Produção) contas Supabase, Resend e hospedagem conforme deploy

### Instalação

Na raiz do monorepo:

```bash
npm install
cp .env.example .env
```

Windows (CMD): `copy .env.example .env`  
Se o PowerShell bloquear `npm`, use **`npm.cmd`** nos comandos abaixo.

### Variáveis de ambiente

```env
VITE_API_URL=http://localhost:4000
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

PORT=4000
CORS_ORIGIN=http://localhost:5173
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
```

Sem Supabase, a API usa stores em memória e login de desenvolvimento.

### Executar em desenvolvimento

**Terminal 1 — API**

```bash
npm run dev:api
```

| URL | Uso |
|-----|-----|
| http://localhost:4000 | API |
| http://localhost:4000/api/v1/… | Endpoints versionados |

**Terminal 2 — Frontend**

```bash
npm run dev
```

| URL | Uso |
|-----|-----|
| http://localhost:5173 | SPA (Vite faz proxy de `/api` → `:4000`) |

### Auth de desenvolvimento

- **Jogador:** e-mail válido + senha com 8+ caracteres em `/auth/login` ou `/auth/register`
- **Narrador/ADM:** login pelo painel ADM com e-mails `narrador@…`, `mestre@…` ou `admin@…`

### Scripts na raiz

| Comando | Ação |
|---------|------|
| `npm run dev` | Frontend (Vite) |
| `npm run dev:api` | Backend (tsx watch) |
| `npm run build` | Build do frontend |
| `npm run test:ci` | Testes em `test/` (API + unidade) |
| `npm run lint` | Lint do frontend |
| `npm run docker:dev` | API + web em modo desenvolvimento (Docker) |
| `npm run docker:prod` | API + nginx com build de produção |
| `npm run docker:test` | Suíte de testes em container |

### Docker

```bash
docker compose up --build
```

Testes em container:

```bash
docker compose -f compose.test.yaml up --build --abort-on-container-exit --exit-code-from tests
docker compose -f compose.test.yaml down -v
```

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
| Exemplos | 1→2: 50 XP · 2→3: 150 XP · 3→4: 300 XP |
| XP inicial | Personagem novo começa em **0** na barra do nível 1 |
| Concessão | Apenas narrador (`award-xp` na mesa) |

### Ficha por espécie

| Espécie | Recursos (hub) | Foco da ficha |
|---------|----------------|---------------|
| Mortal / caçador | Vitalidade, mana, XP | Atributos, perícias feudais, habilidades criadas, inventário |
| Vampiro / cainita | Vitalidade, sangue, vontade, XP | Linhagem, disciplinas, trilha |
| Outras espécies | Conforme perfil | Painéis modulares |

**Habilidades (níveis 1–3):** limites de talentos/perícias/conhecimentos; evolução de talentos até 4 pontos; custo de mana em habilidades criadas na sessão.  
**Vitalidade/mana** podem ser rolados na criação (`vitals.locked`); bônus por equipamento soma em barras e CA.

## Deploy (resumo)

Guia completo passo a passo: **[`docs/DEPLOY.md`](docs/DEPLOY.md)** (Supabase, Vercel **raiz do monorepo**, GitHub Actions, keepalive, monitor, Resend, troubleshooting).

1. **Site + API (recomendado):** Vercel na **raiz** do repo (`vercel.json` + `api/`); `VITE_API_URL` vazio na produção.
2. **API alternativa (só hospedagem):** [Render](https://render.com) — `infrastructure/render.yaml`; não é para e-mail nem front.
3. **Banco / login:** Supabase (`supabase/migrations/` + workflow **Supabase migrate**).
4. **E-mail da app (opcional):** [Resend](https://resend.com) — `RESEND_*` nas env vars da API (Vercel ou Render); confirmação de conta continua no Supabase Auth.
5. **CI/CD:** `.github/workflows/ci.yml` e `cd.yml`; deploy contínuo na Vercel.
6. Não commitar `.env`.

## Qualidade e contribuição

Antes de abrir PR:

```bash
npm run test:ci
npm run lint
npm run build
```

1. Branch a partir da linha principal.
2. Mantenha tipos alinhados entre `frontend/src/types` e contratos da API.
3. Descreva comportamento e plano de teste no PR.

## Licença e contato

Projeto de crônica / VTT — uso conforme combinado com a mesa Beladona. Materiais de ambientação e regras de terceiros permanecem com seus titulares.

Para suporte técnico, abra uma issue com erro do terminal, URL afetada e sistema operacional.
