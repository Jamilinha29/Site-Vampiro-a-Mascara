# Runbook de Backup, Recuperação e Limites do Plano Free

## Escopo e Limitações Reais
- O projeto utiliza **Supabase Free**, que **não fornece PITR (Point-in-Time Recovery)** contínuo nem retenção automática prolongada gerenciada pela plataforma.
- Por isso, a resiliência de dados combina:
  1. **Versionamento transacional no banco:** colunas `revision` em `DocumentosCampanha` (optimistic locking via `beladona_upsert_campaign_document`) e `sheet_revision` em `Personagens`.
  2. **Histórico de revisões por personagem:** snapshots automáticos gravados em `RevisoesPersonagem` antes de alterações e restauração segura com modo prévia (`dryRun`) e confirmação explícita em `/api/v1/admin/chronicle/characters/:email/:characterId/restore-revision`.
  3. **Exportação externa criptografada:** `scripts/backup-disaster.mjs` (AES-256-GCM + gzip + SHA-256) e workflow diário `.github/workflows/disaster-backup.yml`.

## Procedimento de Exportação Manual
```bash
SUPABASE_URL=... SUPABASE_SECRET_KEY=... BELADONA_BACKUP_KEY=... npm run backup:export
npm run backup:check
```
- Nunca comite backups descriptografados ou chaves (`.env`, `backups/`, `*.dump`, `*.sql.gz`, `*.enc`) — bloqueado por `.gitignore` e `scripts/verify-git-clean.js`.
- Para habilitar envio off-site completo no GitHub Actions, configure os segredos `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `BELADONA_BACKUP_KEY` e `BELADONA_EXTERNAL_BACKUP_TARGET`. Enquanto não configurados, o status permanece `pending_external_destination`.

## Procedimento de Restore Drill (Trimestral)
1. Validar integridade estrutural sem sobrescrever a campanha via endpoint `POST /api/v1/admin/chronicle/backup/drill`.
2. Validar manifesto de mídias do Storage via `POST /api/v1/admin/chronicle/backup/validate-storage`.
3. Em caso de restauração de ficha específica, executar primeiro com `{ dryRun: true }` e somente após inspeção confirmar com `{ dryRun: false, confirm: 'restaurar-revisao' }`.
4. Em caso de restauração completa (somente `admin`), confirmar com `{ confirm: 'restaurar-copia', backup }`. O backend mantém snapshot de rollback caso qualquer gravação falhe no meio.

## Rotação de Credenciais
- Caso qualquer chave (`SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `BELADONA_BACKUP_KEY`) seja exposta:
  1. Revogue e regenere no painel do Supabase/Resend e atualize os segredos na Vercel/GitHub Actions.
  2. Rode `npm run verify:git` e `npm run verify:bundle` para garantir ausência de vazamento em repositório e build estático.
