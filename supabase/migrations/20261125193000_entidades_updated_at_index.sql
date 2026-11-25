-- Migração incremental não destrutiva:
-- Cria índice em (updated_at DESC, id DESC) para ordenação direta sem filtro em EntidadesCronica / chronicle_entities,
-- evitando sort completo conforme o acervo crescer. Nenhum registro existente é alterado ou removido.

do $$
declare
  tbl text;
begin
  foreach tbl in array array['EntidadesCronica', 'chronicle_entities']
  loop
    if to_regclass('public."' || tbl || '"') is not null then
      execute format(
        'create index if not exists %I on public.%I (updated_at desc, id desc)',
        lower(tbl) || '_updated_at_id_desc_idx',
        tbl
      );
    end if;
  end loop;
end $$;

-- Opcional (executar manualmente no SQL Editor do Supabase apenas se quiser zerar
-- o placar histórico de métricas técnicas sem afetar dados de tabelas):
-- select pg_stat_statements_reset();
