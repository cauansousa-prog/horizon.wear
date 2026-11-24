begin;

-- "recebido" era usado para pedidos recém-criados, antes do pagamento.
-- Preserva cada pedido e identifica como pago apenas quando há pagamento aprovado.
alter table public.orders drop constraint if exists orders_status_check;

update public.orders o
set status = case
  when exists (
    select 1 from public.payments p
    where p.order_id = o.id and p.status = 'approved'
  ) then 'pagamento_aprovado'
  else 'aguardando_pagamento'
end
where o.status = 'recebido';

alter table public.orders
  alter column status set default 'aguardando_pagamento';

alter table public.orders
  add constraint orders_status_check
  check (status in (
    'aguardando_pagamento',
    'pagamento_aprovado',
    'preparando',
    'enviado',
    'entregue',
    'recebido',
    'cancelado'
  ));

create or replace function public.horizon_advance_order(
  p_order uuid,
  p_target text,
  p_tracking text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order
  from public.orders
  where id = p_order
  for update;

  if not found then
    raise exception 'Pedido não encontrado';
  end if;

  if v_order.review_required
     or (v_order.status = 'pagamento_aprovado' and p_target <> 'preparando')
     or (v_order.status = 'preparando' and p_target <> 'enviado')
     or (v_order.status = 'enviado' and p_target <> 'entregue')
     or (v_order.status = 'entregue' and p_target <> 'recebido')
     or v_order.status not in ('pagamento_aprovado', 'preparando', 'enviado', 'entregue') then
    raise exception 'Transição inválida';
  end if;

  if p_target = 'enviado' and nullif(trim(p_tracking), '') is null then
    raise exception 'Rastreio obrigatório';
  end if;

  if p_target not in ('preparando', 'enviado', 'entregue', 'recebido') then
    raise exception 'Etapa inválida';
  end if;

  update public.orders
  set status = p_target,
      rastreio = coalesce(nullif(left(trim(coalesce(p_tracking, '')), 120), ''), v_order.rastreio),
      updated_at = now()
  where id = p_order;

  return (select to_jsonb(o) from public.orders o where id = p_order);
end;
$$;

commit;
