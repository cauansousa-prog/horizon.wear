-- Repara a tabela de favoritos e suas permissões sem apagar registros.
-- Pode ser executada mais de uma vez com segurança no projeto Supabase da Horizon Wear.
begin;

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists favorites_user_product_unique
  on public.favorites(user_id, product_id);

create index if not exists favorites_user_created_idx
  on public.favorites(user_id, created_at desc);

alter table public.favorites enable row level security;

grant usage on schema public to authenticated;
revoke all on table public.favorites from public, anon;
grant select, insert, delete on table public.favorites to authenticated;

drop policy if exists favorites_select_own on public.favorites;
create policy favorites_select_own on public.favorites
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists favorites_insert_own on public.favorites;
create policy favorites_insert_own on public.favorites
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists favorites_delete_own on public.favorites;
create policy favorites_delete_own on public.favorites
  for delete to authenticated
  using ((select auth.uid()) = user_id);

notify pgrst, 'reload schema';
commit;
