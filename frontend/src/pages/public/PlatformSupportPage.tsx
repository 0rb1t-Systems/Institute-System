import React from 'react'
import { Helmet } from 'react-helmet'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LifeBuoy, Mail, Clock, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import PlatformLayout, { PLATFORM_CONTACT_EMAIL } from '@/components/platform/PlatformLayout'
import PlatformSocialLinks from '@/components/platform/PlatformSocialLinks'

const easeOut = [0.22, 1, 0.36, 1] as const

const cards = [
  {
    icon: Mail,
    title: 'Email',
    body: (
      <a
        href={`mailto:${PLATFORM_CONTACT_EMAIL}`}
        className="mt-2 block text-sm font-semibold text-[var(--landing-sun)] hover:underline"
      >
        {PLATFORM_CONTACT_EMAIL}
      </a>
    ),
  },
  {
    icon: Clock,
    title: 'Hours',
    body: <p className="mt-2 text-sm text-[var(--landing-muted)]">Sunday–Thursday, business hours (EAT).</p>,
  },
  {
    icon: LifeBuoy,
    title: 'Tickets',
    body: (
      <p className="mt-2 text-sm text-[var(--landing-muted)]">
        Email us and we will follow up from the support inbox.
      </p>
    ),
  },
]

const PlatformSupportPage = () => (
  <PlatformLayout>
    <Helmet>
      <title>Support — TvetFlow</title>
    </Helmet>
    <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-sm font-semibold text-[var(--landing-sun)]"
      >
        Support
      </motion.p>
      <motion.h1
        initial={{ opacity: 0, y: 28, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.65, ease: easeOut }}
        className="landing-display mt-2 max-w-2xl text-3xl font-extrabold text-[var(--landing-ink)] sm:text-4xl"
      >
        Help for institutions
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.55, ease: easeOut }}
        className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--landing-muted)]"
      >
        Institution staff sign in from their own landing page. For a new center, start with create institution.
      </motion.p>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {cards.map((card, i) => {
          const Icon = card.icon
          return (
            <motion.article
              key={card.title}
              initial={{ opacity: 0, y: 36, scale: 0.96 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: i * 0.1, ease: easeOut }}
              whileHover={{ y: -8, transition: { duration: 0.2 } }}
              className="border border-[var(--landing-line)] bg-[var(--landing-room)] p-5"
              style={{ borderRadius: 'var(--landing-radius)' }}
            >
              <Icon className="h-5 w-5 text-[var(--landing-sun)]" />
              <h2 className="landing-display mt-3 font-extrabold text-[var(--landing-ink)]">{card.title}</h2>
              {card.body}
            </motion.article>
          )
        })}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: easeOut }}
        className="mt-8"
      >
        <PlatformSocialLinks variant="hero" animated />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.55, delay: 0.08, ease: easeOut }}
        className="mt-10 flex flex-wrap gap-3"
      >
        <Button asChild className="landing-btn-primary h-11 px-5 text-sm">
          <Link to="/create-institution">
            Create institution
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="landing-btn-outline h-11 px-5 text-sm">
          <Link to="/contact">Contact</Link>
        </Button>
        <Button asChild variant="outline" className="landing-btn-outline h-11 px-5 text-sm">
          <Link to="/login">Sign in</Link>
        </Button>
      </motion.div>
    </section>
  </PlatformLayout>
)

export default PlatformSupportPage
