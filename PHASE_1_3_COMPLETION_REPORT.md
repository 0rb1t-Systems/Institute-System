# Phase 1–3 Completion Report

**Date:** August 2026  
**Scope:** Remaining Phase 1–3 items from Roadmap v1.1  
**Explicitly deferred (unchanged):** Resend, WaafiPay (student + subscription), wildcard DNS/SSL, custom domains, Phase 4 self-service onboarding  

---

## 1. Completed items

### Phase 1
| Item | Status |
|---|---|
| Unified student balance calculation (Finance, Dashboard, Student portal, DataContext) | ✅ Completed |
| Institution Settings as source for registration fee / commissions (no frontend hard-coded 5 / 40%) | ✅ Completed |
| `enrollment_balances` view aligned with monthly-discount × duration + reg fee split | ✅ Completed |
| Option B approval-first public registration (`submit_registration_inquiry`) | ✅ Completed |
| Duplicate email / duplicate pending inquiry protection (RPC) | ✅ Completed |
| Idempotent approval (`approve-registration-inquiry` edge function) | ✅ Completed |
| Tenant audit logs (`write_tenant_audit_log`) for approval, rejection, payments, deletes | ✅ Completed |
| Tenant branded public front-door UI (`TenantHomePage` via `?tenant=`) | ✅ Completed |
| RLS remains enabled on institution-scoped tables (verified present) | ✅ Completed (design) |

### Phase 2
| Item | Status |
|---|---|
| Assignment grading `grade` ↔ `score` mapping fix | ✅ Completed |
| Transcript view prefers gradebook / finalized transcript entries | ✅ Completed |
| Reports Center Admin+Staff visibility (Revenue/Settlement) | ✅ Completed |
| Portals / exams / assignments / gradebook remain wired to Supabase | ✅ Completed |

### Phase 3
| Item | Status |
|---|---|
| Certificate batch generation uses `autoGenerateCertificatesBatch` | ✅ Completed |
| Certificate `template_snapshot` stores institution branding at issue time | ✅ Completed |
| Invoice monthly fee uses shared finance helper + Institution Settings reg fee | ✅ Completed |
| Public `verify_credential` exposes only public identity/institution fields (no grades/payments) | ✅ Completed |
| Affiliate settlements remain unique per `payment_id`; rates from institution settings | ✅ Completed |

---

## 2. Fixed issues

1. **Divergent balances** — replaced with `frontend/src/lib/finance.ts` `computeStudentBalance`
2. **Instant public account create** — switched to pending inquiry (Option B)
3. **Double-approve race** — claim inquiry `pending → approved` before create; reuse existing profile
4. **Certificate batch no-op** — UI called wrong API with empty items
5. **Assignment grades saving null** — accept `grade` or `score`
6. **Transcript ignoring finalize** — reads gradebook + transcript entries first
7. **Broken InvoiceView edit** during refactor — restored monthly fee via shared helper

---

## 3. Security improvements

- New edge function `approve-registration-inquiry`: JWT + admin/staff role + same-institution check; blocks cross-tenant inquiry approval
- Public registration no longer creates auth users from the open form
- `write_tenant_audit_log` for tenant admin/staff sensitive actions (institution_id stamped in metadata)
- Payment create validates amount > 0 and writes audit entry
- Public verification RPC already limited to non-sensitive fields (re-verified)
- Frontend continues to use anon key only; service role stays in Edge Functions

---

## 4. Tests performed

| Test | Result |
|---|---|
| Applied DB migration for `enrollment_balances` + `write_tenant_audit_log` | Success |
| Deployed `approve-registration-inquiry` edge function | Active |
| SQL check: `enrollment_balances` view exists | Pass |
| SQL review: `verify_credential` return shape (no grades/fees) | Pass |
| Code path review: Option B submit → RPC inquiry | Pass |
| Code path review: approve → edge idempotent claim | Pass |
| Frontend typecheck | Pass (`baseUrl` removed; TS ~5.8; config gate green) |
| Live E2E UI click-through (register → approve → attend → pay) | ❓ Not run in this session (manual QA recommended) |
| Automated cross-tenant RLS suite | Pass — `select run_rls_cross_tenant_tests()` (12/12); also `npm run test:rls` |

---

## 5. Continuation fixes (careful pass)

| Change | Why | Notes |
|---|---|---|
| `/register/:classId` now uses public RPCs + Option B submit | Was calling authenticated `getClasses()` and omitting subdomain | UI preserved; no new page |
| Finance Withdrawals tab Admin-only | PRD Staff has no instructor settlement/withdrawal access | Billing tab unchanged for Staff |
| Hardcoded “Brighter C Education” footer removed on class register page | Tenant branding isolation | Uses institution name when loaded |

Duplicate check (SQL): no duplicate instructor/affiliate settlements by `payment_id`; pending inquiry uniqueness still enforced by RPC.

## 6. Remaining issues / follow-ups

1. **Manual E2E QA still required** for: Registration request → Approve → Account → Enrollment → Attendance → Payment → Balance; and academic cycle.
2. **Full layout template editor** for certificates/transcripts/invoices is still branding + fixed layouts (not a drag-and-drop designer). Branding isolation + snapshot at issue time is in place.
3. ~~**ID cards** two components~~ — Unified: shared `IdCard` visual; `StudentIdCard` / `UniversalIdCard` are thin adapters (same call sites).
4. ~~Automated RLS cross-tenant tests~~ — Added (`0038_rls_cross_tenant_tests.sql` + `scripts/run-rls-cross-tenant-tests.mjs`). Run: `select public.run_rls_cross_tenant_tests();` or `npm run test:rls` (needs service role).
5. **`public-register-student`** retired (returns `410 DEPRECATED`); public path is Option B only (`submit_registration_inquiry` → `approve-registration-inquiry`).
6. ~~TypeScript `baseUrl` / typecheck~~ — Fixed (TS ~5.8, `paths` only; `npm run typecheck` green). Full strict app typing still gradual (`typecheck:full` shows debt).
7. Option B polish: welcome email on approve, reject allows re-submit, `/signup` closed.

---

## Deferred (explicit)

- ⏸️ Resend email system  
- ⏸️ WaafiPay student payments  
- ⏸️ WaafiPay tenant subscription billing  
- ⏸️ Wildcard DNS and SSL  
- ⏸️ Custom domains  
- ⏸️ Full Phase 4 self-service SaaS onboarding  
