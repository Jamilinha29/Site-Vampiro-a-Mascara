-- Entidades do mestre (glossário, loja, NPCs, monstros, downloads) — site e planilha compartilham esta tabela.
-- visibility: draft (importação/planilha/edição) | published (jogador vê no site)

create table if not exists public.chronicle_entities (
  id uuid primary key,
  kind text not null,
  visibility text not null default 'draft' check (visibility in ('draft', 'published')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chronicle_entities_kind_idx on public.chronicle_entities (kind);
create index if not exists chronicle_entities_visibility_idx on public.chronicle_entities (visibility);

alter table public.chronicle_entities enable row level security;

-- Apenas service role (backend) manipula; jogadores não acessam direto.
create policy "Service role full access"
  on public.chronicle_entities
  for all
  using (false)
  with check (false);

comment on table public.chronicle_entities is 'Payload JSON espelha ChronicleEntity do backend Beladona';
