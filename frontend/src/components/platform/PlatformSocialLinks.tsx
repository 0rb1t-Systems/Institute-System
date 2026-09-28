import React from 'react'
import { motion } from 'framer-motion'
import { Facebook, Instagram, Linkedin, Twitter, Youtube, Mail } from 'lucide-react'

export const PLATFORM_CONTACT_EMAIL = 'orb1tsystems22@gmail.com'

/** Official platform brand colors for social icons. */
export const PLATFORM_SOCIAL = [
  {
    name: 'Facebook',
    href: 'https://www.facebook.com/',
    icon: Facebook,
    color: '#1877F2',
    brand: 'facebook',
  },
  {
    name: 'Instagram',
    href: 'https://www.instagram.com/',
    icon: Instagram,
    color: '#E1306C',
    brand: 'instagram',
  },
  {
    name: 'LinkedIn',
    href: 'https://www.linkedin.com/',
    icon: Linkedin,
    color: '#0A66C2',
    brand: 'linkedin',
  },
  {
    name: 'X (Twitter)',
    href: 'https://x.com/',
    icon: Twitter,
    color: '#1DA1F2',
    brand: 'x',
  },
  {
    name: 'YouTube',
    href: 'https://www.youtube.com/',
    icon: Youtube,
    color: '#FF0000',
    brand: 'youtube',
  },
  {
    name: 'Email',
    href: `mailto:${PLATFORM_CONTACT_EMAIL}`,
    icon: Mail,
    color: '#EA4335',
    brand: 'email',
  },
] as const

const easeOut = [0.22, 1, 0.36, 1] as const

type Variant = 'header' | 'hero' | 'footer'

const sizeClass: Record<Variant, string> = {
  header: 'h-8 w-8',
  hero: 'h-10 w-10',
  footer: 'h-9 w-9',
}

const iconClass: Record<Variant, string> = {
  header: 'h-3.5 w-3.5',
  hero: 'h-4 w-4',
  footer: 'h-4 w-4',
}

/** Brand-colored social + contact links for the platform chrome. */
export default function PlatformSocialLinks({
  variant = 'footer',
  animated = false,
  className = '',
}: {
  variant?: Variant
  animated?: boolean
  className?: string
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2.5 ${className}`}
      aria-label="Social media and contact"
    >
      {PLATFORM_SOCIAL.map((item, i) => {
        const Icon = item.icon
        const isMail = item.href.startsWith('mailto:')
        const common = {
          href: item.href,
          target: isMail ? undefined : ('_blank' as const),
          rel: isMail ? undefined : 'noopener noreferrer',
          'aria-label': item.name === 'Email' ? `Email ${PLATFORM_CONTACT_EMAIL}` : item.name,
          title: item.name === 'Email' ? PLATFORM_CONTACT_EMAIL : item.name,
          'data-brand': item.brand,
          className: `platform-social-brand landing-social-icon inline-flex items-center justify-center transition-[transform,box-shadow,background,color,border-color] duration-200 hover:-translate-y-0.5 hover:scale-105 ${sizeClass[variant]}`,
          style: {
            ['--social-brand' as string]: item.color,
            borderRadius: 'var(--landing-radius)',
            animationDelay: `${i * 0.18}s`,
          } as React.CSSProperties,
        }

        if (!animated) {
          return (
            <a key={item.name} {...common}>
              <Icon className={iconClass[variant]} strokeWidth={2.25} />
            </a>
          )
        }

        return (
          <motion.a
            key={item.name}
            {...common}
            initial={{ opacity: 0, scale: 0.65, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.4 + i * 0.09, ease: easeOut }}
            whileHover={{ y: -5, scale: 1.12 }}
            whileTap={{ scale: 0.94 }}
          >
            <Icon className={iconClass[variant]} strokeWidth={2.25} />
          </motion.a>
        )
      })}
    </div>
  )
}
