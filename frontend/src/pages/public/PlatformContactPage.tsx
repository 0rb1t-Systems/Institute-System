import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import PlatformLayout, { PLATFORM_CONTACT_EMAIL } from '@/components/platform/PlatformLayout'
import PlatformSocialLinks from '@/components/platform/PlatformSocialLinks'
import PlatformPhoto from '@/components/platform/PlatformPhoto'
import { PLATFORM_PHOTO_DEFAULTS, getPublicSiteCms } from '@/lib/platformMedia'

const easeOut = [0.22, 1, 0.36, 1] as const

const PlatformContactPage = () => {
  const [studentsSrc, setStudentsSrc] = useState(PLATFORM_PHOTO_DEFAULTS.students)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cms = await getPublicSiteCms()
        if (!cancelled && cms.photos.students) setStudentsSrc(cms.photos.students)
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
        <title>Contact — TvetFlow</title>
      </Helmet>
      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -32, filter: 'blur(8px)' }}
          animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.65, ease: easeOut }}
        >
          <p className="text-sm font-semibold text-[var(--landing-sun)]">Contact</p>
          <h1 className="landing-display mt-2 text-3xl font-extrabold text-[var(--landing-ink)] sm:text-4xl">
            Talk to the platform team
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[var(--landing-muted)]">
            For new institutions, start with the create flow. For existing tenants, sign in from your own landing page. For platform questions, email us.
          </p>
          <a
            href={`mailto:${PLATFORM_CONTACT_EMAIL}`}
            className="mt-8 inline-flex items-center gap-2 font-semibold text-[var(--landing-sun)] hover:underline"
          >
            <Mail className="h-4 w-4" />
            {PLATFORM_CONTACT_EMAIL}
          </a>
          <PlatformSocialLinks variant="hero" animated className="mt-6" />
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild className="landing-btn-primary h-11 px-5 text-sm">
              <Link to="/create-institution">Create institution</Link>
            </Button>
            <Button asChild variant="outline" className="landing-btn-outline h-11 px-5 text-sm">
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 40, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.75, delay: 0.12, ease: easeOut }}
        >
          <PlatformPhoto
            src={studentsSrc!}
            alt="Students on campus"
            className="h-56 w-full lg:h-full lg:min-h-[360px]"
          />
        </motion.div>
      </section>
    </PlatformLayout>
  )
}

export default PlatformContactPage
