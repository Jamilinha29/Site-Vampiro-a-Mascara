-- Migração incremental não destrutiva:
-- - Controle de revisão monotônica em DocumentosCampanha (CAS multi-instância)
-- - Progressão 0-10 + subclasse adicional (níveis 5 e 7) preservando fichas legadas
-- - Tabelas duráveis de idempotência, auditoria, revisões de ficha, metadados de backup, tentativas de código e ações de mesa
-- - RPCs atômicas para CAS de documento e rate limit compartilhado

-- 1) Revisão monotônica em DocumentosCampanha / campaign_documents
do $$
begin
  if to_regclass('public."DocumentosCampanha"') is not null then
    alter table public."DocumentosCampanha"
      add column if not exists revision bigint not null default 1;
  end if;
  if to_regclass('public.campaign_documents') is not null then
    alter table public.campaign_documents
      add column if not exists revision bigint not null default 1;
  end if;
end $$;

-- 2) Progressão 0-10 e duas subclasses em Personagens / characters (sem apagar dados antigos)
do $$
declare
  tbl text;
  cname text;
begin
  foreach tbl in array array['Personagens', 'characters']
  loop
    if to_regclass('public."' || tbl || '"') is not null then
      for cname in
        select conname
        from pg_constraint
        where conrelid = to_regclass('public."' || tbl || '"')
          and contype = 'c'
          and pg_get_constraintdef(oid) ~* '\blevel\b'
      loop
        execute format('alter table public.%I drop constraint if exists %I', tbl, cname);
      end loop;

      execute format('alter table public.%I add column if not exists character_class text', tbl);
      execute format('alter table public.%I add column if not exists secondary_subclass text', tbl);
      execute format('alter table public.%I add column if not exists sheet_revision integer not null default 0', tbl);
      execute format('alter table public.%I add column if not exists needs_rule_review boolean not null default false', tbl);
      execute format('alter table public.%I add column if not exists rule_review_note text', tbl);

      -- Marca fichas legadas fora da regra 0-10 / subclasse < 5 sem reduzir nível nem apagar subclasse
      execute format(
        'update public.%I set needs_rule_review = true, rule_review_note = coalesce(rule_review_note, %L) where level > 10 or (subclass is not null and level < 5)',
        tbl,
        'Ficha legada marcada para revisão na migração de progressão (0-10, subclasses nos níveis 5 e 7).'
      );

      -- NOT VALID preserva registros antigos > 10 até revisão manual, mas valida todo novo INSERT/UPDATE
      execute format(
        'alter table public.%I add constraint %I check (level between 0 and 10) not valid',
        tbl,
        tbl || '_level_0_10_check'
      );
    end if;
  end loop;
end $$;

-- 3) Sessões agendadas: listing + rotação de código
do $$
declare
  tbl text;
begin
  foreach tbl in array array['SessoesAgendadas', 'scheduled_sessions']
  loop
    if to_regclass('public."' || tbl || '"') is not null then
      execute format('alter table public.%I add column if not exists listing text not null default %L', tbl, 'private');
      execute format('alter table public.%I add column if not exists access_code_rotated_at timestamptz', tbl);
    end if;
  end loop;
end $$;

-- 4) Índices adicionais de consulta paginada em EntidadesCronica
do $$
declare
  tbl text;
begin
  foreach tbl in array array['EntidadesCronica', 'chronicle_entities']
  loop
    if to_regclass('public."' || tbl || '"') is not null then
      execute format('alter table public.%I add column if not exists chronicle_scope text', tbl);
      execute format('alter table public.%I add column if not exists narrator_scope text', tbl);
      execute format('create index if not exists %I on public.%I (kind, visibility, updated_at desc)', tbl || '_kind_vis_upd_idx', tbl);
    end if;
  end loop;
end $$;

-- 5) Tabela durável de idempotência (compras, concessões, operações financeiras)
create table if not exists public."OperacoesIdempotentes" (
  actor_email text not null,
  operation_id text not null,
  kind text not null,
  request_hash text not null,
  status_code integer not null,
  response_body jsonb not null,
  created_at timestamptz not null default now(),
  primary key (actor_email, operation_id)
);

alter table public."OperacoesIdempotentes" enable row level security;

-- 6) Trilha durável de auditoria operacional
create table if not exists public."AuditoriaOperacoes" (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null,
  actor_email text not null,
  kind text not null,
  session_id text,
  character_id text,
  entity_id text,
  operation_id text,
  summary text not null,
  before_value text,
  after_value text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists auditoria_operacoes_email_idx on public."AuditoriaOperacoes" (email, created_at desc);
create index if not exists auditoria_operacoes_session_idx on public."AuditoriaOperacoes" (session_id, created_at desc);
alter table public."AuditoriaOperacoes" enable row level security;

-- 7) Histórico durável de revisões de ficha (recuperação individual)
create table if not exists public."RevisoesPersonagem" (
  id uuid primary key default gen_random_uuid(),
  character_id text not null,
  profile_email text not null,
  revision integer not null,
  snapshot jsonb not null,
  reason text not null default 'update',
  actor_email text not null,
  created_at timestamptz not null default now()
);

create index if not exists revisoes_personagem_lookup_idx
  on public."RevisoesPersonagem" (profile_email, character_id, revision desc);
alter table public."RevisoesPersonagem" enable row level security;

-- 8) Metadados de execuções de backup (sem dumps, senhas ou URLs secretas)
create table if not exists public."MetadadosBackup" (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  scope text not null,
  schema_version text not null,
  status text not null check (status in ('verified', 'completed_unverified', 'pending_external_destination', 'failed')),
  record_counts jsonb not null default '{}'::jsonb,
  checksum_sha256 text not null,
  external_ref text,
  verified_at timestamptz,
  operator_email text not null,
  notes text
);

create index if not exists metadados_backup_created_idx on public."MetadadosBackup" (created_at desc);
alter table public."MetadadosBackup" enable row level security;

-- 9) Limitador compartilhado de tentativas de código de mesa
create table if not exists public."TentativasCodigoMesa" (
  rate_key text primary key,
  attempt_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public."TentativasCodigoMesa" enable row level security;

-- 10) Log persistido de ações e declarações da mesa ao vivo
create table if not exists public."AcoesSessao" (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  actor_email text not null,
  character_id text,
  character_name text not null,
  kind text not null check (kind in ('declaration', 'skill', 'damage', 'potion', 'turn_end', 'round_end', 'system')),
  summary text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists acoes_sessao_session_idx on public."AcoesSessao" (session_id, created_at desc);
alter table public."AcoesSessao" enable row level security;

-- 11) RPC atômica de upsert com Compare-And-Swap por revisão monotônica
create or replace function public.beladona_upsert_campaign_document(
  p_id text,
  p_payload jsonb,
  p_expected_revision bigint default null
)
returns table (id text, revision bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rev bigint;
begin
  if p_expected_revision is null or p_expected_revision <= 0 then
    insert into public."DocumentosCampanha" (id, payload, updated_at, revision)
    values (p_id, p_payload, now(), 1)
    on conflict (id) do nothing
    returning "DocumentosCampanha".revision into v_rev;

    if v_rev is not null then
      return query select p_id, v_rev;
      return;
    end if;

    raise exception 'DOCUMENT_CONFLICT' using errcode = '40001';
  end if;

  update public."DocumentosCampanha"
  set payload = p_payload,
      updated_at = now(),
      revision = "DocumentosCampanha".revision + 1
  where "DocumentosCampanha".id = p_id
    and "DocumentosCampanha".revision = p_expected_revision
  returning "DocumentosCampanha".revision into v_rev;

  if v_rev is null then
    raise exception 'DOCUMENT_CONFLICT' using errcode = '40001';
  end if;

  return query select p_id, v_rev;
end;
$$;

-- 12) RPC compartilhada de rate-limit para códigos de mesa
create or replace function public.beladona_check_rate_limit(
  p_key text,
  p_window_ms bigint,
  p_max_tries integer
)
returns table (allowed boolean, remaining integer, retry_after_sec integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_row public."TentativasCodigoMesa"%rowtype;
  v_elapsed_ms bigint;
begin
  insert into public."TentativasCodigoMesa" (rate_key, attempt_count, window_started_at, updated_at)
  values (p_key, 0, v_now, v_now)
  on conflict (rate_key) do nothing;

  select * into v_row
  from public."TentativasCodigoMesa"
  where rate_key = p_key
  for update;

  v_elapsed_ms := floor(extract(epoch from (v_now - v_row.window_started_at)) * 1000)::bigint;
  if v_elapsed_ms > p_window_ms then
    v_row.attempt_count := 0;
    v_row.window_started_at := v_now;
  end if;

  if v_row.attempt_count >= p_max_tries then
    update public."TentativasCodigoMesa"
    set attempt_count = v_row.attempt_count,
        window_started_at = v_row.window_started_at,
        updated_at = v_now
    where rate_key = p_key;
    return query select false, 0, greatest(1, ceil((p_window_ms - v_elapsed_ms) / 1000.0)::integer);
    return;
  end if;

  v_row.attempt_count := v_row.attempt_count + 1;
  update public."TentativasCodigoMesa"
  set attempt_count = v_row.attempt_count,
      window_started_at = v_row.window_started_at,
      updated_at = v_now
  where rate_key = p_key;

  return query select true, greatest(0, p_max_tries - v_row.attempt_count), 0;
end;
$$;

create or replace function public.beladona_reset_rate_limit(p_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public."TentativasCodigoMesa" where rate_key = p_key;
end;
$$;
