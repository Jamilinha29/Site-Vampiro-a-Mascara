-- Hardening de segurança, suporte a PDF no bucket privado e índices cobrindo todas as chaves estrangeiras.
-- Idempotente e não destrutiva: segura para reexecutar em bancos existentes ou novos.

-- 1) Restringe RPCs SECURITY DEFINER exclusivamente à service_role (impede chamada direta via anon/authenticated/PostgREST)
do $$
begin
  if to_regprocedure('public.beladona_upsert_campaign_document(text,jsonb,bigint)') is not null then
    revoke all on function public.beladona_upsert_campaign_document(text, jsonb, bigint) from public, anon, authenticated;
    grant execute on function public.beladona_upsert_campaign_document(text, jsonb, bigint) to service_role;
  end if;

  if to_regprocedure('public.beladona_check_rate_limit(text,bigint,integer)') is not null then
    revoke all on function public.beladona_check_rate_limit(text, bigint, integer) from public, anon, authenticated;
    grant execute on function public.beladona_check_rate_limit(text, bigint, integer) to service_role;
  end if;

  if to_regprocedure('public.beladona_reset_rate_limit(text)') is not null then
    revoke all on function public.beladona_reset_rate_limit(text) from public, anon, authenticated;
    grant execute on function public.beladona_reset_rate_limit(text) to service_role;
  end if;
end $$;

-- 2) Permite application/pdf no bucket privado revelacoes (alinhado ao backend mediaStorage.ts)
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'],
    file_size_limit = greatest(coalesce(file_size_limit, 0), 2097152),
    public = false
where id = 'revelacoes';

-- 3) Índices cobrindo as 7 chaves estrangeiras sem índice (elimina alerta unindexed_foreign_keys no Supabase Advisor)
do $$
begin
  if to_regclass('public."AssentosSessao"') is not null then
    create index if not exists assentos_sessao_character_id_idx on public."AssentosSessao" (character_id);
  elsif to_regclass('public.session_seats') is not null then
    create index if not exists session_seats_character_id_idx on public.session_seats (character_id);
  end if;

  if to_regclass('public."RecompensasMaterial"') is not null then
    create index if not exists recompensas_material_entity_id_idx on public."RecompensasMaterial" (entity_id);
  elsif to_regclass('public.handout_rewards') is not null then
    create index if not exists handout_rewards_entity_id_idx on public.handout_rewards (entity_id);
  end if;

  if to_regclass('public."AmeacasCena"') is not null then
    create index if not exists ameacas_cena_entity_id_idx on public."AmeacasCena" (entity_id);
  elsif to_regclass('public.scene_threats') is not null then
    create index if not exists scene_threats_entity_id_idx on public.scene_threats (entity_id);
  end if;

  if to_regclass('public."NpcsCena"') is not null then
    create index if not exists npcs_cena_entity_id_idx on public."NpcsCena" (entity_id);
  elsif to_regclass('public.scene_npcs') is not null then
    create index if not exists scene_npcs_entity_id_idx on public.scene_npcs (entity_id);
  end if;

  if to_regclass('public."LeiturasNotificacao"') is not null then
    create index if not exists leituras_notificacao_notification_id_idx on public."LeiturasNotificacao" (notification_id);
  elsif to_regclass('public.notification_reads') is not null then
    create index if not exists notification_reads_notification_id_idx on public.notification_reads (notification_id);
  end if;

  if to_regclass('public."Inscricoes"') is not null then
    create index if not exists inscricoes_profile_id_idx on public."Inscricoes" (profile_id);
    create index if not exists inscricoes_clan_id_idx on public."Inscricoes" (clan_id);
  elsif to_regclass('public.registrations') is not null then
    create index if not exists registrations_profile_id_idx on public.registrations (profile_id);
    create index if not exists registrations_clan_id_idx on public.registrations (clan_id);
  end if;
end $$;

-- 4) Defaults seguros em EntidadesCronica (corrige sombreamento da migração inicial) e triggers updated_at faltantes
do $$
declare
  tbl text;
begin
  foreach tbl in array array['EntidadesCronica', 'chronicle_entities']
  loop
    if to_regclass('public."' || tbl || '"') is not null then
      execute format('alter table public.%I alter column id set default gen_random_uuid()', tbl);
      execute format('alter table public.%I alter column payload set default ''{}''::jsonb', tbl);
    end if;
  end loop;

  if to_regprocedure('public.set_updated_at()') is not null then
    foreach tbl in array array['CatalogoReferencia', 'DocumentosCampanha', 'TentativasCodigoMesa']
    loop
      if to_regclass('public."' || tbl || '"') is not null then
        execute format('drop trigger if exists set_updated_at on public.%I', tbl);
        execute format(
          'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
          tbl
        );
      end if;
    end loop;
  end if;
end $$;
