-- Central: o mesmo Supabase, com catálogos e administradores por loja.
-- As tabelas atuais da Horizon permanecem com seus IDs e registros.
begin;
create schema if not exists private;
create table if not exists public.hub_stores (
 id text primary key check(id in ('horizon','academia','construcao')),
 nome text not null,
 created_at timestamptz not null default now()
);
insert into public.hub_stores(id,nome) values
 ('horizon','Horizon Wear'),('academia','Academia'),('construcao','Construção')
 on conflict(id) do nothing;
create table if not exists public.hub_memberships (
 loja_id text not null references public.hub_stores(id),
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('admin','editor')),
 primary key(loja_id,user_id)
);
create table if not exists public.hub_products (
 id uuid primary key default gen_random_uuid(),
 loja_id text not null references public.hub_stores(id) check(loja_id in ('academia','construcao')),
 slug text not null check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 nome text not null check(length(trim(nome)) between 2 and 120),
 descricao text not null default '',
 preco numeric(10,2) not null check(preco>0),
 imagem_url text not null default '',
 estoque integer not null default 0 check(estoque>=0),
 ativo boolean not null default true,
 created_at timestamptz not null default now(),
 unique(loja_id,slug),unique(id,loja_id)
);
create table if not exists public.hub_orders (
 id uuid primary key default gen_random_uuid(),
 loja_id text not null references public.hub_stores(id) check(loja_id in ('academia','construcao')),
 codigo bigint generated always as identity,
 user_id uuid references auth.users(id),
 status text not null default 'recebido' check(status in ('recebido','pagamento_aprovado','preparando','enviado','entregue','cancelado')),
 total numeric(12,2) not null check(total>=0),
 created_at timestamptz not null default now(),
 unique(id,loja_id)
);
create table if not exists public.hub_order_items (
 id uuid primary key default gen_random_uuid(),
 loja_id text not null,
 order_id uuid not null,
 product_id uuid not null,
 nome_produto text not null,
 quantidade integer not null check(quantidade>0),
 preco_unitario numeric(10,2) not null check(preco_unitario>0),
 foreign key(order_id,loja_id) references public.hub_orders(id,loja_id),
 foreign key(product_id,loja_id) references public.hub_products(id,loja_id)
);
create or replace function private.hub_manages_store(p_store text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.hub_memberships
 where loja_id=p_store and user_id=(select auth.uid()) and role in ('admin','editor'));
$$;
revoke all on function private.hub_manages_store(text) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.hub_manages_store(text) to authenticated;
alter table public.hub_stores enable row level security;
alter table public.hub_memberships enable row level security;
alter table public.hub_products enable row level security;
alter table public.hub_orders enable row level security;
alter table public.hub_order_items enable row level security;
revoke all on public.hub_stores,public.hub_memberships,public.hub_products,public.hub_orders,public.hub_order_items from anon,authenticated;
grant select on public.hub_stores,public.hub_products to anon,authenticated;
grant select on public.hub_memberships,public.hub_orders,public.hub_order_items to authenticated;
grant insert on public.hub_products to authenticated;
grant update(slug,nome,descricao,preco,imagem_url,estoque,ativo) on public.hub_products to authenticated;
grant all on public.hub_stores,public.hub_memberships,public.hub_products,public.hub_orders,public.hub_order_items to service_role;
grant usage,select on sequence public.hub_orders_codigo_seq to service_role;
drop policy if exists hub_stores_read on public.hub_stores;
create policy hub_stores_read on public.hub_stores for select to anon,authenticated using(true);
drop policy if exists hub_memberships_read on public.hub_memberships;
create policy hub_memberships_read on public.hub_memberships for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists hub_products_public on public.hub_products;
create policy hub_products_public on public.hub_products for select to anon,authenticated using(ativo);
drop policy if exists hub_products_manager_read on public.hub_products;
create policy hub_products_manager_read on public.hub_products for select to authenticated using((select private.hub_manages_store(loja_id)));
drop policy if exists hub_products_manager_insert on public.hub_products;
create policy hub_products_manager_insert on public.hub_products for insert to authenticated with check((select private.hub_manages_store(loja_id)));
drop policy if exists hub_products_manager_update on public.hub_products;
create policy hub_products_manager_update on public.hub_products for update to authenticated using((select private.hub_manages_store(loja_id))) with check((select private.hub_manages_store(loja_id)));
drop policy if exists hub_orders_read on public.hub_orders;
create policy hub_orders_read on public.hub_orders for select to authenticated using(user_id=(select auth.uid()) or (select private.hub_manages_store(loja_id)));
drop policy if exists hub_order_items_read on public.hub_order_items;
create policy hub_order_items_read on public.hub_order_items for select to authenticated using(exists(
 select 1 from public.hub_orders o where o.id=order_id and o.loja_id=hub_order_items.loja_id
 and (o.user_id=(select auth.uid()) or (select private.hub_manages_store(o.loja_id)))));
select id,nome from public.hub_stores order by id;
notify pgrst,'reload schema';
commit;
