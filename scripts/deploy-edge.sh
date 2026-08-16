#!/usr/bin/env bash
set -euo pipefail
REF="${SUPABASE_PROJECT_REF:-jtfgfrmpkbglbxtdfnnk}"

echo "==> Deploying create-user"
npx supabase functions deploy create-user --project-ref "$REF"

echo "==> Deploying delete-user"
npx supabase functions deploy delete-user --project-ref "$REF"

echo "Done. Email uses EmailJS from the frontend (VITE_EMAILJS_*)."
