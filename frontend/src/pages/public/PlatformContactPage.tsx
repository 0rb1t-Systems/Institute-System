import React from 'react'
import { Helmet } from 'react-helmet'
import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import PlatformLayout from '@/components/platform/PlatformLayout'
import PlatformPhoto from '@/components/platform/PlatformPhoto'
import { PLATFORM_PHOTOS } from '@/lib/platformMedia'

const PlatformContactPage = () => (
  <PlatformLayout>
    <Helmet>
      <title>Contact — TvetFlow</title>
    </Helmet>
    <section className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-2">
      <div>
        <p className="text-sm text-teal-600">Contact</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-[var(--pf-text)] sm:text-4xl">
          Talk to the platform team
        </h1>
        <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[var(--pf-muted)]">
          For new institutions, start with the create flow. For existing tenants, sign in from your own landing page. For platform questions, email us.
        </p>
        <a
          href="mailto:orb1tsystems22@gmail.com"
          className="mt-8 inline-flex items-center gap-2 text-[var(--pf-text)] hover:text-teal-600"
        >
          <Mail className="h-4 w-4" />
          orb1tsystems22@gmail.com
        </a>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild className="bg-[var(--pf-accent)] font-semibold text-[var(--pf-accent-fg)] hover:opacity-90">
            <Link to="/create-institution">Create institution</Link>
          </Button>
          <Button asChild variant="outline" className="border-[var(--pf-line)] bg-transparent text-[var(--pf-text)] hover:bg-[var(--pf-hover)]">
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      </div>
      <PlatformPhoto
        src={PLATFORM_PHOTOS.students}
        alt="Students on campus"
        className="h-72 w-full lg:h-full lg:min-h-[360px]"
      />
    </section>
  </PlatformLayout>
)

export default PlatformContactPage
