-- Espelho JSON completo da ficha (fonte de verdade continua no documento da campanha).
alter table if exists public."Personagens"
  add column if not exists sheet_payload jsonb not null default '{}'::jsonb;

do $$
begin
  if to_regclass('public.characters') is not null then
    alter table public.characters
      add column if not exists sheet_payload jsonb not null default '{}'::jsonb;
  end if;
end $$;