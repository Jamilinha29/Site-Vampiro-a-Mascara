# Testes do monorepo

Todos os testes automatizados ficam nesta pasta. **Não** há suíte Playwright de layout no CI hoje — após mudanças de UI, valide manualmente em ~375px e ~1280px ou adicione testes e2e depois.

| Pasta | Tipo | O que cobre |
|-------|------|-------------|
| `backend/` | Integração (API) e unidade (serviços) | Saúde, catálogo, auth, personagens, importação de planilhas, catálogo de referência, Resend |
| `frontend/` | Unidade | Regras de ficha e helpers compartilhados |

## Configuração

Arquivo único: [`vitest.config.ts`](vitest.config.ts) (dois **projects**: `backend` e `frontend`).

| Problema | Causa | Solução |
|----------|--------|---------|
| “No test files found” no `frontend/` | Vitest antigo procurava testes em `src/` | Rode `npm run test:ci` na **raiz** ou `npx vitest run --config ../test/vitest.config.ts --project frontend` |
| Erro ao rodar de dentro de `test/` no Windows | cwd errado + caminho com espaços | Sempre `cd` na raiz do repo antes de `vitest` |
## Comandos

Na raiz do repositório:

```bash
npm run test:ci
```

Só backend ou só front:

```bash
npm test -w backend
npx vitest run --config test/vitest.config.ts --project frontend
```

Docker (mesma suíte):

```bash
docker compose -f compose.test.yaml up --build --abort-on-container-exit --exit-code-from tests
```
