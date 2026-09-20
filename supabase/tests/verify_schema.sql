-- Executar após a migração. Revisão de estrutura sem alterar dados.
select tablename, rowsecurity from pg_tables where schemaname='public'
and tablename in ('profiles','addresses','products','product_variants','product_images','categories','cart','cart_items','orders','order_items','payments','coupons','reviews')
order by tablename;
select tablename,policyname,roles,cmd,qual,with_check from pg_policies
where schemaname='public' order by tablename,policyname;
select conrelid::regclass as tabela,conname,pg_get_constraintdef(oid) as regra
from pg_constraint where connamespace='public'::regnamespace and contype in ('f','c','u')
order by conrelid::regclass::text,conname;
select table_name,grantee,privilege_type from information_schema.role_table_grants
where table_schema='public' and grantee in ('anon','authenticated') order by table_name,grantee;
