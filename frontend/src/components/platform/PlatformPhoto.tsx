import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

/** Framed photo with a light solid wash so Unsplash shots sit on-brand. */
const PlatformPhoto = ({
  src,
  alt,
  className = '',
  imgClassName = '',
  objectPosition = 'center',
}: {
  src: string
  alt: string
  className?: string
  imgClassName?: string
  objectPosition?: string
}) => (
  <div className={cn('group relative overflow-hidden rounded-2xl ring-1 ring-[var(--pf-line)]', className)}>
    <motion.img
      src={src}
      alt={alt}
      initial={{ scale: 1.12, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      viewport={{ once: true, amount: 0.28 }}
      transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1] }}
      className={cn('h-full w-full object-cover will-change-transform', imgClassName)}
      style={{
        objectPosition,
        filter: 'saturate(0.92) contrast(1.05) brightness(0.96)',
      }}
    />
    <div
      className="pointer-events-none absolute inset-0 bg-[var(--pf-bg)]/20 transition-opacity duration-500 group-hover:bg-[var(--pf-bg)]/10"
      aria-hidden
    />
    <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" aria-hidden />
  </div>
)

export default PlatformPhoto
