import React from 'react'
import { institutionSocialLinks, type InstitutionBrand } from '@/lib/institution'

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden>
      <path d="M12.04 2C6.58 2 2.15 6.4 2.15 11.84c0 1.94.5 3.74 1.38 5.3L2 22l4.99-1.3a10 10 0 0 0 5.05 1.35h.01c5.46 0 9.89-4.4 9.89-9.85C21.94 6.4 17.5 2 12.04 2Zm5.72 14.13c-.24.68-1.4 1.25-1.93 1.33-.5.07-1.13.1-1.83-.11-.42-.14-.97-.32-1.67-.63-2.94-1.27-4.86-4.23-5.01-4.43-.15-.2-1.24-1.65-1.24-3.15 0-1.5.78-2.24 1.06-2.55.27-.3.6-.38.8-.38h.57c.18 0 .43-.07.67.51.24.6.83 2.07.9 2.22.08.15.12.33.02.53-.1.2-.15.33-.3.5-.15.18-.31.4-.45.53-.15.15-.3.31-.13.6.18.3.78 1.29 1.68 2.09 1.16 1.03 2.13 1.35 2.43 1.5.3.15.48.13.66-.08.18-.2.75-.87.95-1.17.2-.3.4-.25.67-.15.27.1 1.72.81 2.01.96.3.15.5.22.57.34.08.13.08.74-.16 1.42Z" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden>
      <path d="M14.5 8.5V6.8c0-.7.5-1.3 1.2-1.3H17V3h-1.8C13 3 11.5 4.6 11.5 6.7v1.8H9.5V11h2v10h3v-10h2.3l.7-2.5h-3Z" />
    </svg>
  )
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden>
      <path d="M14.5 3c.4 2.4 1.8 4.2 4.2 4.6v2.4c-1.4 0-2.7-.5-3.8-1.3v6.6c0 3.3-2.7 6-6 6s-6-2.7-6-6 2.7-6 6-6c.3 0 .6 0 .9.1v2.5a3.5 3.5 0 1 0 2.5 3.4V3h2.2Z" />
    </svg>
  )
}

const ICONS = {
  whatsapp: WhatsAppIcon,
  facebook: FacebookIcon,
  tiktok: TikTokIcon,
} as const

type Props = {
  institution?: InstitutionBrand | { social_whatsapp?: string | null; social_facebook?: string | null; social_tiktok?: string | null }
  primary?: string
  tone?: 'light' | 'dark'
  align?: 'start' | 'center'
  preview?: boolean
}

export default function LandingHeroSocials({
  institution,
  primary = '#002147',
  tone = 'dark',
  align = 'start',
  preview = false,
}: Props) {
  const links = institutionSocialLinks(institution)
  if (!links.length) return null
  const light = tone === 'light'

  return (
    <div
      className={`flex flex-wrap items-center gap-3 ${align === 'center' ? 'justify-center' : 'justify-start'}`}
      aria-label="Social media"
    >
      {links.map((item, i) => {
        const Icon = ICONS[item.id]
        const className = [
          'landing-social-icon inline-flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition',
          light
            ? 'border border-slate-200 bg-white text-slate-800 hover:text-white'
            : 'border border-white/20 bg-white/10 text-white hover:text-white',
        ].join(' ')
        if (preview) {
          return (
            <span
              key={item.id}
              className={className}
              style={{ animationDelay: `${i * 0.22}s`, color: undefined }}
            >
              <Icon />
            </span>
          )
        }
        return (
          <a
            key={item.id}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={item.label}
            className={`${className} hover:scale-110`}
            style={{
              animationDelay: `${i * 0.22}s`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = primary
              e.currentTarget.style.borderColor = primary
              e.currentTarget.style.color = '#fff'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = ''
              e.currentTarget.style.borderColor = ''
              e.currentTarget.style.color = ''
            }}
          >
            <Icon />
          </a>
        )
      })}
    </div>
  )
}
