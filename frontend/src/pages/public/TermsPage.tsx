import React from 'react';
import { Helmet } from 'react-helmet';
import PlatformLayout from '@/components/platform/PlatformLayout';

export default function TermsPage() {
  return (
    <PlatformLayout>
      <Helmet>
        <title>Terms of Service — TvetFlow</title>
      </Helmet>
      <article className="mx-auto max-w-3xl space-y-6 px-5 py-14 sm:px-8">
        <h1 className="font-display text-3xl font-semibold text-[var(--pf-text)]">Terms of Service</h1>
        <p className="text-sm text-[var(--pf-faint)]">Last updated: July 2026</p>
        <div className="space-y-4 text-[15px] leading-relaxed text-[var(--pf-muted)]">
          <p>
            By using this multi-tenant training center platform, you agree to use the service
            lawfully and only for managing your institution’s students, classes, attendance,
            and payments.
          </p>
          <p>
            Each institution is responsible for the accuracy of data it enters and for
            complying with local regulations. Accounts may be suspended for abuse or security risk.
          </p>
          <p>
            Payment processing (including WaafiPay where enabled) is subject to the payment
            provider’s terms in addition to these Terms.
          </p>
        </div>
      </article>
    </PlatformLayout>
  );
}
