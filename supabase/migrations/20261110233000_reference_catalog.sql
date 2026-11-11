-- Catálogos editáveis pelo narrador e importáveis por CSV.
-- kind: faith | mortal_order | monster_type | equipment_type | magic | relic | subclass
-- CSV: name, description e, quando couber, faith_path (luz|trevas) ou class_name (subclasse).

create table if not exists public.reference_catalog (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  name text not null,
  description text not null default '',
  class_name text not null default '',
  faith_path text not null default '',
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (kind, class_name, name)
);

create index if not exists reference_catalog_kind_idx
  on public.reference_catalog (kind, sort_order, name);

alter table public.reference_catalog enable row level security;

comment on table public.reference_catalog is
  'Listas de fé, ordem mortal, monstro, equipamento, magia, relíquia e subclasse. A API também guarda cópia local.';
