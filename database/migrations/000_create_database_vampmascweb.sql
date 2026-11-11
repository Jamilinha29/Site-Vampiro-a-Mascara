-- Banco local "VampMascWeb".
-- Rode este arquivo ligado ao banco "postgres" (ou template1), como superusuário.
-- Não rode no SQL Editor do Supabase: o projeto já é um único banco chamado postgres
-- e a role da conexão não pode executar CREATE DATABASE.
-- Depois conecte em VampMascWeb e rode 002_vampmascweb_schema.sql.

SELECT 'CREATE DATABASE "VampMascWeb" WITH ENCODING ''UTF8'' TEMPLATE template0'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'VampMascWeb')\gexec
