begin;

drop policy if exists store_reviews_public_approved on public.store_reviews;
drop policy if exists store_reviews_own_read on public.store_reviews;
drop policy if exists store_reviews_admin_read on public.store_reviews;
create policy store_reviews_read_access
  on public.store_reviews for select to anon, authenticated
  using (
    approved = true
    or user_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

drop policy if exists store_reviews_own_update on public.store_reviews;
drop policy if exists store_reviews_admin_update on public.store_reviews;
create policy store_reviews_update_access
  on public.store_reviews for update to authenticated
  using (
    (user_id = (select auth.uid()) and approved = false)
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  )
  with check (
    (user_id = (select auth.uid()) and approved = false)
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

create index if not exists orders_cancelled_by_idx
  on public.orders(cancelled_by);

commit;