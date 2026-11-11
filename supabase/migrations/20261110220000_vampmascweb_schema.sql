-- Schema VampMascWeb — crônica Beladona.
-- Onde rodar:
--   Supabase: SQL Editor do projeto (banco postgres). Cole este arquivo inteiro.
--   Postgres local: depois de 000_create_database_vampmascweb.sql, conectado em "VampMascWeb".
-- Idempotente: pode rodar de novo. Não apaga dados.
-- Acesso: RLS ligado e sem policy para anon/authenticated.
-- O backend entra com a service role, que ignora RLS.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Clãs do catálogo (mesmos ids fixos de backend/src/routes/catalog.ts)
-- ---------------------------------------------------------------------------

create table if not exists public.clans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  storage_folder text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.clans (id, name, slug, storage_folder)
values
  ('00000000-0000-4000-8000-000000000001', 'Banu Haqim', 'banu-haqim', 'banu-haqim'),
  ('00000000-0000-4000-8000-000000000002', 'Brujah', 'brujah', 'brujah'),
  ('00000000-0000-4000-8000-000000000003', 'Gangrel', 'gangrel', 'gangrel'),
  ('00000000-0000-4000-8000-000000000004', 'Hecata', 'hecata', 'hecata'),
  ('00000000-0000-4000-8000-000000000005', 'Lasombra', 'lasombra', 'lasombra'),
  ('00000000-0000-4000-8000-000000000006', 'Malkavian', 'malkavian', 'malkavian'),
  ('00000000-0000-4000-8000-000000000007', 'Ministry', 'ministry', 'ministry'),
  ('00000000-0000-4000-8000-000000000008', 'Nosferatu', 'nosferatu', 'nosferatu'),
  ('00000000-0000-4000-8000-000000000009', 'Ravnos', 'ravnos', 'ravnos'),
  ('00000000-0000-4000-8000-000000000010', 'Salubri', 'salubri', 'salubri'),
  ('00000000-0000-4000-8000-000000000011', 'Toreador', 'toreador', 'toreador'),
  ('00000000-0000-4000-8000-000000000012', 'Tremere', 'tremere', 'tremere'),
  ('00000000-0000-4000-8000-000000000013', 'Tzimisce', 'tzimisce', 'tzimisce'),
  ('00000000-0000-4000-8000-000000000014', 'Ventrue', 'ventrue', 'ventrue')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Contas e fichas (hoje em memória em profileStore)
-- ---------------------------------------------------------------------------

create table if not exists public.player_profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  handle text not null,
  role text not null default 'player' check (role in ('player', 'narrator', 'admin')),
  member_since timestamptz not null default now(),
  avatar_url text,
  banner_url text,
  badges text[] not null default '{}',
  preferences jsonb not null default '{}'::jsonb,
  account_metrics jsonb not null default '{}'::jsonb,
  lineage_stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.player_profiles (id) on delete cascade,
  name text not null,
  species text not null,
  clan text,
  level integer not null default 1 check (level between 1 and 20),
  is_primary boolean not null default false,
  show_on_home boolean not null default false,
  portrait_url text,
  hp_current integer not null default 0,
  hp_max integer not null default 0,
  blood_current integer,
  blood_max integer,
  mana_current integer,
  mana_max integer,
  will_current integer,
  will_max integer,
  xp_current integer not null default 0,
  xp_to_next integer not null default 0,
  subclass text,
  carry_capacity_kg numeric not null default 0,
  identity jsonb not null default '{}'::jsonb,
  vitals jsonb,
  balance_stats jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists characters_profile_id_idx on public.characters (profile_id);

create unique index if not exists characters_one_primary_per_profile
  on public.characters (profile_id)
  where is_primary;

create table if not exists public.character_items (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters (id) on delete cascade,
  name text not null,
  description text,
  category text not null check (category in ('weapon', 'armor', 'elixir', 'ritual', 'material', 'trinket', 'other')),
  rarity text not null check (rarity in ('comum', 'incomum', 'raro', 'ancestral', 'proibido')),
  weight_kg numeric not null default 0,
  equipped boolean not null default false,
  slot text check (slot in ('head', 'torso', 'hands', 'feet', 'rings', 'accessory')),
  status text check (status in ('ok', 'broken', 'cooldown', 'drop')),
  stats_label text,
  durability_current integer,
  durability_max integer,
  created_at timestamptz not null default now()
);

create index if not exists character_items_character_id_idx on public.character_items (character_id);

create table if not exists public.character_skills (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters (id) on delete cascade,
  name text not null,
  die text not null,
  attribute text not null,
  attribute_mod integer not null default 0,
  how_it_works text not null default '',
  mana_cost integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists character_skills_character_id_idx on public.character_skills (character_id);

-- ---------------------------------------------------------------------------
-- Glossário, loja, bestiário, downloads (espelha ChronicleEntity + payload)
-- ---------------------------------------------------------------------------

create table if not exists public.chronicle_entities (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('npc', 'monster', 'equipment', 'consumable', 'archive', 'download')),
  visibility text not null default 'draft' check (visibility in ('draft', 'published')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chronicle_entities add column if not exists name text;
alter table public.chronicle_entities add column if not exists description text not null default '';
alter table public.chronicle_entities add column if not exists archive_category text;
alter table public.chronicle_entities add column if not exists shop_category text;
alter table public.chronicle_entities add column if not exists download_category text;
alter table public.chronicle_entities add column if not exists bestiary_tier text;
alter table public.chronicle_entities add column if not exists classification text;
alter table public.chronicle_entities add column if not exists creature_type text;
alter table public.chronicle_entities add column if not exists threat_level text;
alter table public.chronicle_entities add column if not exists rarity text;
alter table public.chronicle_entities add column if not exists weight_kg numeric;
alter table public.chronicle_entities add column if not exists image_url text;
alter table public.chronicle_entities add column if not exists hp_max integer;
alter table public.chronicle_entities add column if not exists mana_max integer;
alter table public.chronicle_entities add column if not exists attribute_mods jsonb not null default '[]'::jsonb;
alter table public.chronicle_entities add column if not exists relic_amulet_type text;
alter table public.chronicle_entities add column if not exists magic_type text;
alter table public.chronicle_entities add column if not exists cooldown_text text;
alter table public.chronicle_entities add column if not exists equipment_type text;
alter table public.chronicle_entities add column if not exists service_type text;
alter table public.chronicle_entities add column if not exists consumable_kind text;
alter table public.chronicle_entities add column if not exists stock_total integer;
alter table public.chronicle_entities add column if not exists stats_text text;
alter table public.chronicle_entities add column if not exists price_gold integer not null default 0;
alter table public.chronicle_entities add column if not exists price_silver integer not null default 0;
alter table public.chronicle_entities add column if not exists price_copper integer not null default 0;
alter table public.chronicle_entities add column if not exists file_name text;
alter table public.chronicle_entities add column if not exists file_url text;
alter table public.chronicle_entities add column if not exists creature_size text;
alter table public.chronicle_entities add column if not exists creature_speed text;
alter table public.chronicle_entities add column if not exists creature_senses text;
alter table public.chronicle_entities add column if not exists defense_note text;
alter table public.chronicle_entities add column if not exists primary_attack_name text;
alter table public.chronicle_entities add column if not exists primary_attack_desc text;
alter table public.chronicle_entities add column if not exists secondary_attack_name text;
alter table public.chronicle_entities add column if not exists secondary_attack_desc text;
alter table public.chronicle_entities add column if not exists scene_trigger text;
alter table public.chronicle_entities add column if not exists narrator_notes text;
alter table public.chronicle_entities add column if not exists creature_stats jsonb;
alter table public.chronicle_entities add column if not exists passive_traits jsonb not null default '[]'::jsonb;

create index if not exists chronicle_entities_kind_idx on public.chronicle_entities (kind);
create index if not exists chronicle_entities_visibility_idx on public.chronicle_entities (visibility);
create index if not exists chronicle_entities_kind_visibility_idx on public.chronicle_entities (kind, visibility);

-- ---------------------------------------------------------------------------
-- Mesas, presença, assentos e handout
-- ---------------------------------------------------------------------------

create table if not exists public.scheduled_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  scheduled_at timestamptz not null,
  chronicle_name text,
  narrator_email text,
  table_meta jsonb,
  access_code text not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'open', 'closed')),
  started_at timestamptz,
  ended_at timestamptz,
  last_opened_at timestamptz,
  active_duration_ms bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scheduled_sessions_status_idx on public.scheduled_sessions (status, scheduled_at);
create index if not exists scheduled_sessions_access_code_idx on public.scheduled_sessions (access_code);

create table if not exists public.session_presence (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.scheduled_sessions (id) on delete cascade,
  email text not null,
  display_name text not null,
  confirmed_at timestamptz not null default now(),
  unique (session_id, email)
);

create index if not exists session_presence_session_id_idx on public.session_presence (session_id);

create table if not exists public.session_seats (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.scheduled_sessions (id) on delete cascade,
  email text not null,
  display_name text not null,
  character_id uuid references public.characters (id) on delete set null,
  character_name text not null,
  joined_at timestamptz not null default now(),
  left_at timestamptz
);

create index if not exists session_seats_session_id_idx on public.session_seats (session_id);
create index if not exists session_seats_open_email_idx on public.session_seats (session_id, email) where left_at is null;

create table if not exists public.session_handouts (
  id uuid primary key default gen_random_uuid(),
  scheduled_session_id uuid unique references public.scheduled_sessions (id) on delete cascade,
  title text not null,
  status text not null default 'pending_close' check (status in ('pending_close', 'closed')),
  narrative_summary text not null default '',
  chronicle_name text,
  npc_ids uuid[] not null default '{}',
  monsters_slain jsonb not null default '[]'::jsonb,
  missions jsonb not null default '[]'::jsonb,
  chronicle_ambience jsonb,
  rest_mode boolean not null default false,
  published_to_players boolean not null default false,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.handout_participants (
  id uuid primary key default gen_random_uuid(),
  handout_id uuid not null references public.session_handouts (id) on delete cascade,
  display_name text not null,
  character_name text not null
);

create index if not exists handout_participants_handout_id_idx on public.handout_participants (handout_id);

create table if not exists public.handout_rewards (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.handout_participants (id) on delete cascade,
  reward_type text not null check (reward_type in ('equipment', 'consumable', 'currency', 'xp')),
  label text not null,
  entity_id uuid references public.chronicle_entities (id) on delete set null,
  gold integer,
  silver integer,
  xp integer
);

create index if not exists handout_rewards_participant_id_idx on public.handout_rewards (participant_id);

create table if not exists public.scene_threats (
  id uuid primary key default gen_random_uuid(),
  handout_id uuid not null references public.session_handouts (id) on delete cascade,
  entity_id uuid references public.chronicle_entities (id) on delete set null,
  name text not null,
  hp_current integer not null default 0,
  hp_max integer not null default 0,
  mana_current integer not null default 0,
  mana_max integer not null default 0
);

create index if not exists scene_threats_handout_id_idx on public.scene_threats (handout_id);

create table if not exists public.scene_npcs (
  id uuid primary key default gen_random_uuid(),
  handout_id uuid not null references public.session_handouts (id) on delete cascade,
  entity_id uuid references public.chronicle_entities (id) on delete set null,
  name text not null,
  description text not null default ''
);

create index if not exists scene_npcs_handout_id_idx on public.scene_npcs (handout_id);

-- ---------------------------------------------------------------------------
-- Carteira e loja (hoje mock / Map em memória)
-- ---------------------------------------------------------------------------

create table if not exists public.wallets (
  profile_id uuid primary key references public.player_profiles (id) on delete cascade,
  gold integer not null default 0 check (gold >= 0),
  silver integer not null default 0 check (silver >= 0),
  copper integer not null default 0 check (copper >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.player_profiles (id) on delete cascade,
  kind text not null check (kind in ('credit', 'debit')),
  label text not null,
  amount_label text not null,
  gold_delta integer not null default 0,
  silver_delta integer not null default 0,
  copper_delta integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists wallet_ledger_profile_id_idx on public.wallet_ledger (profile_id, created_at desc);

create table if not exists public.shop_purchases (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.player_profiles (id) on delete cascade,
  entity_id uuid not null references public.chronicle_entities (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (profile_id, entity_id)
);

create index if not exists shop_purchases_entity_id_idx on public.shop_purchases (entity_id);

-- ---------------------------------------------------------------------------
-- Avisos
-- ---------------------------------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.player_profiles (id) on delete cascade,
  kind text not null check (kind in ('session', 'chronicle', 'system', 'news')),
  title text not null,
  message text not null,
  href text,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_reads (
  profile_id uuid not null references public.player_profiles (id) on delete cascade,
  notification_id uuid not null references public.notifications (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (profile_id, notification_id)
);

create index if not exists notifications_profile_id_idx on public.notifications (profile_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Cadastro / e-mail (Resend), sem depender de auth.users
-- ---------------------------------------------------------------------------

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique,
  profile_id uuid references public.player_profiles (id) on delete set null,
  full_name text not null,
  email text not null,
  birth_date date,
  character_name text,
  clan_id uuid references public.clans (id),
  status text not null default 'pending',
  terms_accepted_at timestamptz,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.registrations add column if not exists profile_id uuid references public.player_profiles (id) on delete set null;
alter table public.registrations add column if not exists terms_accepted_at timestamptz;
alter table public.registrations add column if not exists marketing_opt_in boolean not null default false;

create index if not exists registrations_email_idx on public.registrations (email);

create table if not exists public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations (id) on delete cascade,
  status text not null,
  provider_message_id text,
  attempt_count integer not null default 0,
  sent_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_deliveries_registration_id_idx on public.email_deliveries (registration_id);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

drop trigger if exists set_updated_at on public.clans;
create trigger set_updated_at before update on public.clans
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.player_profiles;
create trigger set_updated_at before update on public.player_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.characters;
create trigger set_updated_at before update on public.characters
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.chronicle_entities;
create trigger set_updated_at before update on public.chronicle_entities
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.scheduled_sessions;
create trigger set_updated_at before update on public.scheduled_sessions
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.session_handouts;
create trigger set_updated_at before update on public.session_handouts
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.wallets;
create trigger set_updated_at before update on public.wallets
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.email_deliveries;
create trigger set_updated_at before update on public.email_deliveries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: ninguém pelo cliente anon/authenticated. Service role passa direto.
-- ---------------------------------------------------------------------------

alter table public.clans enable row level security;
alter table public.player_profiles enable row level security;
alter table public.characters enable row level security;
alter table public.character_items enable row level security;
alter table public.character_skills enable row level security;
alter table public.chronicle_entities enable row level security;
alter table public.scheduled_sessions enable row level security;
alter table public.session_presence enable row level security;
alter table public.session_seats enable row level security;
alter table public.session_handouts enable row level security;
alter table public.handout_participants enable row level security;
alter table public.handout_rewards enable row level security;
alter table public.scene_threats enable row level security;
alter table public.scene_npcs enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_ledger enable row level security;
alter table public.shop_purchases enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;
alter table public.registrations enable row level security;
alter table public.email_deliveries enable row level security;

comment on schema public is 'VampMascWeb — schema da crônica Beladona aplicado no banco postgres do Supabase';
