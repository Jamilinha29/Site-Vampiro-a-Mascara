# Infraestrutura como código (IaC) — o que é neste projeto

**IaC** significa descrever servidores, banco e rede em arquivos versionados no Git, em vez de clicar manualmente no painel.

Neste repositório isso aparece assim:

| Recurso | Arquivo | Como aplicar |
|---------|---------|----------------|
| Banco Supabase | `supabase/migrations/*.sql` e `database/migrations/*.sql` | SQL Editor do Supabase ou CLI `supabase db push` |
| Site (SPA) | `frontend/vercel.json`, `vercel.json` | Deploy automático na Vercel ao enviar o `main` |
| API Node | `api/index.ts` + `vercel.json` **ou** `infrastructure/render.yaml` | Vercel (mesmo projeto do site) ou Render/Docker |
| Containers locais / produção | `compose.yaml`, `compose.prod.yaml`, `docker/*` | `npm run docker:dev` ou `npm run docker:prod` |

Migrações automáticas: workflow `.github/workflows/supabase-migrate.yml` (secrets no GitHub).

Onde a API roda (Vercel vs Render vs Docker): seção **“Onde roda cada peça”** em [`docs/DEPLOY.md`](../docs/DEPLOY.md).

O Supabase **não** é criado por estes arquivos: você cria o projeto no painel e liga o CLI/CI. O **schema** (tabelas, RLS, buckets) está versionado.

## Ordem sugerida para um ambiente novo

1. Criar projeto Supabase e preencher `.env` (sem commitar).
2. Executar migrações na ordem `002` → `003` → `004` → `005`.
3. Conectar o repositório na Vercel (Root Directory: `frontend`, ou raiz com `outputDirectory` em `frontend/dist`).
4. Publicar a API com `infrastructure/render.yaml` ou `docker/Dockerfile.backend.prod`.
5. Definir `VITE_API_URL` na Vercel apontando para a URL pública da API.
