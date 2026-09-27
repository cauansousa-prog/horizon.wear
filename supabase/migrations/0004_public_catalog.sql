-- Restaura a leitura dos produtos publicados após restringir profiles.
-- A política administrativa anterior consultava profiles mesmo para visitantes.
begin;
drop policy if exists "Admin lê todos os produtos" on public.products;
create policy "Admin lê todos os produtos" on public.products
 for select to authenticated using ((select private.horizon_is_admin()));
drop policy if exists horizon_public_products_select on public.products;
create policy horizon_public_products_select on public.products
 for select to anon,authenticated using (ativo = true);
commit;
