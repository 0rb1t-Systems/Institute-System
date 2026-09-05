import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import PlatformLayout from '@/components/platform/PlatformLayout'
import PlatformPhoto from '@/components/platform/PlatformPhoto'
import { PLATFORM_PHOTO_DEFAULTS, getPublicSiteCms } from '@/lib/platformMedia'

const PlatformAboutPage = () => {
  const [aboutSrc, setAboutSrc] = useState(PLATFORM_PHOTO_DEFAULTS.about)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cms = await getPublicSiteCms()
        if (!cancelled && cms.photos.about) setAboutSrc(cms.photos.about)
      } catch {
        /* default */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <PlatformLayout>
      <Helmet>
        <title>About — TvetFlow</title>
      </Helmet>
      <section className="relative overflow-hidden bg-[var(--pf-bg)]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-sm text-teal-600">About</p>
            <h1 className="mt-2 font-display text-3xl font-semibold text-[var(--pf-text)] sm:text-4xl">
              Software for centers that train people for work
            </h1>
            <p className="mt-5 text-[15px] leading-relaxed text-[var(--pf-muted)]">
              TvetFlow started from a simple problem: vocational schools were running students, fees, and certificates in different notebooks. Each institution gets its own portal — same teal, same type, dark or light.
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--pf-muted)]">
              Institution admins register here. Instructors, staff, and students are invited from the institution page.
            </p>
            <Button asChild variant="outline" className="mt-8 border-[var(--pf-line)] bg-transparent text-[var(--pf-text)] hover:bg-[var(--pf-hover)]">
              <Link to="/contact">Get in touch</Link>
            </Button>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 40, rotate: 1.2 }}
            animate={{ opacity: 1, x: 0, rotate: 0 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          >
            <PlatformPhoto
              src={aboutSrc!}
              alt="Trainees and an instructor working with equipment on the shop floor"
              objectPosition="center 30%"
              className="h-56 w-full shadow-[0_32px_70px_rgba(6,21,18,0.32)] sm:h-80 lg:h-[440px]"
            />
          </motion.div>
        </div>
      </section>
    </PlatformLayout>
  )
}

export default PlatformAboutPage
