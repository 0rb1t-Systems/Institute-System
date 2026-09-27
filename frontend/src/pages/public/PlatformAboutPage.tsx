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
            initial={{ opacity: 0, y: 36, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-sm font-semibold text-[var(--landing-sun)]">About</p>
            <h1 className="landing-display mt-2 text-3xl font-extrabold text-[var(--landing-ink)] sm:text-4xl">
              Software for centers that train people for work
            </h1>
            <p className="mt-5 text-[15px] leading-relaxed text-[var(--landing-muted)]">
              TvetFlow started from a simple problem: vocational schools were running students, fees, and certificates in different notebooks. Each institution gets its own portal — same brand, dark or light.
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--landing-muted)]">
              Institution admins register here. Instructors, staff, and students are invited from the institution page.
            </p>
            <Button asChild className="landing-btn-primary mt-8 h-11 px-5 text-sm">
              <Link to="/contact">Get in touch</Link>
            </Button>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 56, rotate: 2.4, scale: 0.94 }}
            animate={{ opacity: 1, x: 0, rotate: 0, scale: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
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
