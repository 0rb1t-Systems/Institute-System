# Design

<!-- Landing marketing world for TvetFlow platform site. App UI (forest green / Geist) remains separate. -->

## World

**Ops Desk** — clean light marketing surface aligned to the product dashboard cutout: white room, slate ink, gold action. Persuade mode for `/` (WelcomePage).

## Palette (landing-*)

| Token | Hex | Role |
|-------|-----|------|
| limewash | `#F7F7F7` | Page ground (matches light hero cutout) |
| room | `#FFFFFF` | Elevated fields / feature tiles |
| poche | `#0F172A` | Inverse CTA band, logo mark |
| sun | `#EAB308` | Primary CTA + action accent |
| sun-soft | `#FEF3C7` | Soft washes |
| on-sun | `#0F172A` | Text/icons on primary CTA |
| shadow | `#64748B` | Secondary / muted |
| line | `#E2E8F0` | Hairline rules |

Dark mode accent: `#FACC15` on `--landing-sun` with on-sun `#0F172A`.

## Type

- Display: **Montserrat** (800 / black) — geometric brand voice matching the CMS mock reference
- Body: **DM Sans**

## Components / layout rules

- Corner radius 10px
- Hero: light mode uses cutout `hero-tvetflow-light.png`; dark mode keeps `hero-tvetflow.png`
- Auth surfaces (login, create institution, verify) share Ops Desk tokens via `platform-landing` (gold CTAs, Montserrat brand)
- Interactive states: focus rings, input focus, text selection, caret, link/button hovers all use `--landing-sun` (gold)

## Anti-references

- ACE/ONE purple–blue SaaS gradients, pill CTAs
- University / institution campus brochure look
- Bodoni / Daylight Section serif marketing world (retired)

## Pen frames

- Legacy pen frames may still show Daylight Section — prefer live WelcomePage as authority
