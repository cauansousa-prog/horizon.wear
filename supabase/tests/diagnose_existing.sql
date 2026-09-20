-- Somente leitura. Não retorna registros de clientes nem credenciais.
-- Execute no SQL Editor com a função postgres.
select jsonb_build_object(
 'columns', (select jsonb_agg(to_jsonb(c)) from (
   select table_name,column_name,data_type,is_nullable,column_default
   from information_schema.columns where table_schema='public'
   and table_name in ('profiles','addresses','categories','products','product_images','product_variants','cart','cart_items','orders','order_items','payments','coupons','reviews')
   order by table_name,ordinal_position
 ) c),
 'policies', (select jsonb_agg(to_jsonb(p)) from (
   select schemaname,tablename,policyname,roles,cmd,qual,with_check
   from pg_policies where schemaname in ('public','private')
 ) p),
 'constraints', (select jsonb_agg(to_jsonb(k)) from (
   select conrelid::regclass::text as table_name,conname,pg_get_constraintdef(oid) as definition
   from pg_constraint where connamespace='public'::regnamespace
 ) k),
 'rls', (select jsonb_agg(to_jsonb(t)) from (
   select tablename,rowsecurity from pg_tables where schemaname='public'
 ) t)
) as diagnosis;
