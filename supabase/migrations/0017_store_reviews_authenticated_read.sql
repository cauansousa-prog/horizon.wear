begin;
revoke select on public.store_reviews from anon;
drop policy if exists store_reviews_read_access on public.store_reviews;
create policy store_reviews_read_access
  on public.store_reviews for select to authenticated
  using (
    approved = true
    or user_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );
commit;