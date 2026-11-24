-- Separa pedidos sem pagamento dos pedidos efetivamente recebidos pelo cliente.
-- Migração incremental: preserva pedidos, pagamentos, estoque e histórico.
begin;

-- O checkout legado cria pedidos com status "recebido". A partir desta migração,
-- esse status passa a representar exclusivamente o recebimento confirmado.
create or replace function public.horizon_normalize_initial_order_status()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if new.status='recebido' then
    new.status='aguardando_pagamento';
  end if;
  return new;
end;
$$;

drop trigger if exists horizon_normalize_initial_order_status on public.orders;
create trigger horizon_normalize_initial_order_status
before insert on public.orders
for each row execute function public.horizon_normalize_initial_order_status();

-- Reclassifica apenas os pedidos que ainda usam o significado antigo de "recebido".
-- Pagamentos aprovados viram "pagamento_aprovado"; sem aprovação ficam aguardando.
update public.orders o
set status=case
  when exists (
    select 1 from public.payments p
    where p.order_id=o.id and p.status='approved'
  ) then 'pagamento_aprovado'
  else 'aguardando_pagamento'
end,
updated_at=now()
where o.status='recebido';

-- Avanço transacional e sequencial: somente entregue pode virar recebido.
create or replace function public.horizon_advance_order(p_order uuid,p_target text,p_tracking text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_order public.orders;
begin
  select * into v_order
  from public.orders
  where id=p_order
  for update;

  if not found then
    raise exception 'Pedido não encontrado';
  end if;

  if v_order.review_required
     or (v_order.status='pagamento_aprovado' and p_target<>'preparando')
     or (v_order.status='preparando' and p_target<>'enviado')
     or (v_order.status='enviado' and p_target<>'entregue')
     or (v_order.status='entregue' and p_target<>'recebido')
     or v_order.status not in ('pagamento_aprovado','preparando','enviado','entregue') then
    raise exception 'Transição inválida';
  end if;

  if p_target='enviado' and nullif(trim(p_tracking),'') is null then
    raise exception 'Rastreio obrigatório';
  end if;

  if p_target not in ('preparando','enviado','entregue','recebido') then
    raise exception 'Situação de pedido inválida';
  end if;

  update public.orders
  set status=p_target,
      rastreio=coalesce(nullif(left(trim(coalesce(p_tracking,'')),120),''),v_order.rastreio),
      updated_at=now()
  where id=p_order;

  return (select to_jsonb(o) from public.orders o where id=p_order);
end;
$$;

commit;
