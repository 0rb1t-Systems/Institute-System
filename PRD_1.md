# Product Requirements Document

**Product:** Training Center Management Platform (multi-tenant SaaS)
**Version:** 1.0
**Status:** Ready for development

---

## 1. Overview

The product is a multi-tenant SaaS platform for short-course and diploma training centers to manage the full student lifecycle: registration, class assignment, attendance, payments, grading, and certification. Each institution operates as an isolated tenant with its own branded public page, data, and users.

The platform is not designed for universities or multi-campus institutions with complex curricula. It targets small-to-mid-size training centers offering short courses and diploma programs.

## 2. User Roles

| Role | Description |
|---|---|
| Admin | Institution owner/director. Full access to their tenant. |
| Staff | Operational users. Handle registration, attendance, finance, and class/course management under admin oversight. |
| Instructor | Assigned to specific classes. Manages attendance, grading, and assignments for their own classes; views own earnings. |
| Student | End learner. Views own classes, fees, attendance, results, and certificates. |
| Public | Unauthenticated visitor. Can submit a registration inquiry and verify certificates. |

## 3. Data Model

**Course**
- Atomic unit of curriculum content.
- Fields: name, code, type (`regular` | `e-learning`), diploma reference (nullable).
- Can exist standalone or as part of a Diploma.

**Diploma**
- A named bundle of one or more Courses.
- Fields: name, description.
- Carries no schedule, price, or duration — those are defined at the Class level.

**Class**
- The scheduled, priced, sellable entity.
- References either a single Course or a Diploma (`program_type`: `course` | `diploma`).
- Fields: name, instructor (FK), start month, end month, duration, total fee, status (active/inactive).
- Students enroll into Classes, not Courses or Diplomas directly.

**Creation dependency order:** Course → (optional) Diploma → Class → Student Enrollment.

## 4. Core Features

### 4.1 Student Management
- Registration and approval workflow.
- Single combined registration form: student profile, affiliate attribution (optional), and initial class enrollment (optional) captured in one submission.
- Bulk import via column-mapping wizard: admin uploads a CSV/XLSX file, maps source columns to system fields (auto-suggested where headers match, manual override otherwise), previews mapped rows, and commits the import.

### 4.2 Academic Operations
- Course, Diploma, and Class CRUD.
- Student-to-class assignment.
- Attendance marking per class session.
- Assignments (distinct from Exams — separate creation, submission, and grading workflow).
- Exams and grading.
- Gradebook (per-course final marks, synced to student transcripts).

### 4.3 Finance
- Fee tracking, payment recording, and outstanding balance calculation per student per class.
- Instructor settlements: commission-based, calculated as a configurable percentage of each individual student payment, accumulating into a withdrawable balance per instructor. Not a flat rate or periodic payout.
- Instructor withdrawal request flow.

### 4.4 Certificates & Documents
- Certificate, transcript, and invoice generation.
- Per-institution template customization (logo, layout, signature block) — not a fixed system-wide template.
- Public certificate verification via a unique link, accessible without authentication.

### 4.5 Reporting
Reports Center with the following views: Fees/Finance, Revenue, Settlement, Attendance, Exams, Academic/Transcripts, Certificates, Affiliate System. Accessible to Admin and Staff roles only.

### 4.6 Affiliate/Referral System
- Attribution of a student registration to a referring affiliate.
- Affiliate-linked reporting.

### 4.7 Notifications (v1: Email Only)
Transactional email via Resend, triggered on:
- Student registration (login credentials delivered by email)
- Payment due / overdue
- Instructor settlement processed
- Certificate issued

SMS and WhatsApp are out of scope for v1.

### 4.8 Public-Facing Pages
Each tenant has a branded public page including:
- Institution name, logo, description (editable by Admin)
- Portal login entry point
- Certificate verification tool
- Public registration inquiry form

## 5. Permission Matrix

`V` = View, `C` = Create, `E` = Edit, `D` = Delete, `—` = No access, `Own` = scoped to the user's own records

| Feature | Admin | Staff | Instructor | Student | Public |
|---|---|---|---|---|---|
| Student registration & approval | V/C/E/D | V/C/E | — | — | Submit only |
| Course/Diploma/Class management | V/C/E/D | V/C/E/D | — | — | — |
| Student-to-class assignment | V/C/E/D | V/C/E | — | — | — |
| Attendance | V/E | V/E | Own classes: V/E | — | — |
| Attendance reports | V | V | Own classes: V | Own: V | — |
| Fees, payments, balances | V/C/E/D | V/C/E | Own earnings: V | Own: V | — |
| Instructor settlements | V/C/E/D | — | Own: V | — | — |
| Assignments | V/C/E | V/C/E | Own classes: V/C/E | Own: V | — |
| Exams & grading | V/C/E | V/C/E | Own classes: V/C/E | — | — |
| Gradebook | V/C/E | V/C/E | Own classes: V/E | Own: V | — |
| Certificates/transcripts (incl. templates) | V/C/D | V/C | — | Own: V | — |
| Certificate verification | V | V | — | Own: V | V |
| Reports Center | V | V | — | — | — |
| Affiliate system | V/C/E/D | V/C/E | — | — | — |
| Staff/instructor account management | V/C/E/D | — | — | — | — |
| Institution settings & branding | V/E | — | — | — | — |
| Tenant billing/subscription | V/E | — | — | — | — |
| ID cards (shared: students + instructors) | V/C/E/D | V/C | Own: V | Own: V | — |
| Bulk data import | V/C | V/C | — | — | — |

## 6. Non-Functional Requirements

- **Multi-tenancy:** strict data isolation between tenants at the database layer (not application-layer filtering alone).
- **Authorization:** every role/permission combination in Section 5 must be enforced server-side.
- **Payments:** WaafiPay integration for tenant subscription billing and in-app student fee collection (if possible).
- **Availability:** standard SaaS uptime expectations; no specific SLA defined for v1.
- **Localization:** primary market is Somalia; no multi-language requirement for v1.

## 7. Out of Scope (v1)

- University/multi-campus features (semester credit systems, prerequisite chains).
- General-purpose LMS functionality (video hosting, course authoring).
- Public institution marketplace/discovery.
- Instructor rating/review system.
- Separate instructor ID card system (instructors use the same ID system as students).
- SMS and WhatsApp notifications.
- Custom domain support (tenant subdomains only for v1; see Technical Architecture).

## 8. Success Metrics

- New tenant completes registration → class assignment → attendance → payment recording within their first session.
- Tenant shows attendance or payment activity at least weekly by week 2 post-onboarding.
