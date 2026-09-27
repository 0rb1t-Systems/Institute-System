# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: administrators and owners of training centers / TVET institutes who need one system for students, classes, payments, attendance, exams, and certificates.

Secondary: instructors, affiliates, and students who join via each institution’s branded public page. Platform landing (this brief) sells the multi-tenant product to center admins — not students shopping for a school.

## Product Purpose

TvetFlow is a multi-tenant operations platform for training centers. An admin creates an institution, brands a public portal, and runs day-to-day training operations (enrollment, learning, payments, credentials) without a second system. Success = a center can open its portal and manage operations from day one.

## Positioning

Not a generic LMS or university SIS: multi-tenant isolation with per-institution branding, public landing + verify identity, and credentials that match the center’s brand. Mechanism: one platform, many isolated institution portals that look like the center — not like TvetFlow’s marketing site.

## Operating Context

- Public platform marketing site (`WelcomePage`) → create institution / log in / verify identity
- Per-tenant public landings (institution-branded, separate visual system)
- Admin console, instructor and student surfaces already sketched in `design-system.pen`

## Capabilities and Constraints

- Confirmed copy/features on platform landing: hero (run institute / grow impact), create institution CTA, verify identity, trusted logos CMS, workshop/classroom photo grid, 8 feature tiles, 3 setup steps, bottom CTA
- EN + SO language on platform chrome
- Institution landings use a separate template library — must not visually clone the platform marketing site
- Undecided: pricing claims, customer names, benchmarks — do not invent

## Brand Commitments

- Product name: **TvetFlow**
- Binding anti-references (user, 2026-09-26): must not resemble attached ACE/ONE-style corporate SaaS (purple/blue gradients, generic sans, screenshot-beside-text, pill CTAs); must not read as an “institution” / university campus site
- Existing product UI in `design-system.pen` and app tokens lean teal/operational — landing rebrand may establish a distinct marketing world as long as product truth stays TvetFlow

## Evidence on Hand

- `frontend/src/pages/WelcomePage.tsx` — current platform landing structure and feature copy
- `frontend/src/contexts/PlatformLangContext.tsx` — EN/SO strings
- `frontend/src/components/platform/PlatformLayout.tsx` — nav/footer chrome
- Anti-reference screenshots of ACE/ONE event SaaS (user-attached) — avoid that look
- No formal testimonials or press assets on hand — do not fabricate quotes or customer logos beyond CMS placeholders

## Product Principles

1. Sell the center’s operational control, not academic prestige.
2. Platform marketing and tenant institution sites stay visually distinct systems.
3. Prove multi-tenant + credentials + day-to-day ops; don’t invent social proof.
4. Prefer workshop / floor energy over campus or generic SaaS chrome.
5. One clear admin action: create institution (or verify identity).

## Accessibility & Inclusion

Web marketing + app; bilingual EN/SO on platform chrome. No stricter WCAG level confirmed yet — default to strong contrast and readable type.
