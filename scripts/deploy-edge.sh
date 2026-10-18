#!/usr/bin/env bash
set -euo pipefail
REF="${SUPABASE_PROJECT_REF:-jtfgfrmpkbglbxtdfnnk}"

echo "==> Deploying create-user"
npx supabase functions deploy create-user --project-ref "$REF"

echo "==> Deploying approve-registration-inquiry"
npx supabase functions deploy approve-registration-inquiry --project-ref "$REF"

echo "==> Deploying provision-tenant"
npx supabase functions deploy provision-tenant --project-ref "$REF"

echo "==> Deploying create-tenant-admin"
npx supabase functions deploy create-tenant-admin --project-ref "$REF"

echo "Done. Welcome emails use Resend (RESEND_API_KEY + RESEND_FROM_EMAIL)."
