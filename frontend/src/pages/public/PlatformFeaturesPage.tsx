import React, { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import PlatformLayout from '@/components/platform/PlatformLayout'
import PlatformPhoto from '@/components/platform/PlatformPhoto'
import { PLATFORM_PHOTO_DEFAULTS, getPublicSiteCms } from '@/lib/platformMedia'

const PlatformFeaturesPage = () => {
  const [photos, setPhotos] = useState(PLATFORM_PHOTO_DEFAULTS)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cms = await getPublicSiteCms()
        if (!cancelled) setPhotos(cms.photos)
      } catch {
        /* defaults */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const items = useMemo(
    () => [
      {
        title: 'One institution, one portal',
        body: 'Each center gets a branded landing page, its own admin console, and isolated records. Staff and students sign in from that page — not from the platform home.',
        image: photos.classroom,
        caption: 'Classroom operations stay with the institution that runs them.',
        objectPosition: 'center 35%',
      },
      {
        title: 'Daily work, not extra tools',
        body: 'Classes, attendance, tuition, exams, and certificates live in the same place. Admins see one queue of work instead of switching between spreadsheets and messengers.',
        image: photos.operations,
        caption: 'Finance and enrollment sit next to teaching records.',
        objectPosition: 'center 20%',
      },
      {
        title: 'Credentials that look official',
        body: 'Issue certificates and transcripts with the institution logo and colors. Public verification is available so employers can check an ID without an account.',
        image: photos.lecture,
        caption: 'Documents follow the same brand as the landing page.',
        objectPosition: 'center 40%',
      },
      {
        title: 'One console for the center',
        body: 'The institution dashboard uses the same teal surface as this site. Dark or light — the palette does not change when you sign in.',
        image: photos.workshop,
        caption: 'Daily operations use the same visual language as the public site.',
        objectPosition: 'center 45%',
      },
    ],
    [photos]
  )

  return (
    <PlatformLayout>
      <Helmet>
        <title>Features — TvetFlow</title>
      </Helmet>
      <section className="relative overflow-hidden bg-[var(--pf-bg)]">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-teal-600"
          >
            Product
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.5 }}
            className="mt-2 max-w-2xl font-display text-3xl font-semibold text-[var(--pf-text)] sm:text-4xl"
          >
            Built around how a training center actually runs
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16, duration: 0.5 }}
            className="mt-4 max-w-xl text-[var(--pf-muted)]"
          >
            TvetFlow is not a pile of modules. It is the front desk, the classroom register, and the finance book — under one login.
          </motion.p>
        </div>
      </section>

      {items.map((item, i) => {
        const imageFirst = i % 2 === 1
        return (
          <section
            key={item.title}
            className={`border-t border-[var(--pf-line)] ${i % 2 === 1 ? 'bg-[var(--pf-bg-2)]' : ''}`}
          >
            <div
              className={`mx-auto grid max-w-6xl items-center gap-8 px-5 py-12 sm:px-8 lg:grid-cols-2 lg:gap-14 ${
                imageFirst ? '' : ''
              }`}
            >
              <div className={imageFirst ? 'lg:order-2' : ''}>
                <h2 className="font-display text-2xl font-semibold text-[var(--pf-text)]">{item.title}</h2>
                <p className="mt-3 text-[15px] leading-relaxed text-[var(--pf-muted)]">{item.body}</p>
                <p className="mt-4 text-sm text-[var(--pf-faint)]">{item.caption}</p>
              </div>
              <div className={imageFirst ? 'lg:order-1' : ''}>
                <PlatformPhoto
                  src={item.image!}
                  alt={item.title}
                  objectPosition={item.objectPosition}
                  className="h-56 w-full sm:h-72"
                />
              </div>
            </div>
          </section>
        )
      })}

      <section className="border-t border-[var(--pf-line)] px-5 py-14 sm:px-8">
        <div className="mx-auto max-w-6xl text-center">
          <Button asChild className="bg-[var(--pf-accent)] font-semibold text-[var(--pf-accent-fg)] hover:opacity-90">
            <Link to="/create-institution">
              Create institution
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </PlatformLayout>
  )
}

export default PlatformFeaturesPage
