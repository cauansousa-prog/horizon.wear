-- Somente para o esquema existente documentado em INSPECAO_EXISTENTE.md.
begin;
create schema if not exists private;
alter table public.order_items add column if not exists product_size_id uuid references public.product_sizes(id);
alter table public.orders add column if not exists review_required boolean not null default false;
create unique index if not exists horizon_payment_provider_id on public.payments(mercadopago_payment_id);
alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check
 check (status in ('pending','in_process','authorized','approved','rejected','cancelled','refunded','charged_back'));
create table if not exists private.checkout_state (
 order_id uuid primary key references public.orders(id),
 request_key uuid not null unique,
 request_hash text not null,
 guest_hash text not null,
 method text not null,
 stock_applied boolean not null default false,
 payment_id text unique,
 review_required boolean not null default false
);
create table if not exists private.stock_reservations (
 order_id uuid not null references public.orders(id),
 size_id uuid not null references public.product_sizes(id),
 quantity integer not null check(quantity>0),
 active boolean not null default true,
 expires_at timestamptz not null default (now()+interval '14 days'),
 primary key(order_id,size_id)
);
alter table private.stock_reservations add column if not exists expires_at timestamptz not null default (now()+interval '14 days');
revoke all on private.checkout_state,private.stock_reservations from public,anon,authenticated;
alter table private.checkout_state enable row level security;
alter table private.stock_reservations enable row level security;

create or replace function public.horizon_create_order(p_user uuid,p_customer jsonb,p_items jsonb,p_key uuid,p_hash text,p_guest_hash text,p_method text,p_shipping numeric)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_old private.checkout_state; v_line record; v_size public.product_sizes; v_product public.products; v_reserved integer; v_total numeric:=0; v_price numeric;
begin
 if p_shipping<0 or p_shipping is null or p_method not in ('pix','cartao','boleto') or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>100 then raise exception 'Pedido inválido'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_key::text,0));
 select * into v_old from private.checkout_state where request_key=p_key;
 if found then
  if v_old.request_hash<>p_hash or v_old.guest_hash<>p_guest_hash then raise exception 'Chave reutilizada para outro pedido'; end if;
  return (select to_jsonb(o) from public.orders o where id=v_old.order_id);
 end if;
 -- Bloqueios em ordem estável para compras concorrentes.
 for v_line in select (value->>'size_id')::uuid as size_id,sum((value->>'quantity')::integer) as quantity from jsonb_array_elements(p_items) group by 1 order by 1 loop
  if v_line.quantity<1 or v_line.quantity>99 then raise exception 'Quantidade inválida'; end if;
  select * into v_size from public.product_sizes where id=v_line.size_id for update;
  if not found then raise exception 'Tamanho indisponível'; end if;
  select * into v_product from public.products where id=v_size.product_id and ativo for share;
  if not found then raise exception 'Produto indisponível'; end if;
  select coalesce(sum(quantity),0) into v_reserved from private.stock_reservations where size_id=v_size.id and active and expires_at>now();
  if v_size.estoque-v_reserved<v_line.quantity then raise exception 'Estoque indisponível'; end if;
  v_price=coalesce(v_product.preco_promocional,v_product.preco);
  if v_price<=0 then raise exception 'Preço inválido'; end if;
  v_total=v_total+v_price*v_line.quantity;
 end loop;
 insert into public.orders(user_id,nome_cliente,email_cliente,cpf_cliente,telefone_cliente,endereco,subtotal,frete,desconto,total,status)
 values(p_user,p_customer->>'name',p_customer->>'email',p_customer->>'cpf',p_customer->>'phone',p_customer->'address',v_total,p_shipping,0,v_total+p_shipping,'recebido') returning id into v_id;
 insert into private.checkout_state(order_id,request_key,request_hash,guest_hash,method) values(v_id,p_key,p_hash,p_guest_hash,p_method);
 for v_line in select (value->>'size_id')::uuid as size_id,sum((value->>'quantity')::integer) as quantity from jsonb_array_elements(p_items) group by 1 order by 1 loop
  select * into v_size from public.product_sizes where id=v_line.size_id;
  select * into v_product from public.products where id=v_size.product_id;
  insert into public.order_items(order_id,product_id,product_size_id,nome_produto,tamanho,preco_unitario,quantidade)
  values(v_id,v_product.id,v_size.id,v_product.nome,v_size.tamanho,coalesce(v_product.preco_promocional,v_product.preco),v_line.quantity);
  insert into private.stock_reservations(order_id,size_id,quantity,expires_at)
  values(v_id,v_size.id,v_line.quantity,now()+(case when p_method='boleto' then interval '14 days' else interval '2 days' end));
 end loop;
 return (select to_jsonb(o) from public.orders o where id=v_id);
end; $$;

create or replace function public.horizon_get_checkout(p_order uuid,p_guest_hash text)
returns jsonb language sql security definer set search_path='' as $$
 select to_jsonb(o)||jsonb_build_object('payment_id',s.payment_id,'review_required',s.review_required)
 from public.orders o join private.checkout_state s on s.order_id=o.id
 where o.id=p_order and s.guest_hash=p_guest_hash;
$$;

create or replace function public.horizon_apply_payment(p_order uuid,p_payment_id text,p_status text,p_amount numeric,p_details jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare v_state private.checkout_state; v_order public.orders; v_line record; v_available integer; v_reserved integer; v_status text; v_stock_ok boolean:=true;
begin
 select * into v_state from private.checkout_state where order_id=p_order for update;
 if not found then raise exception 'Checkout não encontrado'; end if;
 select * into v_order from public.orders where id=p_order for update;
 if p_amount<>v_order.total then raise exception 'Valor divergente'; end if;
 if v_state.payment_id is not null and v_state.payment_id<>p_payment_id then raise exception 'Pagamento divergente'; end if;
 v_status=case when p_status in ('approved','rejected','cancelled','refunded','charged_back','in_process','authorized') then p_status else 'pending' end;
 if v_state.stock_applied and v_status in ('pending','rejected','cancelled') then return; end if;
 if v_status='approved' and not v_state.stock_applied then
  for v_line in select * from private.stock_reservations where order_id=p_order order by size_id loop
   select estoque into v_available from public.product_sizes where id=v_line.size_id for update;
   select coalesce(sum(quantity),0) into v_reserved from private.stock_reservations
   where size_id=v_line.size_id and order_id<>p_order and active and expires_at>now();
   if not v_line.active or v_available-v_reserved<v_line.quantity then v_stock_ok=false; end if;
  end loop;
  if v_stock_ok then
   for v_line in select * from private.stock_reservations where order_id=p_order order by size_id loop
    update public.product_sizes set estoque=estoque-v_line.quantity where id=v_line.size_id;
   end loop;
   update public.products p set vendas_total=coalesce(p.vendas_total,0)+i.quantity from (select product_id,sum(quantidade)::integer as quantity from public.order_items where order_id=p_order group by product_id) i where p.id=i.product_id;
   update private.checkout_state set stock_applied=true,review_required=false where order_id=p_order;
   update public.orders set status='pagamento_aprovado',review_required=false where id=p_order;
  else
   update private.checkout_state set review_required=true where order_id=p_order;
   update public.orders set review_required=true where id=p_order;
  end if;
 end if;
 if v_status in ('approved','rejected','cancelled','refunded','charged_back') then update private.stock_reservations set active=false where order_id=p_order; end if;
 if v_status in ('rejected','cancelled') and not v_state.stock_applied then update public.orders set status='cancelado' where id=p_order; end if;
 if v_status in ('refunded','charged_back') then update public.orders set status='cancelado' where id=p_order; end if;
 update private.checkout_state set payment_id=p_payment_id where order_id=p_order;
 insert into public.payments(order_id,metodo,status,valor,mercadopago_payment_id,qr_code,qr_code_base64,linha_digitavel,boleto_url,parcelas,aprovado_em)
 values(p_order,v_state.method,v_status,p_amount,p_payment_id,p_details->>'qr_code',p_details->>'qr_code_base64',p_details->>'linha_digitavel',p_details->>'boleto_url',coalesce((p_details->>'parcelas')::integer,1),case when v_status='approved' then now() end)
 on conflict(mercadopago_payment_id) do update set status=excluded.status,aprovado_em=coalesce(public.payments.aprovado_em,excluded.aprovado_em);
end; $$;

create or replace function public.horizon_advance_order(p_order uuid,p_target text,p_tracking text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_order public.orders;
begin
 select * into v_order from public.orders where id=p_order for update;
 if not found then raise exception 'Pedido não encontrado'; end if;
 if v_order.review_required or
    (v_order.status='pagamento_aprovado' and p_target<>'preparando') or
    (v_order.status='preparando' and p_target<>'enviado') or
    (v_order.status='enviado' and p_target<>'entregue') or
    v_order.status not in ('pagamento_aprovado','preparando','enviado') then
   raise exception 'Transição inválida';
 end if;
 if p_target='enviado' and nullif(trim(p_tracking),'') is null then raise exception 'Rastreio obrigatório'; end if;
 update public.orders set status=p_target,
  rastreio=coalesce(nullif(left(trim(coalesce(p_tracking,'')),120),''),v_order.rastreio)
 where id=p_order;
 return (select to_jsonb(o) from public.orders o where id=p_order);
end; $$;

revoke all on function public.horizon_create_order(uuid,jsonb,jsonb,uuid,text,text,text,numeric) from public,anon,authenticated;
revoke all on function public.horizon_get_checkout(uuid,text) from public,anon,authenticated;
revoke all on function public.horizon_apply_payment(uuid,text,text,numeric,jsonb) from public,anon,authenticated;
revoke all on function public.horizon_advance_order(uuid,text,text) from public,anon,authenticated;
grant execute on function public.horizon_create_order(uuid,jsonb,jsonb,uuid,text,text,text,numeric), public.horizon_get_checkout(uuid,text), public.horizon_apply_payment(uuid,text,text,numeric,jsonb), public.horizon_advance_order(uuid,text,text) to service_role;
commit;
