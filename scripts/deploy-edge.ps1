# Deploy Phase 1 Edge Functions
# Prerequisites: `npx supabase login` OR $env:SUPABASE_ACCESS_TOKEN = "sbp_..."

$ErrorActionPreference = "Stop"
$Ref = if ($env:SUPABASE_PROJECT_REF) { $env:SUPABASE_PROJECT_REF } else { "jtfgfrmpkbglbxtdfnnk" }

Write-Host "==> Deploying create-user"
npx supabase functions deploy create-user --project-ref $Ref

Write-Host "==> Deploying delete-user"
npx supabase functions deploy delete-user --project-ref $Ref

Write-Host "==> Deploying provision-tenant"
npx supabase functions deploy provision-tenant --project-ref $Ref

Write-Host "==> Deploying public-provision-tenant"
npx supabase functions deploy public-provision-tenant --project-ref $Ref --no-verify-jwt

Write-Host "==> Deploying create-tenant-admin"
npx supabase functions deploy create-tenant-admin --project-ref $Ref

Write-Host "==> Deploying send-welcome-email"
npx supabase functions deploy send-welcome-email --project-ref $Ref

Write-Host "==> Deploying approve-registration-inquiry"
npx supabase functions deploy approve-registration-inquiry --project-ref $Ref

Write-Host "==> Deploying public-register-student (retired stub)"
npx supabase functions deploy public-register-student --project-ref $Ref --no-verify-jwt

Write-Host "Done. Prefer Resend secrets (RESEND_API_KEY + RESEND_FROM_EMAIL); EmailJS is fallback."
