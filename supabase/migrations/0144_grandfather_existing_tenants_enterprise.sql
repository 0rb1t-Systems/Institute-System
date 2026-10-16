-- =============================================================================
-- 0144_grandfather_existing_tenants_enterprise.sql
-- Existing institutions keep the full package (Enterprise entitlements).
-- New tenants created after this migration must buy/choose a plan as usual —
-- they are NOT auto-granted Enterprise.
-- =============================================================================

do $$
declare
  v_enterprise uuid;
  v_n int;
begin
  select id into v_enterprise
  from public.platform_plans
  where slug = 'enterprise'
  limit 1;

  if v_enterprise is null then
    raise exception 'Enterprise plan (slug=enterprise) is missing';
  end if;

  -- Upsert every institution that exists at cutover onto Enterprise (active).
  insert into public.tenant_subscriptions (
    institution_id,
    plan_id,
    status,
    billing_cycle,
    started_at,
    notes,
    updated_at
  )
  select
    i.id,
    v_enterprise,
    'active',
    'monthly',
    now(),
    'Grandfathered full package (pre-plans cutover) — treated as Enterprise $59.',
    now()
  from public.institutions i
  on conflict (institution_id) do update
  set
    plan_id = excluded.plan_id,
    status = 'active',
    notes = coalesce(
      nullif(trim(public.tenant_subscriptions.notes), ''),
      excluded.notes
    ),
    updated_at = now();

  get diagnostics v_n = row_count;
  raise notice 'Grandfathered % institution subscription(s) onto Enterprise', v_n;
end $$;
