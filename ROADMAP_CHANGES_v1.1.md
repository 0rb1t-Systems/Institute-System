# What Changed from Roadmap v1.0

**Product:** Training Center Management Platform (multi-tenant SaaS)  
**Document type:** Roadmap change log  
**From:** Roadmap Version 1.0  
**To:** Roadmap Version 1.1  
**Date:** August 2026  

---

## 1. Purpose

This document explains what changed between the original Project Roadmap (v1.0) and the revised Roadmap (v1.1).

v1.1 was created after a full project audit. It reflects:

- What is already built in the system
- What was implemented differently from the original plan
- What is deferred for later (Resend, WaafiPay, domain, Phase 4)
- What still remains for Phase 1, Phase 2, and Phase 3

---

## 2. Summary of Changes

| Area | Roadmap v1.0 | Roadmap v1.1 | Why it changed |
|---|---|---|---|
| Tenant column name | `tenant_id` on all tenant-scoped tables | `institution_id` (tenant = institution) | Already implemented this way in database and app |
| Email notifications | Resend for 4 PRD triggers | Deferred | Postponed by product decision |
| Student payments | WaafiPay payment integration (test) | Deferred | Postponed by product decision |
| Domain / DNS / SSL | Wildcard DNS/SSL + subdomain routing | Deferred | No domain available yet |
| Custom domains | Phase 4 CNAME support | Deferred | Part of deferred Phase 4 |
| Phase 4 SaaS billing | Active roadmap phase | Deferred | Focus is closing Phase 1–3 first |
| Student registration | Registration and approval workflow | Clarified: instant public create (current) and/or inquiry approval | System currently creates live accounts immediately |
| User roles | 5 roles only (Admin, Staff, Instructor, Student, Public) | Same 5 roles + documented extras: `super_admin`, `affiliate` | Extra roles already exist in production |
| Super Admin platform | Not listed | Added as official Platform Ops scope | Built outside original roadmap |
| Remaining hardening work | Not listed clearly | Added: balance fix, registration cleanup, cert batch bug, RLS tests, templates, reports polish | Found during audit |

---

## 3. Changes by Topic

### 3.1 Multi-tenancy naming

**v1.0 said:**  
Use `tenant_id` on all tenant-scoped tables with RLS.

**v1.1 says:**  
Use `institution_id`. The institution is the tenant.

**Status:** Already implemented. No rename required for current delivery.

---

### 3.2 Email (Resend)

**v1.0 said:**  
Email notification system via Resend for four v1 triggers:

1. Student registration (login credentials)
2. Payment due / overdue
3. Instructor settlement processed
4. Certificate issued

**v1.1 says:**  
Deferred. Not part of the current Phase 1–3 execution queue.

**Current system note:**  
Some email behavior exists via EmailJS (mainly welcome email / limited reminders). This is not treated as completing the Resend roadmap item.

---

### 3.3 WaafiPay

**v1.0 said:**  
WaafiPay payment integration (test) in Phase 1.  
Tenant subscription billing via WaafiPay in Phase 4.

**v1.1 says:**  
Both are deferred.

**Current system note:**  
A WaafiPay edge function scaffold exists, but it is not the current delivery focus. Finance continues with manual payment recording (cash/bank/other).

---

### 3.4 Domain, DNS, SSL, and custom domains

**v1.0 said:**  
Phase 1 includes subdomain assignment, wildcard DNS/SSL routing, and branded public front-door page.  
Phase 4 includes custom domain (CNAME) support.

**v1.1 says:**  
- DNS / SSL / custom domains = deferred  
- Tenant branded front-door page remains in Phase 1 as **UI only** (works with `?tenant=` / local host, no real domain required)

---

### 3.5 Phase 4

**v1.0 said:**  
Phase 4 is active scope:

- Tenant subscription billing via WaafiPay
- Self-service tenant onboarding
- Plan/tier limits
- Custom domains

**v1.1 says:**  
Phase 4 is deferred as a whole.

**Current system note:**  
Super Admin can manually create tenants and manage plan records. Self-service paid onboarding is not done.

---

### 3.6 Student registration and approval

**v1.0 said:**  
Student registration and approval using a combined registration / affiliate / class-enrollment form.

**v1.1 clarification:**  
The live system currently creates a student account immediately from the public registration form.

A product decision is still required:

- **Option A — Instant create (current):** public form creates the student account immediately  
- **Option B — Approval-first:** public form creates a pending inquiry; Admin/Staff approve before account creation

Until that decision is locked, registration cleanup remains a Phase 1 remaining item.

---

### 3.7 Roles

**v1.0 said:**  
Five roles: Admin, Staff, Instructor, Student, Public.

**v1.1 says:**  
Keep the original five roles as the product permission baseline, and officially document two extras already in the system:

- `super_admin` — platform owner
- `affiliate` — referral / commission role

---

### 3.8 Features added to the official roadmap

These existed in the system but were not listed in Roadmap v1.0. v1.1 adds them under **Platform Ops (Super Admin)**:

- Super Admin dashboard
- Tenant management
- Tenant admin management
- Plans catalog and manual subscription assignment
- Platform analytics / revenue views
- Support tickets
- Audit logs
- Platform settings

---

## 4. Phase 1–3 execution status (updated)

| # | Item | Phase | Status |
|---|---|---|---|
| 1 | Unified balance calculation | Phase 1 | ✅ Completed |
| 2 | Option B approval-first registration + idempotent approve + duplicate email | Phase 1 | ✅ Completed |
| 3 | Certificate batch bug fix | Phase 3 | ✅ Completed |
| 4 | Cross-tenant RLS verification + automated suite | Phase 1 | ✅ Completed (12/12 via `run_rls_cross_tenant_tests`) |
| 5 | Tenant branded front-door page — UI only | Phase 1 | ✅ Completed |
| 6 | Invoice + certificate/transcript branding templates + snapshot | Phase 3 | ✅ Completed (branding; full layout editor not required for close) |
| 7 | Reports permission polish + academic data wiring | Phase 2 | ✅ Completed |
| — | Assignment `grade`/`score` fix | Phase 2 | ✅ Completed |
| — | Transcript prefers gradebook/finalized entries | Phase 2 | ✅ Completed |
| — | Tenant audit logs for sensitive actions | Phase 1 | ✅ Completed |

See also: `PHASE_1_3_COMPLETION_REPORT.md`

---

## 5. Explicitly Out of Current Scope

Do not treat these as current Phase 1–3 delivery items:

- Resend email system
- WaafiPay student payments
- WaafiPay tenant subscription billing
- Wildcard DNS / SSL
- Custom domains
- Full Phase 4 self-service SaaS onboarding

---

## 6. Related Documents

- Original requirements: `PRD_1.md`
- Original roadmap source: Project Roadmap v1.0 (provided by product owner)
- This change log: `ROADMAP_CHANGES_v1.1.md`

---

## 7. Short Conclusion

Roadmap v1.1 does not restart the project. It updates the plan to match reality:

- Keep what is already built
- Rename/clarify what was implemented differently
- Defer email, payments gateway, domain, and Phase 4
- Finish the remaining Phase 1–3 correctness and trust items first
