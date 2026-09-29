-- Estoque inicial da vitrine Horizon Wear.
-- Cada variação ativa que ainda está em zero recebe 12 unidades para permitir
-- navegação e simulação de compra. Ajuste os números reais pelo administrador.
begin;

update public.product_sizes ps
set estoque = 12
from public.products p
where p.id = ps.product_id
  and p.ativo is true
  and ps.estoque = 0;

do $$ begin
  if exists (
    select 1
    from public.product_sizes ps
    join public.products p on p.id = ps.product_id
    where p.ativo is true and ps.estoque < 1
  ) then
    raise exception 'Há variação ativa sem estoque inicial';
  end if;
end $$;

select count(*) as variacoes_com_estoque
from public.product_sizes ps
join public.products p on p.id = ps.product_id
where p.ativo is true and ps.estoque > 0;

commit;
