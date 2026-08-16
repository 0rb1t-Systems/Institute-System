import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 md:p-12">
      <Helmet><title>Terms of Service</title></Helmet>
      <div className="max-w-3xl mx-auto space-y-6">
        <Button asChild variant="outline" className="border-slate-700">
          <Link to="/login">Back to login</Link>
        </Button>
        <h1 className="text-3xl font-bold text-white">Terms of Service</h1>
        <p className="text-slate-400 text-sm">Last updated: July 2026</p>
        <div className="space-y-4 text-slate-300 leading-relaxed">
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
      </div>
    </div>
  );
}
