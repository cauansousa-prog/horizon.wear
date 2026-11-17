-- Aperta as permissões da tabela de favoritos: cada cliente só lê, adiciona e remove os próprios favoritos.
-- O Supabase concede por padrão UPDATE, TRUNCATE, REFERENCES e TRIGGER ao papel authenticated; aqui eles saem.
-- Já aplicada no projeto Supabase da Horizon Wear. Pode ser executada mais de uma vez com segurança.
revoke update, truncate, references, trigger on table public.favorites from authenticated;
notify pgrst, 'reload schema';
