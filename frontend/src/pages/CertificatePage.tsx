import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, Link, Navigate } from 'react-router-dom';
import AnimatedPage from '@/components/AnimatedPage';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getCertificateById } from '@/lib/api';
import CertificateViewModal from '@/components/certificates/CertificateViewModal';
import { getInstitutionDisplayName } from '@/lib/institution';

/**
 * Unified issued-certificate viewer for admin / staff / instructor.
 * Replaces the legacy exam-result print page — official certificates only.
 * Route: /certificate/:certificateId
 */
const CertificatePage = () => {
  const { certificateId } = useParams();
  const id = certificateId;
  const { user, institution } = useAuth();
  const institutionName = getInstitutionDisplayName(institution);

  const [loading, setLoading] = useState(true);
  const [found, setFound] = useState(false);
  const [modalOpen, setModalOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    ;(async () => {
      if (!id) {
        setLoading(false);
        setFound(false);
        return;
      }
      setLoading(true);
      try {
        const cert = await getCertificateById(id);
        if (!cancelled) {
          setFound(Boolean(cert?.id));
          setModalOpen(Boolean(cert?.id));
        }
      } catch {
        if (!cancelled) setFound(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const backHref =
    user?.role === 'instructor'
      ? '/instructor/dashboard'
      : user?.role === 'student'
        ? '/portal/certificates'
        : '/reports?tab=certificates';

  if (!id) {
    return <Navigate to={backHref} replace />;
  }

  if (loading) {
    return (
      <AnimatedPage>
        <div className="flex justify-center items-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      </AnimatedPage>
    );
  }

  if (!found) {
    return (
      <AnimatedPage>
        <div className="max-w-lg mx-auto p-8 text-center space-y-4">
          <p className="text-slate-300">Certificate not found.</p>
          <p className="text-sm text-slate-500">
            Official certificates are managed from Reports → Certificates
            {user?.role === 'student' ? ' or My Certificates' : ''}.
          </p>
          <Button asChild variant="outline">
            <Link to={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <Helmet>
        <title>Certificate — {institutionName}</title>
      </Helmet>
      <div className="max-w-4xl mx-auto p-4">
        <Button asChild variant="outline" className="mb-4">
          <Link to={backHref}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>
      <CertificateViewModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        certificateId={id}
      />
    </AnimatedPage>
  );
};

export default CertificatePage;
