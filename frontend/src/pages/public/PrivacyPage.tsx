import React from 'react';
import { Helmet } from 'react-helmet';
import PlatformLayout from '@/components/platform/PlatformLayout';

export default function PrivacyPage() {
  return (
    <PlatformLayout>
      <Helmet>
        <title>Privacy Policy — TvetFlow</title>
      </Helmet>
      <article className="mx-auto max-w-3xl space-y-6 px-5 py-14 sm:px-8">
        <h1 className="font-display text-3xl font-semibold text-[var(--pf-text)]">Privacy Policy</h1>
        <p className="text-sm text-[var(--pf-faint)]">Last updated: July 2026</p>
        <div className="space-y-4 text-[15px] leading-relaxed text-[var(--pf-muted)]">
          <p>
            This Training Center Management Platform processes personal data (name, email, phone,
            attendance, and payment records) on behalf of each training institution (tenant).
          </p>
          <p>
            Data is isolated per institution using database Row-Level Security. We do not sell
            personal data. Access is limited to authorized roles within your institution.
          </p>
          <p>
            For questions about your data, contact your institution administrator or
            orb1tsystems22@gmail.com.
          </p>
        </div>
      </article>
    </PlatformLayout>
  );
}
