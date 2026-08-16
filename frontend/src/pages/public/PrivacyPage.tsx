import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 md:p-12">
      <Helmet><title>Privacy Policy</title></Helmet>
      <div className="max-w-3xl mx-auto space-y-6">
        <Button asChild variant="outline" className="border-slate-700">
          <Link to="/login">Back to login</Link>
        </Button>
        <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
        <p className="text-slate-400 text-sm">Last updated: July 2026</p>
        <div className="space-y-4 text-slate-300 leading-relaxed">
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
      </div>
    </div>
  );
}
