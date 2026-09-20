-- Somente banco de desenvolvimento. Todas as inserções são revertidas.
begin;
insert into auth.users(id) values
 ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa1'),('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa2');
insert into public.cart(id,user_id) values
 ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbb1','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa1'),
 ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbb2','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa2');
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa1',true);
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa1","role":"authenticated"}',true);
do $$ begin
 if (select count(*) from public.profiles)<>1 then raise exception 'Perfis: isolamento falhou'; end if;
 if (select count(*) from public.cart)<>1 then raise exception 'Carrinhos: isolamento falhou'; end if;
 if private.is_admin() then raise exception 'Cliente recebeu papel administrativo'; end if;
 begin
  insert into public.cart(user_id) values('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa2');
  raise exception 'Escrita cruzada aceita';
 exception when insufficient_privilege then null; end;
 begin
  insert into private.admin_users(user_id) values('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa1');
  raise exception 'Escalada administrativa aceita';
 exception when insufficient_privilege then null; end;
 if has_table_privilege('authenticated','public.orders','INSERT') then raise exception 'Cliente pode criar pedidos diretamente'; end if;
 if has_table_privilege('authenticated','public.payments','UPDATE') then raise exception 'Cliente pode alterar pagamentos'; end if;
end $$;
set local role anon;
do $$ begin
 begin
  perform * from public.profiles;
  raise exception 'Anônimo pode ler perfis';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
