begin;

alter table public.orders
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles(id) on delete set null,
  add column if not exists cancel_reason text;

create table if not exists public.store_reviews (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  nota integer not null check (nota between 1 and 5),
  comentario text not null default '' check (char_length(comentario) <= 2000),
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_reviews_created_at_idx
  on public.store_reviews(created_at desc);

alter table public.store_reviews enable row level security;
revoke all on public.store_reviews from public, anon, authenticated;
grant select on public.store_reviews to anon, authenticated;
grant insert, update on public.store_reviews to authenticated;

create policy store_reviews_public_approved
  on public.store_reviews for select to anon, authenticated
  using (approved = true);

create policy store_reviews_own_read
  on public.store_reviews for select to authenticated
  using (user_id = (select auth.uid()));

create policy store_reviews_admin_read
  on public.store_reviews for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  ));

create policy store_reviews_own_insert
  on public.store_reviews for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.orders o
      where o.user_id = (select auth.uid()) and o.status = 'recebido'
    )
  );

create policy store_reviews_own_update
  on public.store_reviews for update to authenticated
  using (user_id = (select auth.uid()) and approved = false)
  with check (user_id = (select auth.uid()) and approved = false);

create policy store_reviews_admin_update
  on public.store_reviews for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  ));

create trigger store_reviews_touch_updated_at
  before update on public.store_reviews
  for each row execute function private.touch_updated_at();

create or replace function public.horizon_cancel_my_order(
  p_order uuid,
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_state private.checkout_state;
  v_has_checkout boolean := false;
  v_reason text := left(trim(coalesce(p_reason, '')), 500);
begin
  if (select auth.uid()) is null then
    raise exception 'Entre na sua conta para cancelar o pedido';
  end if;

  select * into v_order
  from public.orders
  where id = p_order and user_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'Pedido não encontrado';
  end if;

  if v_order.status = 'recebido' then
    raise exception 'Este pedido já foi confirmado como recebido e não pode mais ser cancelado por aqui';
  end if;

  if v_order.status = 'cancelado' then
    return to_jsonb(v_order);
  end if;

  select * into v_state
  from private.checkout_state
  where order_id = p_order
  for update;
  v_has_checkout := found;

  if v_has_checkout then
    -- Somente pedidos ainda não preparados podem devolver automaticamente
    -- a reserva ao estoque. Depois da preparação/envio, a peça pode já estar
    -- fora da loja e a reposição precisa de conferência física.
    if v_state.stock_applied and v_order.status = 'pagamento_aprovado' then
      update public.product_sizes s
      set estoque = s.estoque + r.quantity
      from private.stock_reservations r
      where r.order_id = p_order and r.size_id = s.id;

      update public.products p
      set vendas_total = greatest(0, coalesce(p.vendas_total, 0) - sold.quantity)
      from (
        select product_id, sum(quantidade)::integer as quantity
        from public.order_items
        where order_id = p_order
        group by product_id
      ) sold
      where p.id = sold.product_id;
    end if;

    update private.stock_reservations
    set active = false
    where order_id = p_order;
  end if;

  update public.orders
  set status = 'cancelado',
      cancelled_at = now(),
      cancelled_by = (select auth.uid()),
      cancel_reason = nullif(v_reason, '')
  where id = p_order
  returning * into v_order;

  return to_jsonb(v_order);
end;
$$;

revoke all on function public.horizon_cancel_my_order(uuid, text) from public, anon;
grant execute on function public.horizon_cancel_my_order(uuid, text) to authenticated;

comment on column public.orders.cancelled_at is 'Data e hora em que o cliente ou a administração cancelou o pedido.';
comment on column public.orders.cancelled_by is 'Usuário autenticado que solicitou o cancelamento.';
comment on column public.orders.cancel_reason is 'Motivo informado no cancelamento, quando disponível.';

commit;