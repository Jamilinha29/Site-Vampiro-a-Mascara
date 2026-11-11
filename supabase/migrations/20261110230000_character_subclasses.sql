-- Subclasses por classe. Importe um CSV no Table Editor, tabela character_subclasses.
-- Colunas do CSV: class_name, name
-- class_name tem de ser igual à classe da ficha:
-- Guerreiro, Cavaleiro, Clérigo, Monge, Ladino, Caçador, Erudito, Diplomata,
-- Artesão, Camponês, Mercante, Feiticeiro, Bardo, Outro
-- O jogador escolhe uma linha da própria classe ao atingir o nível 7.

create table if not exists public.character_subclasses (
  id uuid primary key default gen_random_uuid(),
  class_name text not null,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (class_name, name)
);

create index if not exists character_subclasses_class_name_idx
  on public.character_subclasses (class_name, sort_order, name);

alter table public.character_subclasses enable row level security;

alter table public.characters add column if not exists character_class text;

comment on table public.character_subclasses is
  'Catálogo importado por CSV. class_name = classe da ficha; name = subclasse escolhida no nível 7.';
