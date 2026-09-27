-- Aplicar no banco existente descrito em INSPECAO_EXISTENTE.md antes de 0003.
begin;
create schema if not exists private;
revoke all on schema private from public,anon;
grant usage on schema private to authenticated;

-- A checagem de administração não pode consultar profiles pela própria política RLS.
create or replace function private.horizon_is_admin()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin');
$$;
revoke all on function private.horizon_is_admin() from public,anon;
grant execute on function private.horizon_is_admin() to authenticated;
drop policy if exists "Admin vê todos os perfis" on public.profiles;
drop policy if exists horizon_admin_profiles_select on public.profiles;
create policy horizon_admin_profiles_select on public.profiles for select to authenticated
 using ((select private.horizon_is_admin()));

-- O dono do perfil só altera dados pessoais. O papel é definido no servidor Supabase.
revoke all on public.profiles from anon,authenticated;
grant select on public.profiles to authenticated;
grant update(nome_completo,telefone) on public.profiles to authenticated;

-- Pedido e pagamento são sempre gravados pelas funções de checkout no servidor.
revoke all on public.orders,public.order_items,public.payments from anon,authenticated;
grant select on public.orders,public.order_items,public.payments to authenticated;

-- Carrinho sincronizado usando a identidade do JWT, sem aceitar user_id do navegador.
create or replace function public.horizon_set_cart_item(p_size_id uuid,p_quantity integer)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid; v_cart uuid; v_stock integer; v_active boolean;
begin
 v_user=(select auth.uid());
 if v_user is null then raise exception 'Autenticação necessária'; end if;
 if p_quantity<0 or p_quantity>99 or p_quantity is null then raise exception 'Quantidade inválida'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text,0));
 select id into v_cart from public.cart where user_id=v_user order by created_at limit 1 for update;
 if v_cart is null then
  insert into public.cart(user_id) values(v_user) returning id into v_cart;
 end if;
 delete from public.cart_items where cart_id=v_cart and product_size_id=p_size_id;
 if p_quantity=0 then return; end if;
 select s.estoque,p.ativo into v_stock,v_active from public.product_sizes s
 join public.products p on p.id=s.product_id where s.id=p_size_id;
 if not found or not v_active or v_stock<p_quantity then raise exception 'Estoque indisponível'; end if;
 insert into public.cart_items(cart_id,product_id,product_size_id,quantidade)
 select v_cart,product_id,id,p_quantity from public.product_sizes where id=p_size_id;
end; $$;
revoke all on function public.horizon_set_cart_item(uuid,integer) from public,anon;
grant execute on function public.horizon_set_cart_item(uuid,integer) to authenticated;
commit;
