/**
 * Tenant landing page template catalog (8 polished designs).
 */

export const LANDING_TEMPLATE_IDS = [
  'aurora',
  'campus',
  'classic',
  'horizon',
  'crest',
  'nova',
  'ledger',
  'atelier',
] as const

export type LandingTemplateId = (typeof LANDING_TEMPLATE_IDS)[number]

export type LandingTemplateMeta = {
  id: LandingTemplateId
  name: string
  tagline: string
  defaultPrimary: string
  defaultAccent: string
  defaultHeroImage: string
  defaultHeadline: string
  previewTone: 'light' | 'dark'
}

export const DEFAULT_HERO_IMAGES = {
  aurora:
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1600&q=80',
  campus:
    'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1800&q=80',
  classic:
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1920&q=80',
  horizon:
    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1600&q=80',
  crest:
    'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=1600&q=80',
  nova:
    'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1600&q=80',
  ledger:
    'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1600&q=80',
  atelier:
    'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1600&q=80',
} as const

export const LANDING_TEMPLATES: LandingTemplateMeta[] = [
  {
    id: 'aurora',
    name: 'Aurora Glass',
    tagline: 'Soft glass nav + organic hero portrait',
    defaultPrimary: '#1A56DB',
    defaultAccent: '#0891B2',
    defaultHeroImage: DEFAULT_HERO_IMAGES.aurora,
    defaultHeadline: 'Learn. Grow. Build Your Future.',
    previewTone: 'light',
  },
  {
    id: 'campus',
    name: 'Campus Split',
    tagline: 'Architectural photo with elegant fade',
    defaultPrimary: '#0C4A6E',
    defaultAccent: '#B45309',
    defaultHeroImage: DEFAULT_HERO_IMAGES.campus,
    defaultHeadline: 'Empowering Minds. Building Futures.',
    previewTone: 'light',
  },
  {
    id: 'classic',
    name: 'Classic Night',
    tagline: 'Cinematic full-bleed photo hero',
    defaultPrimary: '#1E3A8A',
    defaultAccent: '#F43F5E',
    defaultHeroImage: DEFAULT_HERO_IMAGES.classic,
    defaultHeadline: 'Empowering Future Researchers & Leaders',
    previewTone: 'dark',
  },
  {
    id: 'horizon',
    name: 'Horizon Light',
    tagline: 'Airy centered brand with wide campus view',
    defaultPrimary: '#0F766E',
    defaultAccent: '#D97706',
    defaultHeroImage: DEFAULT_HERO_IMAGES.horizon,
    defaultHeadline: 'Quality Education. Bright Careers.',
    previewTone: 'light',
  },
  {
    id: 'crest',
    name: 'Crest Formal',
    tagline: 'Formal navy ceremony with gold accents',
    defaultPrimary: '#0B1F33',
    defaultAccent: '#D4A017',
    defaultHeroImage: DEFAULT_HERO_IMAGES.crest,
    defaultHeadline: 'Academic Excellence. Trusted Credentials.',
    previewTone: 'dark',
  },
  {
    id: 'nova',
    name: 'Nova Bento',
    tagline: 'Modern teal mosaic with bold energy',
    defaultPrimary: '#0D9488',
    defaultAccent: '#4F46E5',
    defaultHeroImage: DEFAULT_HERO_IMAGES.nova,
    defaultHeadline: 'Skills That Open Doors.',
    previewTone: 'light',
  },
  {
    id: 'ledger',
    name: 'Ledger Pro',
    tagline: 'Sharp corporate training center look',
    defaultPrimary: '#1E293B',
    defaultAccent: '#2563EB',
    defaultHeroImage: DEFAULT_HERO_IMAGES.ledger,
    defaultHeadline: 'Train. Certify. Advance.',
    previewTone: 'light',
  },
  {
    id: 'atelier',
    name: 'Atelier',
    tagline: 'Editorial storytelling with calm imagery',
    defaultPrimary: '#1C1917',
    defaultAccent: '#C2410C',
    defaultHeroImage: DEFAULT_HERO_IMAGES.atelier,
    defaultHeadline: 'Where Ambition Meets Mentorship.',
    previewTone: 'light',
  },
]

export function isLandingTemplateId(value: unknown): value is LandingTemplateId {
  return LANDING_TEMPLATE_IDS.includes(String(value || '') as LandingTemplateId)
}

export function getLandingTemplate(id?: string | null): LandingTemplateMeta {
  const found = LANDING_TEMPLATES.find((t) => t.id === id)
  return found || LANDING_TEMPLATES.find((t) => t.id === 'classic')!
}

export function resolveHeroImage(
  institution?: { hero_image_url?: string | null; landing_template_id?: string | null } | null,
): string {
  const custom = String(institution?.hero_image_url || '').trim()
  if (custom) return custom
  return getLandingTemplate(institution?.landing_template_id).defaultHeroImage
}

export function resolveHeroHeadline(
  institution?: {
    hero_headline?: string | null
    motto?: string | null
    landing_template_id?: string | null
  } | null,
): string {
  const custom = String(institution?.hero_headline || '').trim()
  if (custom) return custom
  const motto = String(institution?.motto || '').trim()
  if (motto) return motto
  return getLandingTemplate(institution?.landing_template_id).defaultHeadline
}
