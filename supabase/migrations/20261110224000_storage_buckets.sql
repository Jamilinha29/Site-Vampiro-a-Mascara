-- Buckets de imagem. Rode no SQL Editor do Supabase uma vez.
-- perfil: foto e banner (jogador e narrador).
-- loja-glossario: a mesma ilustração serve loja e glossário.
-- Pastas dentro do segundo bucket: loja/ e glossario/.
-- A barra não entra no nome do bucket; o Storage não aceita "/".

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('perfil', 'perfil', true, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('loja-glossario', 'loja-glossario', true, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "leitura publica perfil" on storage.objects;
create policy "leitura publica perfil"
  on storage.objects for select
  to public
  using (bucket_id = 'perfil');

drop policy if exists "leitura publica loja glossario" on storage.objects;
create policy "leitura publica loja glossario"
  on storage.objects for select
  to public
  using (bucket_id = 'loja-glossario');
