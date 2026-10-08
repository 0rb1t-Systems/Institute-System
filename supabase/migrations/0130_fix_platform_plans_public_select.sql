-- Fix: anon SELECT on platform_plans must not evaluate is_super_admin().
-- Evaluating that function for TO PUBLIC policies fails with permission denied
-- and returns zero rows / errors for the public Plans page.

drop policy if exists "plans_select_super_admin" on public.platform_plans;
create policy "plans_select_super_admin"
  on public.platform_plans for select
  to authenticated
  using (public.is_super_admin());

drop policy if exists "plans_select_active_public" on public.platform_plans;
create policy "plans_select_active_public"
  on public.platform_plans for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "plans_insert_super_admin" on public.platform_plans;
create policy "plans_insert_super_admin"
  on public.platform_plans for insert
  to authenticated
  with check (public.is_super_admin());

drop policy if exists "plans_update_super_admin" on public.platform_plans;
create policy "plans_update_super_admin"
  on public.platform_plans for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "plans_delete_super_admin" on public.platform_plans;
create policy "plans_delete_super_admin"
  on public.platform_plans for delete
  to authenticated
  using (public.is_super_admin());

notify pgrst, 'reload schema';
