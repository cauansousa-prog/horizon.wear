begin;
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.horizon_create_order(uuid,jsonb,jsonb,uuid,text,text,text,numeric)'::regprocedure
  ) into v_definition;

  if position('''recebido''' in v_definition) = 0 then
    raise exception 'Não foi encontrada a atribuição antiga de status em horizon_create_order';
  end if;

  v_definition := replace(v_definition, '''recebido''', '''aguardando_pagamento''');
  execute v_definition;
end;
$$;
commit;