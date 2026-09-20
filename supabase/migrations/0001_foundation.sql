-- Fundação Horizon Wear. Aplicar uma vez em projeto Supabase vazio ou após revisão.
-- Transação completa: conflitos com tabelas existentes provocam rollback, sem substituição.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
create table private.admin_users (
 user_id uuid primary key references auth.users(id) on delete cascade
);
revoke all on private.admin_users from public, anon, authenticated;
alter table private.admin_users enable row level security;
create function private.is_admin() returns boolean language sql stable security definer
set search_path = '' as $$
 select exists(select 1 from private.admin_users where user_id = (select auth.uid()));
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '', phone text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.addresses (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 recipient text not null, postal_code text not null check(postal_code ~ '^[0-9]{8}$'),
 street text not null, number text not null, complement text, neighborhood text not null,
 city text not null, state char(2) not null, reference text, phone text,
 is_default boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index addresses_one_default on public.addresses(user_id) where is_default;
create table public.categories (
 id uuid primary key default gen_random_uuid(), name text not null,
 slug text not null unique, active boolean not null default true
);
create table public.products (
 id uuid primary key default gen_random_uuid(), category_id uuid references public.categories(id) on delete set null,
 name text not null, slug text not null unique, description text not null default '',
 fabric text, fit text, price numeric(12,2) not null check(price>=0),
 promotional_price numeric(12,2) check(promotional_price>=0 and promotional_price<price),
 active boolean not null default false, featured boolean not null default false,
 is_new boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- Estoque pertence à variação, para não misturar tamanhos e cores.
create table public.product_variants (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
 sku text not null unique, size text not null, color text not null default '',
 stock integer not null default 0 check(stock>=0), active boolean not null default true,
 unique(product_id,size,color), unique(id,product_id)
);
create table public.product_images (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
 url text not null, alt text not null default '', position integer not null default 0 check(position>=0)
);
create table public.cart (
 id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.cart_items (
 id uuid primary key default gen_random_uuid(), cart_id uuid not null references public.cart(id) on delete cascade,
 variant_id uuid not null references public.product_variants(id), quantity integer not null check(quantity between 1 and 999),
 unique(cart_id,variant_id)
);
create table public.coupons (
 id uuid primary key default gen_random_uuid(), code text not null unique,
 discount_type text not null check(discount_type in ('percent','fixed')),
 value numeric(12,2) not null check(value>0), minimum_total numeric(12,2) not null default 0 check(minimum_total>=0),
 active boolean not null default true, starts_at timestamptz, expires_at timestamptz,
 usage_limit integer check(usage_limit>0), used_count integer not null default 0 check(used_count>=0),
 check(discount_type<>'percent' or value<=100), check(expires_at>starts_at)
);
create table public.orders (
 id uuid primary key default gen_random_uuid(), code bigint generated always as identity unique,
 user_id uuid references public.profiles(id) on delete set null,
 customer_email text not null, customer_name text not null, customer_phone text,
 shipping_address jsonb not null check(jsonb_typeof(shipping_address)='object'),
 status text not null default 'pending' check(status in ('pending','paid','preparing','shipped','delivered','cancelled','refunded')),
 subtotal numeric(12,2) not null check(subtotal>=0), shipping numeric(12,2) not null default 0 check(shipping>=0),
 discount numeric(12,2) not null default 0 check(discount>=0 and discount<=subtotal),
 total numeric(12,2) generated always as (subtotal+shipping-discount) stored,
 coupon_id uuid references public.coupons(id), tracking_code text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), paid_at timestamptz
);
create table public.order_items (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
 product_id uuid not null references public.products(id), variant_id uuid not null,
 product_name text not null, size text not null, color text not null default '',
 quantity integer not null check(quantity>0), unit_price numeric(12,2) not null check(unit_price>=0),
 foreign key(variant_id,product_id) references public.product_variants(id,product_id)
);
create table public.payments (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id),
 provider text not null default 'mercadopago', provider_payment_id text unique,
 idempotency_key uuid not null unique default gen_random_uuid(),
 status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled','refunded','in_process','charged_back')),
 method text check(method in ('pix','card','boleto')), amount numeric(12,2) not null check(amount>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.reviews (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 product_id uuid not null references public.products(id), rating integer not null check(rating between 1 and 5),
 comment text not null default '' check(length(comment)<=5000), approved boolean not null default false,
 created_at timestamptz not null default now(), unique(user_id,product_id)
);
create function private.create_profile() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
 insert into public.profiles(id,full_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''));
 return new;
end; $$;
revoke all on function private.create_profile() from public,anon,authenticated;
create trigger horizon_user_created after insert on auth.users for each row execute function private.create_profile();
insert into public.profiles(id,full_name)
 select id,coalesce(raw_user_meta_data->>'full_name','') from auth.users on conflict(id) do nothing;
create function private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at=now(); return new; end; $$;
revoke all on function private.touch_updated_at() from public,anon,authenticated;
alter table public.profiles enable row level security;
revoke all on public.profiles from public,anon,authenticated;
grant all on public.profiles to service_role;
create policy admin_access on public.profiles for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
alter table public.addresses enable row level security;
revoke all on public.addresses from public,anon,authenticated;
grant all on public.addresses to service_role;
create policy admin_access on public.addresses for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
alter table public.categories enable row level security;
revoke all on public.categories from public,anon,authenticated;
grant all on public.categories to service_role;
create policy admin_access on public.categories for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
alter table public.products enable row level security;
revoke all on public.products from public,anon,authenticated;
grant all on public.products to service_role;
create policy admin_access on public.products for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
alter table public.product_variants enable row level security;
revoke all on public.product_variants from public,anon,authenticated;
grant all on public.product_variants to service_role;
create policy admin_access on public.product_variants for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
alter table public.product_images enable row level security;
revoke all on public.product_images from public,anon,authenticated;
grant all on public.product_images to service_role;
create policy admin_access on public.product_images for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
alter table public.cart enable row level security;
revoke all on public.cart from public,anon,authenticated;
grant all on public.cart to service_role;
create policy admin_access on public.cart for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
alter table public.cart_items enable row level security;
revoke all on public.cart_items from public,anon,authenticated;
grant all on public.cart_items to service_role;
create policy admin_access on public.cart_items for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
alter table public.coupons enable row level security;
revoke all on public.coupons from public,anon,authenticated;
grant all on public.coupons to service_role;
create policy admin_access on public.coupons for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
alter table public.orders enable row level security;
revoke all on public.orders from public,anon,authenticated;
grant all on public.orders to service_role;
create policy admin_access on public.orders for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
alter table public.order_items enable row level security;
revoke all on public.order_items from public,anon,authenticated;
grant all on public.order_items to service_role;
create policy admin_access on public.order_items for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
alter table public.payments enable row level security;
revoke all on public.payments from public,anon,authenticated;
grant all on public.payments to service_role;
create policy admin_access on public.payments for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
alter table public.reviews enable row level security;
revoke all on public.reviews from public,anon,authenticated;
grant all on public.reviews to service_role;
create policy admin_access on public.reviews for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create trigger touch_updated_at before update on public.profiles for each row execute function private.touch_updated_at();
create trigger touch_updated_at before update on public.addresses for each row execute function private.touch_updated_at();
create trigger touch_updated_at before update on public.products for each row execute function private.touch_updated_at();
create trigger touch_updated_at before update on public.cart for each row execute function private.touch_updated_at();
create trigger touch_updated_at before update on public.orders for each row execute function private.touch_updated_at();
create trigger touch_updated_at before update on public.payments for each row execute function private.touch_updated_at();
grant select on public.profiles to authenticated;
grant select on public.addresses to authenticated;
grant select on public.categories to authenticated;
grant select on public.products to authenticated;
grant select on public.product_variants to authenticated;
grant select on public.product_images to authenticated;
grant select on public.cart to authenticated;
grant select on public.cart_items to authenticated;
grant select on public.coupons to authenticated;
grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant select on public.payments to authenticated;
grant select on public.reviews to authenticated;
grant select on public.categories,public.products,public.product_images,public.product_variants to anon;
grant update(full_name,phone) on public.profiles to authenticated;
grant insert,update,delete on public.addresses,public.cart,public.cart_items to authenticated;
grant insert(user_id,product_id,rating,comment),update(rating,comment),delete on public.reviews to authenticated;
create policy own_profile_read on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy own_profile_update on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy own_addresses on public.addresses for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy own_cart on public.cart for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy own_cart_items on public.cart_items for all to authenticated
 using(exists(select 1 from public.cart c where c.id=cart_id and c.user_id=(select auth.uid())))
 with check(exists(select 1 from public.cart c where c.id=cart_id and c.user_id=(select auth.uid())));
create policy public_categories on public.categories for select to anon,authenticated using(active);
create policy public_products on public.products for select to anon,authenticated using(active);
create policy public_images on public.product_images for select to anon,authenticated using(exists(select 1 from public.products p where p.id=product_id and p.active));
create policy public_variants on public.product_variants for select to anon,authenticated using(active and exists(select 1 from public.products p where p.id=product_id and p.active));
create policy own_orders on public.orders for select to authenticated using(user_id=(select auth.uid()));
create policy own_order_items on public.order_items for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and o.user_id=(select auth.uid())));
create policy own_payments on public.payments for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and o.user_id=(select auth.uid())));
-- Avaliações ficam privadas até a sessão que publicar uma projeção sem user_id.
create policy own_reviews on public.reviews for select to authenticated using(user_id=(select auth.uid()));
create policy purchased_review on public.reviews for insert to authenticated with check(
 user_id=(select auth.uid()) and not approved and exists(
 select 1 from public.order_items i join public.orders o on o.id=i.order_id
 where i.product_id=reviews.product_id and o.user_id=(select auth.uid()) and o.status in ('paid','preparing','shipped','delivered')));
create policy edit_unapproved_review on public.reviews for update to authenticated using(user_id=(select auth.uid()) and not approved) with check(user_id=(select auth.uid()) and not approved);
create policy delete_own_review on public.reviews for delete to authenticated using(user_id=(select auth.uid()));
grant usage,select on sequence public.orders_code_seq to service_role;
create index on public.addresses(user_id);
create index on public.products(category_id);
create index on public.product_images(product_id);
create index on public.orders(user_id);
create index on public.orders(coupon_id);
create index on public.order_items(order_id);
create index on public.order_items(product_id);
create index on public.order_items(variant_id);
create index on public.cart_items(variant_id);
create index on public.payments(order_id);
create index on public.reviews(product_id);
commit;
