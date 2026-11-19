-- Cópia durável do estado de jogo que ainda vive em memória ou em arquivo local.
-- Não altera fichas, mesas nem carteiras já normalizadas. O payload é o documento inteiro.

create table if not exists public.campaign_documents (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.campaign_documents enable row level security;
