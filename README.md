# As Crônicas de Beladona — Sanguis & Shadow

> **Mesa virtual (VTT) e gerenciador de crônica vampírica** — frontend **React 19**, API **Node/Express**, persistência e autenticação no **Supabase** e deploy serverless na **Vercel**.

[![Aplicação Online](https://img.shields.io/badge/Demo-Vercel-000000?style=flat-square&logo=vercel)](https://site-vampiro-a-mascara.vercel.app)
[![React 19](https://img.shields.io/badge/React-19-149eca?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5%2F7-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Express](https://img.shields.io/badge/Express-4-303030?style=flat-square&logo=express)](https://expressjs.com)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%7C%20DB%20%7C%20Storage-3ecf8e?style=flat-square&logo=supabase)](https://supabase.com)
[![CI](https://github.com/Jamilinha29/Site-Vampiro-a-Mascara/actions/workflows/ci.yml/badge.svg)](https://github.com/Jamilinha29/Site-Vampiro-a-Mascara/actions/workflows/ci.yml)
[![Licença MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

**Aplicação publicada:** [site-vampiro-a-mascara.vercel.app](https://site-vampiro-a-mascara.vercel.app)

---

## Sobre o projeto

**As Crônicas de Beladona** resolve a dispersão típica de campanhas de RPG de mesa — planilhas soltas, anotações isoladas e controle manual de sessão — reunindo criação de fichas, sala de jogo ao vivo, loja da crônica, acervo, bestiário e administração do narrador em uma única interface web responsiva (*mobile-first*).

### Principais funcionalidades

| Área | Destaques |
| :--- | :--- |
| **Jogador (`/user`)** | Wizard de criação em 6 etapas, ficha adaptativa por espécie (mortal, vampiro/cainita e variações), progressão **0–10** com subclasses nos níveis **5** e **7**, inventário com bônus automáticos e entrada em sessão por código |
| **Narrador (`/admin`)** | Criação/gestão de mesas, painel ao vivo (ameaças em cena, NPCs, modo descanso, rotação de código, concessão de XP e recompensas), editores de loja/acervo/bestiário e auditoria de revisões |
| **Acervo & Conteúdo** | Loja com carteira e extrato, glossário, bestiário de criaturas e downloads privados liberados pós-sessão |
| **Autenticação (`/auth`)** | Login/cadastro com confirmação de e-mail, recuperação `/auth/recover`, papéis validados no servidor (`player`, `narrator`, `admin`) e modo dev local isolado |

---

## Diferenciais de engenharia

- **Integridade e concorrência:** salvamento de documentos com revisão monotônica (*Compare-And-Swap* via RPC PostgreSQL), operações financeiras idempotentes (`OperacoesIdempotentes`) e rate limit compartilhado em banco (`beladona_check_rate_limit`).
- **Segurança aplicada:** verificação de JWT Supabase no servidor, validação de uploads por *magic bytes*, armazenamento privado com URLs assinadas (`revelacoes`), headers via Helmet/CORS e bloqueio automatizado contra vazamento de segredos no Git e no bundle Vite (`verify:git` e `verify:bundle`).
- **Operação & DevOps:** pipeline CI em DAG no GitHub Actions (checks paralelos de segurança, frontend e backend → `docker-test` + `supabase-migrate`), monitoramento contínuo e exportação criptografada (`AES-256-GCM`) do banco e manifestos de Storage.

---

## Arquitetura & Stack

```text
Browser (React 19 + Vite) ──► /api/v1/* (Express :4000 / Vercel Serverless) ──► Supabase (Auth · Postgres + RPC · Storage)
                                                                            └──► Resend (e-mail transacional opcional)
```

| Camada | Tecnologias |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS v4, React Router 7, TanStack Query v5, Zustand, Zod |
| **Backend** | Node.js 22, Express 4, TypeScript (`tsx` / `tsc`), Helmet, CORS, `express-rate-limit`, `serverless-http` |
| **Dados & Cloud** | Supabase (PostgreSQL, Auth, Storage), Resend, Vercel (SPA + Serverless) |
| **Qualidade & Infra** | Vitest (15 suítes / 63 testes), Supertest, Oxlint (0 warnings), Docker Compose (`dev` / `prod` / `test`), GitHub Actions |

---

## Estrutura do repositório

```text
Site-Vampiro-a-Mascara/
├── api/index.ts               # Adaptador serverless Vercel
├── backend/src/               # API Express, rotas (/api/v1), middlewares e serviços
├── frontend/src/              # SPA React (pages, components, features, stores, services)
├── supabase/migrations/       # Schema PostgreSQL, RLS, buckets e RPCs atômicas
├── test/                      # Suíte Vitest unificada (backend + frontend)
├── docker/                    # Dockerfiles (dev, prod, test) e Nginx
├── scripts/                   # Higiene de segredos e backup criptografado
├── docs/                      # Guias de deploy e recuperação de desastres
└── .github/workflows/         # CI em DAG (ci.yml), monitoramento (ops.yml) e backup (disaster-backup.yml)
```

---

## Como executar localmente

**Pré-requisitos:** Node.js `22.x` (`>=22 <25`), npm e projeto Supabase *(opcional em dev local via `ALLOW_DEV_AUTH=true`)*.

```bash
# 1. Clonar o repositório e instalar dependências (npm workspaces)
git clone <url-do-repositorio>
cd Site-Vampiro-a-Mascara
npm install

# 2. Configurar variáveis de ambiente (preencher com suas chaves locais)
cp .env.example .env

# 3. Subir backend (:4000) e frontend (:5173) juntos
npm run dev:all
```

> No Windows PowerShell, se a política bloquear `npm.ps1`, utilize `npm.cmd` (ex.: `npm.cmd run dev:all`).

### Execução com Docker e testes

```bash
npm run docker:dev     # Ambiente local em containers (API :4000 + Vite :5173)
npm run docker:prod    # Build de produção local com Nginx (:8080) e .env
npm run test:ci        # Suíte completa (15 arquivos / 63 testes)
npm run lint           # Type-check backend + Oxlint frontend
```

---

## Documentação complementar

| Guia | Conteúdo |
| :--- | :--- |
| [`.env.example`](.env.example) | Modelo completo das variáveis de frontend, backend, papéis e e-mail |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Passo a passo de deploy na Vercel, Render, Supabase Auth e GitHub Secrets |
| [`docs/BACKUP_RECOVERY.md`](docs/BACKUP_RECOVERY.md) | Rotina de backup criptografado (`AES-256-GCM`), restore e verificação |
| [`infrastructure/README.md`](infrastructure/README.md) | Arquitetura de containers e opções de hospedagem |
| [`test/README.md`](test/README.md) | Matriz de testes e contratos de segurança/durabilidade |

---

## Autor & Licença

Desenvolvido por **[Jamili Gabriela](https://github.com/Jamilinha29)** · **[Licença MIT](LICENSE)**

> Projeto autoral de mesa virtual para a crônica **Beladona**. Marcas, regras e propriedades intelectuais de terceiros permanecem sob licença de seus respectivos titulares.
