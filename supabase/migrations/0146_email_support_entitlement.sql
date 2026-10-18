-- =============================================================================
-- 0146_email_support_entitlement.sql
-- Starter ($39): no email product features.
-- Enterprise ($59): email_support + transcripts_certificates (matches plan card).
-- =============================================================================

update public.platform_plans
set
  entitlements = '{}'::jsonb,
  updated_at = now()
where slug = 'starter';

update public.platform_plans
set
  entitlements = jsonb_build_object(
    'transcripts_certificates', true,
    'email_support', true
  ),
  updated_at = now()
where slug = 'enterprise';

-- Merge email_support onto any plan that already has transcripts_certificates
-- (keeps custom super-admin plan edits consistent with the Enterprise card).
update public.platform_plans
set
  entitlements = coalesce(entitlements, '{}'::jsonb) || '{"email_support": true}'::jsonb,
  updated_at = now()
where (entitlements -> 'transcripts_certificates') = 'true'::jsonb
  and coalesce((entitlements -> 'email_support') = 'true'::jsonb, false) = false;
