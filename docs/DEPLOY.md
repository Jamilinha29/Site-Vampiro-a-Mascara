# Deploy, chaves e DevSecOps — Beladona VTT

Guia **passo a passo**: o que fazer, **onde** clicar e em que ordem. Nenhum segredo vai para o Git — só em `.env` local, Vercel/Render e **GitHub Secrets**.

## Função de cada serviço (não misturar)

Cada provedor resolve **um papel**. Não use Render para e-mail nem Resend para hospedar API.

| Serviço | Função neste projeto | Não é para |
|---------|----------------------|------------|
| **Supabase** | PostgreSQL, login JWT (Auth), arquivos (Storage), migrações SQL | Hospedar o site Vite nem o processo Node long-running |
| **Vercel** | SPA (`frontend/dist`) + **API** serverless (`api/index.ts`) na mesma URL (recomendado) | Banco de dados |
| **Render** | **Só** API Node em container, 24/7 opcional, quando você **não** quer API na Vercel (Docker + `PORT` + `/health`) | Front, e-mail, Postgres |
| **Resend** | **Só** envio de **e-mail transacional** pela API (`RESEND_API_KEY` / `RESEND_FROM` → `resendClient.ts`) — ex.: inscrições com PDF, avisos da mesa (rotas que chamarem o cliente) | Login/senha (isso é Supabase Auth), hospedagem, banco |

**E-mail em duas camadas:**

1. **Supabase Auth** — confirmação de cadastro, reset de senha (se ligados no painel **Authentication**). Não usa Resend.
2. **Resend** — mensagens **da aplicação Beladona** enviadas pelo backend. Sem `RESEND_API_KEY`, essas rotas não enviam correio (hoje `registrations` ainda responde 501 até o fluxo completo).

**Hospedagem da API em duas opções (escolha uma):**

| Opção | Onde roda a API | Variável no front |
|-------|-----------------|-------------------|
| **A (recomendada)** | Vercel serverless | `VITE_API_URL` **vazio** |
| **B (opcional)** | Render (`infrastructure/render.yaml`) | `VITE_API_URL=https://sua-api.onrender.com` |

Render e Vercel **não** substituem Resend: configure Resend nas **env vars da API** (Vercel **ou** Render, onde a API estiver).

## Onde roda cada peça (como está no código)

Esta tabela descreve **o que o repositório faz de fato** em cada ambiente — use para saber onde colocar `SUPABASE_*`, `RESEND_*` e `VITE_API_URL`.

| Ambiente | Front (SPA) | API (Express) | Como a API sobe | Onde ficam as env da API |
|----------|-------------|---------------|-----------------|---------------------------|
| **Local** `npm run dev` + `npm run dev:api` | `localhost:5173` (Vite) | `localhost:4000` | `backend/src/index.ts` faz `app.listen` (`RUN_STANDALONE` implícito) | `.env` na **raiz** do repo |
| **Local** `npm run dev:all` | Idem | Idem | Idem | `.env` na raiz |
| **Docker dev** `npm run docker:dev` | `localhost:5173` | `localhost:4000` | Container `api` → `npm run dev -w backend` (`compose.yaml`) | `compose.yaml` (mínimo); estenda com `.env` se precisar Supabase |
| **Docker prod** `npm run docker:prod` | `localhost:8080` (nginx) | `localhost:4000` | Container `api` → `node dist/index.js` (`Dockerfile.backend.prod`) | `compose.prod.yaml` → `env_file: .env` |
| **Produção A** Vercel (raiz do repo) | `https://seu-dominio/` (arquivos em `frontend/dist`) | **Mesmo domínio**, serverless | `api/index.ts` + `serverless-http`; **não** abre porta (`VERCEL` → sem `listen` em `backend/src/index.ts`) | Vercel → **Environment Variables** (servem build **e** função `api/`) |
| **Produção B** Render | Continua na **Vercel** (só estático) | `https://beladona-api.onrender.com` | Imagem Docker `docker/Dockerfile.backend.prod` → `RUN_STANDALONE=true`, porta `4000`, `/health` | Render → **Environment** do serviço `beladona-api` |
| **Testes** `npm run test:ci` | Vitest (jsdom) | App em memória | `NODE_ENV=test` → não escuta rede; Supertest chama `app` direto | Não precisa `.env` para passar CI |

### URLs que o front chama

O cliente HTTP está em `frontend/src/services/api.ts`:

```ts
const API_BASE = import.meta.env.VITE_API_URL ?? ''
// fetch(`${API_BASE}/api/v1/...`)
```

| Cenário | `VITE_API_URL` | Exemplo de chamada |
|---------|----------------|--------------------|
| Vercel (API junto) | **vazio** no build | `GET /api/v1/catalog/clans` no mesmo host |
| Render (API separada) | URL do Render no build Vercel | `GET https://xxx.onrender.com/api/v1/catalog/clans` |
| Local com proxy Vite | vazio **ou** omitir no `.env` | `GET /api/v1/...` → proxy em `frontend/vite.config.ts` aponta para `:4000` |
| Local direto | `http://localhost:4000` no `.env` | Browser fala direto na API (sem passar pelo proxy) |
| Docker prod | build com `http://localhost:4000` (`compose.prod.yaml`) | Browser na sua máquina: front `:8080`, API `:4000` (**nginx não faz proxy de `/api`** — ver `docker/nginx.conf`) |

### Rotas da API (sempre no Express `backend/src/index.ts`)

| Caminho | Uso |
|---------|-----|
| `GET /health` | Monitoramento (Vercel rewrite → mesma função `api/`) |
| `POST /api/v1/auth/login` | Supabase Auth ou dev (`ALLOW_DEV_AUTH`) |
| `/api/v1/catalog`, `/me`, `/admin/*`, `/content`, `/sessions`, `/wallets`, … | Restante da VTT |

Na Vercel, `vercel.json` encaminha `/health` e `/api/*` para `api/index.ts`; o SPA cai no `index.html`.

### Quem liga em `Supabase` vs `Resend`

| Integração | Código | Precisa estar onde a **API** roda |
|------------|--------|-----------------------------------|
| Postgres, Storage, service role | `backend/src/services/supabaseClient.ts` | Vercel function **ou** Render **ou** `.env` local/Docker |
| Login JWT | `backend/src/services/supabaseAuth.ts` (`SUPABASE_ANON_KEY`) | Idem |
| E-mail transacional | `backend/src/services/resendClient.ts` | Idem (`RESEND_API_KEY`); **não** no Supabase |

### Decisão rápida: “minha API está onde?”

```
Deploy na Vercel com Root = raiz do monorepo?
  ├─ SIM → API na Vercel (api/index.ts), HEALTH_URL = https://dominio/health
  └─ NÃO (só frontend/) → só site; API precisa Render/Docker/local :4000

Usou Render blueprint render.yaml?
  └─ API só no Render; VITE_API_URL na Vercel = URL do Render
```

**GitHub Actions** (`ci.yml`, `cd.yml`) **não publicam** a API na internet — só testam/buildam. O deploy “vivo” é **Vercel** (conexão Git) e/ou **Render** (blueprint manual).

## Mapa rápido (onde fazer cada coisa)

| Tarefa | Onde |
|--------|------|
| Criar banco, Auth, Storage | [Supabase Dashboard](https://supabase.com/dashboard) |
| Env da API + build do front (opção A) | [Vercel](https://vercel.com) → projeto → **Settings** → **Environment Variables** |
| Env **só** da API (opção B) | [Render](https://dashboard.render.com) → serviço `beladona-api` → **Environment** |
| Front em produção (opção B) | Ainda **Vercel** — só variáveis `VITE_*`; API não roda na Vercel |
| Segredos para GitHub Actions | GitHub → repositório → **Settings** → **Secrets and variables** → **Actions** → **New repository secret** |
| Migrações automáticas (CI) | Workflow `.github/workflows/supabase-migrate.yml` (dispara no push ao `main`) |
| Keepalive Supabase free | Workflow `.github/workflows/supabase-keepalive.yml` + secrets no GitHub |
| Monitor site/API | Workflow `.github/workflows/monitor.yml` + secrets no GitHub |
| E-mail transacional (opcional) | [Resend](https://resend.com) → API Key → Vercel/Render `RESEND_*` |
| CI (testes no push/PR) | GitHub → **Actions** → workflow **CI** (sem secrets) |
| Desenvolvimento local | Pasta do projeto → arquivo `.env` (copiar de `.env.example`) |
| Docker local (opcional) | Terminal → `npm run docker:dev` / `docker:prod` |

---

## 1) Supabase — criar projeto e pegar chaves

**Onde:** navegador → [supabase.com/dashboard](https://supabase.com/dashboard)

1. **New project** → escolha organização, nome (ex.: `beladona`), região, **senha do banco** (anote em gerenciador de senhas — vira `SUPABASE_DB_PASSWORD` no GitHub).
2. Aguarde o projeto ficar **Active** (verde).
3. Menu lateral **Project Settings** (ícone engrenagem) → **General**:
   - Copie **Reference ID** → será `SUPABASE_PROJECT_REF` no GitHub.
4. **Project Settings** → **API**:
   - **Project URL** → `SUPABASE_URL` (ex.: `https://abcdefgh.supabase.co`).
   - **anon / publishable** key → `SUPABASE_ANON_KEY` (frontend + login + keepalive).
   - **service_role / secret** key → `SUPABASE_SERVICE_ROLE_KEY` (**só servidor**, nunca no Vite/browser).
5. **Authentication** → **Providers** → **Email**:
   - Deixe habilitado para login por e-mail/senha.
   - Se quiser login imediato sem confirmar e-mail em dev: desative **Confirm email** (em produção costuma deixar ligado).
6. **Authentication** → **Users** → use depois para criar admins ou editar **User Metadata** (`role`: `admin` | `narrator` | `player`).

### 1.1) URLs de Auth (obrigatório em produção)

O login passa pela **API** (`/api/v1/auth/*`), não pelo SDK Supabase no browser — mas o Supabase ainda exige URLs válidas para confirmação de e-mail e links mágicos.

**Onde:** Supabase → **Authentication** → **URL Configuration**

| Campo | O que colocar |
|-------|----------------|
| **Site URL** | URL principal da SPA, ex.: `https://seu-projeto.vercel.app` |
| **Redirect URLs** | Mesma URL + `http://localhost:5173` se testar local contra o projeto remoto |

1. Salve.
2. Se **Confirm email** estiver ligado, após cadastro o usuário precisa clicar no link do e-mail antes do login retornar sessão (API responde `202` com mensagem de confirmação pendente).

### 1.2) Storage (buckets)

As migrações em `supabase/migrations/` criam políticas; a API também chama `ensureMediaBuckets()` na subida.

**Onde:** Supabase → **Storage**

Após migrações, confira se existem (ou foram criados automaticamente):

| Bucket | Uso |
|--------|-----|
| `perfil` | Fotos de jogador/narrador |
| `loja-glossario` | Imagens de loja e glossário (pastas `loja/`, `glossario/`) |

Se o catálogo salva mas a imagem falha: verifique **service role** na API e permissões do bucket no painel.

### 1.3) `.env` local (só no seu PC)

**Onde:** raiz do repositório `Vampiro a mascara` → arquivo `.env` (não commitar)

1. Copie `.env.example` para `.env`.
2. Preencha pelo menos:

```env
PORT=4000
CORS_ORIGIN=http://localhost:5173
VITE_API_URL=http://localhost:4000

SUPABASE_URL=https://SEU_REF.supabase.co
SUPABASE_ANON_KEY=eyJ...anon...
SUPABASE_SERVICE_ROLE_KEY=eyJ...service_role...

ALLOW_DEV_AUTH=true
RUN_STANDALONE=true
```

3. Suba API e front:

```powershell
cd "c:\My\Mili\Vampiro a mascara"
npm install
npm run dev:all
```

4. Teste: http://localhost:5173 e http://localhost:4000/health

**Nota:** `VITE_SUPABASE_*` no `.env.example` é **opcional** hoje — o front fala só com a API. Se no futuro o SPA usar Supabase direto, aí sim preencha e recompile o front.

---

## 2) Migrações — aplicar schema no Supabase

Fonte oficial de schema: **`supabase/migrations/`** — aplicada com `supabase db push` e pelo workflow **Supabase migrate** no push ao `main`.

### 2.A) Manual no painel (primeira vez ou emergência)

**Onde:** Supabase → **SQL Editor** → **New query**

1. Abra os arquivos em `supabase/migrations/` **na ordem do prefixo de data** (do mais antigo ao mais novo).
2. Cole cada arquivo → **Run**.
3. Confira **Table Editor** se as tabelas (`chronicle_entities`, `reference_catalog`, etc.) existem.

### 2.B) Automático pelo GitHub (repo → banco)

**Onde:** GitHub + token Supabase

#### Passo 1 — Token de acesso pessoal Supabase

1. [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) (menu avatar → **Account** → **Access Tokens**).
2. **Generate new token** → nome ex.: `github-beladona-migrate` → copie o token (só aparece uma vez).

#### Passo 2 — Secrets no repositório GitHub

**Onde:** `https://github.com/SEU_USUARIO/SEU_REPO` → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Crie **um secret por linha**:

| Nome do secret | Valor (de onde vem) |
|----------------|---------------------|
| `SUPABASE_ACCESS_TOKEN` | Token do passo 1 |
| `SUPABASE_PROJECT_REF` | Dashboard → Project Settings → General → Reference ID |
| `SUPABASE_DB_PASSWORD` | Senha que você definiu ao criar o projeto |
| `SUPABASE_URL` | Project URL (mesmo do `.env`) |
| `SUPABASE_ANON_KEY` | Anon key (mesmo do `.env`) |

#### Passo 3 — Habilitar GitHub Actions

**Onde:** GitHub → repositório → aba **Actions**

1. Se pedir, clique **I understand my workflows, go ahead and enable them**.
2. Confirme que o arquivo `.github/workflows/supabase-migrate.yml` está no branch que você usa (ex.: `main`).

#### Passo 4 — Disparar migração

**Opção A — automático:** faça merge/push para `main` alterando algo em `supabase/migrations/**`.

**Opção B — manual:** **Actions** → workflow **Supabase migrate** → **Run workflow** → branch `main` → **Run workflow**.

#### Passo 5 — Verificar

**Onde:** GitHub → **Actions** → clique na execução → job **db-push** deve ficar verde.

**Onde (banco):** Supabase → **Database** → **Migrations** ou **Table Editor**.

#### Banco → repo (inverso, quando você mudou algo no painel)

**Onde:** terminal no PC (com Node/npx)

```powershell
cd "c:\My\Mili\Vampiro a mascara"
npx supabase login
npx supabase link --project-ref SEU_REFERENCE_ID
npx supabase db pull
```

Revise o SQL novo em `supabase/migrations/`, commite e volte ao fluxo **db push** no CI.

---

## 3) Vercel — site + API (recomendado)

**Onde:** [vercel.com/dashboard](https://vercel.com/dashboard)

### 3.1) Conectar o repositório

1. **Add New…** → **Project** → importe o repo do GitHub.
2. **Root Directory:** deixe a **raiz do monorepo** (onde estão `vercel.json`, `api/` e `frontend/`).

   > **Armadilha:** se você apontar Root só para `frontend/`, a Vercel **não** enxerga `vercel.json` nem `api/` na raiz. Resultado: site sobe, **API e `/health` não existem**. Para API serverless, a raiz **precisa** ser o monorepo.

3. Framework deve detectar **Vite**; confira:
   - Build: `npm run build`
   - Output: `frontend/dist`
4. **Deploy** (primeira vez pode falhar login até você colocar env vars — normal).

### 3.2) Variáveis de ambiente

**Onde:** Vercel → projeto → **Settings** → **Environment Variables**

Adicione para **Production** (e **Preview** se quiser branch de teste):

| Nome | Valor | Observação |
|------|--------|------------|
| `SUPABASE_URL` | URL do projeto | Igual ao `.env` |
| `SUPABASE_ANON_KEY` | Anon key | Login JWT |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role | Só backend serverless |
| `CORS_ORIGIN` | `https://seu-projeto.vercel.app` ou domínio custom | Sem barra no final |
| `ALLOW_DEV_AUTH` | `false` | Produção |
| `VITE_API_URL` | *(deixe vazio)* | API na mesma origem (`/api/v1/...`) |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | opcional | Só se o front passar a usar Supabase direto |
| `RESEND_API_KEY` | opcional | E-mail |
| `RESEND_FROM` | opcional | Ex.: `Beladona <onboarding@resend.dev>` |

Marque **Sensitive** nas chaves secretas.

### 3.3) Redeploy

**Onde:** Vercel → **Deployments** → nos três pontos do último deploy → **Redeploy** (para rebuild com as variáveis).

### 3.4) Testar produção

**Onde:** navegador

1. `https://SEU_DOMINIO/health` → JSON com `"ok": true`.
2. `https://SEU_DOMINIO/` → SPA abre.
3. `/auth/login` com usuário criado no Supabase Auth.

### 3.5) Domínio custom (opcional)

**Onde:** Vercel → **Settings** → **Domains** → adicione domínio → configure DNS no registrador (CNAME que a Vercel indicar).

Atualize também:

- Vercel `CORS_ORIGIN` com o domínio novo.
- Supabase **Site URL** e **Redirect URLs** (seção 1.1).

### 3.6) Preview (branch/PR)

**Onde:** Vercel → **Settings** → **Environment Variables**

Replique as mesmas variáveis em **Preview** se quiser testar PR com login real e banco remoto (cuidado: mesmo Supabase de produção).

---

## 4) Render — somente API Node (opcional)

**Função:** manter o **Express** ligado em um **Web Service** Docker (blueprint `infrastructure/render.yaml`). Não publica o site, não envia e-mail, não guarda dados.

Use **apenas** se escolheu a **opção B** da tabela acima (API fora da Vercel). Se a API já está em `api/index.ts` na Vercel, **não precisa** de conta Render.

**Onde:** [dashboard.render.com](https://dashboard.render.com)

1. **Blueprints** → **New Blueprint Instance** → conecte o repo → selecione `infrastructure/render.yaml`.
2. Ou **New** → **Web Service** → Docker → aponte para `docker/Dockerfile.backend.prod`.
3. **Environment** → adicione as mesmas vars da API (`SUPABASE_*`, `CORS_ORIGIN`, `RUN_STANDALONE=true`, `ALLOW_DEV_AUTH=false`, `RESEND_*`).
4. Copie a URL pública (ex.: `https://beladona-api.onrender.com`).

**Onde (Vercel):** defina `VITE_API_URL=https://beladona-api.onrender.com` e redeploy do front.

**Onde (Render):** `CORS_ORIGIN=https://seu-site.vercel.app`

---

## 5) Keepalive Supabase (plano free — evitar pausa)

Projetos **free** do Supabase podem **pausar** após período sem uso (~7 dias sem atividade no projeto). O repositório já inclui o workflow **Supabase keepalive**, que faz um **ping leve** na API REST a cada **3 dias** (meio-dia UTC).

**Arquivo:** `.github/workflows/supabase-keepalive.yml`  
**Cron:** `0 12 */3 * *` (dia 1, 4, 7… às 12:00 UTC)

### 5.1) O que você precisa configurar (só GitHub)

**Onde:** GitHub → repositório → **Settings** → **Secrets and variables** → **Actions**

| Secret | Valor |
|--------|--------|
| `SUPABASE_URL` | `https://xxxx.supabase.co` (Project URL) |
| `SUPABASE_ANON_KEY` | Chave **anon** (não use service role aqui) |

> Se você já criou esses secrets na seção **2.B**, o keepalive **já pode funcionar** — não precisa duplicar.

**Segurança:** a anon key já é pública no frontend; no keepalive ela só roda no runner do GitHub, não aparece nos logs se você não der `echo` na key.

### 5.2) Ativar e testar manualmente

**Onde:** GitHub → **Actions**

1. Na lista à esquerda, clique **Supabase keepalive**.
2. **Run workflow** → escolha branch `main` → **Run workflow**.
3. Abra a execução → step **REST ping (anon key)**:
   - Verde = ping aceito (códigos HTTP 200, 401 ou 404 são considerados OK — significa que o projeto respondeu e **não está pausado**).
   - Amarelo com mensagem “Defina SUPABASE_URL…” = faltam secrets.

### 5.3) Confirmar no Supabase

**Onde:** Supabase Dashboard → seu projeto

- Status do projeto deve continuar **Active** (não **Paused**).
- **Logs** → **API** pode mostrar requisições ocasionais ao REST.

### 5.4) Keepalive manual sem GitHub (alternativa)

Se não quiser Actions, use um agendador externo (cron no PC, UptimeRobot, etc.) **a cada 2–3 dias**:

```http
GET https://SEU_REF.supabase.co/rest/v1/
apikey: SUA_ANON_KEY
Authorization: Bearer SUA_ANON_KEY
```

**Onde configurar UptimeRobot:** [uptimerobot.com](https://uptimerobot.com) → **Monitor** → HTTP(s) → intervalo 1 dia → URL acima com header custom (plano free permite poucos monitores).

### 5.5) Quando o keepalive não basta

- Campanha 24/7 crítica → considere **Supabase Pro** (projeto não pausa por inatividade).
- Se o projeto **já pausou:** Dashboard → **Restore project** (pode levar alguns minutos).

---

## 6) Monitor — site e API no ar

Workflow: `.github/workflows/monitor.yml` (a cada **5 minutos**).

### 6.1) Secrets

**Onde:** GitHub → **Settings** → **Secrets and variables** → **Actions**

| Secret | Exemplo de valor |
|--------|-------------------|
| `HEALTH_URL` | `https://seu-app.vercel.app/health` |
| `SITE_URL` | `https://seu-app.vercel.app/` |

Se a API estiver só no Render: `HEALTH_URL=https://beladona-api.onrender.com/health` e `SITE_URL` continua sendo a Vercel.

### 6.2) Testar

**Onde:** GitHub → **Actions** → **Monitor** → **Run workflow**.

- Falha vermelha em **API health** → site fora ou JSON sem `"ok":true`.
- “não configurado — passo ignorado” → secret vazio (workflow não falha de propósito).

### 6.3) Efeito colateral útil (Render free)

Ping a cada 5 min mantém a API Render **acordada** com mais frequência (mas consome minutos free). Na Vercel serverless isso só valida disponibilidade.

---

## 7) Login jogador vs narrador/admin (produção)

### 7.1) Cadastro e login normais

**Onde:** app → `/auth/register` e `/auth/login`  
**Onde (backend):** Vercel env com `SUPABASE_ANON_KEY` + `ALLOW_DEV_AUTH=false`

Fluxo: browser → `POST /api/v1/auth/login` → Supabase Auth → JWT no `Authorization: Bearer ...`.

### 7.2) Dar papel de narrador ou admin

**Onde:** Supabase → **Authentication** → **Users** → clique no usuário → **Raw User Meta Data** (ou editar via SQL/API)

Exemplo JSON:

```json
{
  "display_name": "Mestre",
  "role": "narrator"
}
```

Valores aceitos pela API: `admin`, `narrator`, `player`.

**Alternativa temporária (dev):** e-mails `narrador@...`, `mestre@...`, `admin@...` com `ALLOW_DEV_AUTH=true` local — **não use em produção**.

### 7.2.1) Contas ADM e de teste da mesa (Beladona)

**Nunca** coloque senhas no Git, no `DEPLOY.md` nem no `.env` commitado. Use um gerenciador de senhas.

| Conta | E-mail (login) | Papel | Uso |
|-------|----------------|-------|-----|
| **ADM produção** | `Adm@gmail.com` | `admin` | Conclave / rotas `/admin` no dia a dia |
| **Teste sistema** | `testeuserAdm@gmail.com` | `admin` (recomendado) | Reproduzir bug/erro em **jogador e mesa** com uma só conta (`/user` e `/admin`) |

**Onde criar (produção / staging com Supabase Auth):**

1. Supabase → **Authentication** → **Users** → **Add user** → **Create new user**.
2. E-mail: um da tabela acima → senha: a que você definiu (mín. 8 caracteres no app).
3. No mesmo usuário, em **Raw User Meta Data**, inclua:

```json
{
  "display_name": "Mestre Beladona",
  "role": "admin"
}
```

4. Para a conta de **teste**, use também `"role": "admin"` para validar painel ADM; o fluxo de **jogador** continua em `/user` com a mesma sessão.
5. Na app: `/auth/login` (jogador) ou entrada ADM — a API lê o `role` do JWT/metadata (`backend/src/services/supabaseAuth.ts`).

**Local sem Supabase** (`ALLOW_DEV_AUTH=true`, sem `SUPABASE_ANON_KEY`): o login **não valida senha**; o papel vem de `devRoleForEmail` — `Adm@…` e `testeuserAdm@…` já tratados como `admin` em `backend/src/services/devAuth.ts`.

**Segurança:** se estas senhas foram expostas em chat ou issue, **troque-as** no Supabase (**Users** → reset password) e não as reutilize em outros serviços.

### 7.3) O que vai ao Supabase vs API Node

| Recurso | Supabase | API |
|---------|----------|-----|
| E-mail/senha, JWT | Auth | Rotas `/api/v1/auth/*` |
| Tabelas de catálogo, crônica, subclasses | Postgres | Regras e imports |
| Storage (imagens) | Buckets | Upload pela API |
| Estado de mesa / personagens em memória | — | API (hoje) |

---

## 8) Resend — somente e-mail transacional (opcional)

**Função:** provedor SMTP/API para o **backend** enviar mensagens (inscrições, avisos, PDFs — conforme as rotas forem ligadas ao `resendClient.ts`). **Não** hospeda site nem API. **Não** substitui o e-mail de confirmação do **Supabase Auth** (esse continua no painel Supabase).

Sem `RESEND_API_KEY`, a API simplesmente não envia esses e-mails (não quebra login nem catálogo).

**Onde configurar a chave:** onde a **API** roda — **Vercel** (env do projeto) **ou** **Render** (env do Web Service) — **não** no Supabase.

**Onde:** [resend.com](https://resend.com) → conta → **API Keys** → **Create API Key**

1. Copie a chave → `RESEND_API_KEY` na Vercel **ou** no Render (Sensitive), junto com `SUPABASE_*` da mesma API.
2. **Domains** → verifique um domínio **ou** use o sandbox `onboarding@resend.dev` só para testes (limite de destinatários).
3. Defina `RESEND_FROM=Beladona <seu@dominio.com>` igual ao domínio verificado.

---

## 9) CI/CD no GitHub (o que roda sozinho)

**Onde:** GitHub → repositório → **Actions**

| Workflow | Quando | Secrets? | O que faz |
|----------|--------|----------|-----------|
| **CI** (`ci.yml`) | Push/PR em `main` | Não | `npm ci`, lint, build, `test:ci`, audit (não bloqueia), Docker test |
| **CD** (`cd.yml`) | Push em `main` | Não | Build front + valida `Dockerfile.backend.prod` |
| **Supabase migrate** | Push em migrações | Sim (seção 2.B) | `db push` |
| **Supabase keepalive** | Cron 3 dias | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Anti-pausa |
| **Monitor** | Cron 5 min | `HEALTH_URL`, `SITE_URL` opcionais | Disponibilidade |

**Vercel:** deploy do site/API ao conectar o repo (não passa pelo `cd.yml`).

Antes do primeiro deploy, rode localmente o mesmo que o CI:

```powershell
npm run test:ci
npm run lint
npm run build
```

---

## 10) Docker local / produção (opcional)

Não substitui Vercel+Supabase em produção; serve para subir tudo na máquina.

**Onde:** terminal na raiz do repo (Docker Desktop instalado)

```powershell
npm run docker:dev    # desenvolvimento
npm run docker:prod   # build de produção com nginx
npm run docker:test   # mesmo teste que o job CI docker-test
```

Variáveis vêm do `.env` na raiz ou do `compose` — mesmas chaves `SUPABASE_*` e `CORS_ORIGIN`.

---

## 11) Problemas comuns (deploy)

| Sintoma | Causa provável | Onde corrigir |
|---------|----------------|---------------|
| Site abre, `/health` 404 | Root Directory = `frontend/` | Vercel → Settings → General → Root = **repo raiz** |
| Catálogo/loja vazio no ar, local OK | `SUPABASE_SERVICE_ROLE_KEY` errada (ex.: `sb_publishable_`) | Vercel/Render env; use **secret** no painel Supabase |
| Login `ECONNREFUSED` local | API não subiu | `npm run dev:api` ou porta 4000 livre |
| Login 401 em produção com senha certa | `ALLOW_DEV_AUTH=true` ou falta `SUPABASE_ANON_KEY` | Vercel env |
| Cadastro “confirme o e-mail” | Confirm email ligado | Supabase Auth ou desligar confirmação em dev |
| CORS no browser | `CORS_ORIGIN` não inclui URL do site | Vercel env (URL exata, com `https`) |
| Migração CI falha | Secrets errados ou senha DB | GitHub Secrets + `supabase link` manual |
| Personagens somem após restart API | Estado ainda em memória na API | Esperado hoje — ver seção 12 |
| Render API lenta no 1º acesso | Plano free dorme | Monitor/keepalive ou Vercel serverless |

---

## 12) Limitações atuais (não esquecer no deploy)

- **JWT:** o front guarda o `accessToken` no `localStorage` (`beladona-auth`); não há refresh automático — sessão expira conforme Supabase (religar conta).
- **Mesa / personagens / sessões:** grande parte ainda é **memória** na instância da API; restart (deploy, cold start) pode zerar estado até persistir tudo no Postgres.
- **Dev auth:** tokens `dev-*` só com `ALLOW_DEV_AUTH=true` ou sem chaves Supabase — **proibido em produção**.
---

## 13) Checklist final (ordem sugerida)

1. **Supabase:** projeto + chaves + URLs Auth (1.1) + migrações (SQL ou CI).
2. **Storage:** buckets `perfil` e `loja-glossario` (1.2).
3. **GitHub Secrets:** migrate + keepalive + (opcional) monitor.
4. **Vercel:** raiz do repo + env vars + redeploy.
5. **Testes:** `/health`, login, catálogo `/api/v1/catalog/clans`.
6. **Actions:** **Supabase keepalive** e **Monitor** manual uma vez; confira **CI** verde no `main`.
7. **Resend** (se e-mail): chave + domínio.
8. **Render:** só se API fora da Vercel.

---

## Referência — arquivos no repositório

| Arquivo | Função |
|---------|--------|
| `backend/src/index.ts` | App Express, rotas `/api/v1/*`, `/health`; `listen` só em standalone |
| `api/index.ts` | Entrada **Vercel** (`serverless-http` + `ready`) |
| `vercel.json` | Build SPA + rewrites `/api` e `/health` → `api/` |
| `frontend/src/services/api.ts` | `VITE_API_URL` + chamadas `/api/v1/...` |
| `frontend/vite.config.ts` | Proxy `/api` → `:4000` só em **dev** |
| `infrastructure/render.yaml` | Blueprint API Docker (`RUN_STANDALONE=true`) |
| `docker/Dockerfile.backend.prod` | API produção Render/Docker (`npm run start -w backend`) |
| `compose.yaml` / `compose.prod.yaml` | API + front em Docker local |
| `docker/nginx.conf` | SPA estática; **`/api/` → 404** (sem reverse proxy) |
| `.github/workflows/supabase-migrate.yml` | `db push` no `main` |
| `.github/workflows/supabase-keepalive.yml` | Ping anti-pausa Supabase |
| `.github/workflows/monitor.yml` | Health + site |
| `.github/workflows/ci.yml` | Lint, build, testes, Docker test |
| `.github/workflows/cd.yml` | Build + imagem API (sanity) |
| `supabase/migrations/` | SQL versionado (Postgres) |
| `compose.prod.yaml`, `docker/*` | Docker produção |
| `.env.example` | Modelo local |
