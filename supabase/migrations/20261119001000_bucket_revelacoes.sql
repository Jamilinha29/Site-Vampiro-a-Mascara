-- Imagens de download, mapa e pista. Não altera os buckets públicos já em uso.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'revelacoes',
  'revelacoes',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
