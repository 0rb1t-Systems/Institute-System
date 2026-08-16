import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Printer, X, Loader2, AlertCircle, Share2 } from 'lucide-react';
import { downloadCertificatePDF, printCertificatePDF } from '@/lib/certificateGenerator';
import { getCertificateById } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { notify, getUserMessage, MESSAGES } from '@/lib/notify';
import CertificatePreview from '@/components/CertificatePreview';
import { useAuth } from '@/contexts/AuthContext';
import { getVerificationUrl, resolveDocumentBranding } from '@/lib/institution';
import { normalizeCertificateLayoutKey } from '@/lib/certificateTemplates';

const CertificateViewModal = ({ isOpen, onClose, certificateId, certificate: propCertificate }: any) => {
  const { toast } = useToast();
  const { institution } = useAuth();
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [certificate, setCertificate] = useState(propCertificate || null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      if (propCertificate) {
        setCertificate(propCertificate);
        setLoading(false);
      } else if (certificateId) {
        fetchCertificateData();
      }
    }
  }, [isOpen, certificateId, propCertificate]);

  const fetchCertificateData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await getCertificateById(certificateId);
      
      if (!data) {
        throw new Error('Certificate not found');
      }
      
      setCertificate(data);
    } catch (err) {
      const msg = getUserMessage(err, { context: 'CertificateViewModal - load', fallback: MESSAGES.LOAD_FAILED });
      setError(msg);
      notify.error(err, { context: 'CertificateViewModal - load', fallback: MESSAGES.LOAD_FAILED });
    } finally {
      setLoading(false);
    }
  };

  const buildPdfPayload = () => {
    const verifyCode = String(certificate?.verification_code || '').trim();
    const brand = resolveDocumentBranding(institution, certificate?.template_snapshot);
    const verificationUrl = verifyCode
      ? getVerificationUrl(verifyCode, brand, 'certificate')
      : '';
    const layoutKey = normalizeCertificateLayoutKey(
      certificate?.template_snapshot?.template?.layout_key ||
        certificate?.template_snapshot?.layout_key,
    );
    return {
      student: certificate.student,
      course: certificate.course,
      diploma: certificate.diploma,
      class: certificate.class,
      certificateNumber: certificate.certificate_number,
      dateIssued: certificate.date_issued || certificate.issued_at,
      qrData: verificationUrl,
      serialNumber: certificate.serial_number,
      institution: brand,
      verificationUrl,
      layoutKey,
      template_snapshot: certificate.template_snapshot,
      verification_code: verifyCode,
    };
  };

  const handleDownloadPDF = async () => {
    if (!certificate) return;
    const verifyCode = String(certificate.verification_code || '').trim();
    if (!verifyCode) {
      toast({
        title: 'Cannot download',
        description: 'Certificate has no verification code.',
        variant: 'destructive',
      });
      return;
    }
    
    setDownloading(true);
    try {
      await downloadCertificatePDF(buildPdfPayload());

      toast({
        title: "Download successful",
        description: "Full certificate PDF downloaded successfully"
      });
    } catch (error) {
      notify.error(error, { context: 'CertificateViewModal - download', fallback: { title: 'Download failed', description: MESSAGES.DOMAIN.CERTIFICATE_DOWNLOAD } });
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = async () => {
    if (!certificate) return;
    const verifyCode = String(certificate.verification_code || '').trim();
    if (!verifyCode) {
      toast({
        title: 'Cannot print',
        description: 'Certificate has no verification code.',
        variant: 'destructive',
      });
      return;
    }
    setPrinting(true);
    try {
      await printCertificatePDF(buildPdfPayload());
    } catch (error) {
      notify.error(error, {
        context: 'CertificateViewModal - print',
        fallback: { title: 'Print failed', description: 'Could not prepare the certificate for printing.' },
      });
    } finally {
      setPrinting(false);
    }
  };

  const handleShare = () => {
    const verifyCode = String(certificate?.verification_code || '').trim();
    if (!verifyCode) {
      toast({
        title: 'Unavailable',
        description: 'Certificate has no verification code.',
        variant: 'destructive',
      });
      return;
    }
    const brand = resolveDocumentBranding(institution, certificate?.template_snapshot);
    const verificationUrl = getVerificationUrl(verifyCode, brand, 'certificate');
    navigator.clipboard.writeText(verificationUrl);
    toast({
      title: "Link copied",
      description: "Verification link copied to clipboard"
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'issued': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'generated': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'revoked': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-[900px] max-h-[95vh] overflow-y-auto bg-slate-900 border-slate-800 print:max-w-full print:border-0 print:bg-white">
        <DialogHeader className="print-hide">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <DialogTitle className="text-xl sm:text-2xl flex items-center gap-2 text-white">
              Certificate Preview
            </DialogTitle>
            {certificate && (
              <Badge variant="outline" className={getStatusColor(certificate.status)}>
                {certificate.status?.toUpperCase()}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-3 text-slate-300">Loading certificate...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <p className="text-red-400 font-semibold mb-2">Failed to load certificate</p>
            <p className="text-red-300 text-sm mb-4">{error}</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={fetchCertificateData} className="border-red-500/20">
                Try Again
              </Button>
              <Button variant="outline" onClick={onClose} className="border-slate-700">
                Close
              </Button>
            </div>
          </div>
        )}

        {!loading && !error && certificate && (
          <div className="space-y-6">
            {/* Certificate Preview */}
            <div className="bg-white rounded-lg overflow-hidden shadow-xl print:shadow-none print:rounded-none">
              <CertificatePreview certificate={certificate} />
            </div>

            {/* Certificate Metadata (Hidden on print) */}
            <div className="grid md:grid-cols-3 gap-4 print-hide">
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <p className="text-slate-400 text-sm mb-1">Serial Number</p>
                <p className="text-white font-mono text-sm">{certificate.serial_number}</p>
              </div>

              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <p className="text-slate-400 text-sm mb-1">Certificate Number</p>
                <p className="text-white font-mono text-sm">{certificate.certificate_number}</p>
              </div>

              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <p className="text-slate-400 text-sm mb-1">Student ID</p>
                <p className="text-white font-mono text-sm">{certificate.student?.student_code}</p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 print-hide">
          <Button variant="outline" onClick={onClose} className="border-slate-700">
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
          <Button 
            variant="outline" 
            onClick={handleShare} 
            className="border-slate-700"
            disabled={loading || error}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button 
            variant="outline" 
            onClick={handlePrint} 
            className="border-slate-700"
            disabled={loading || error || printing}
          >
            {printing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Preparing…
              </>
            ) : (
              <>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </>
            )}
          </Button>
          <Button 
            onClick={handleDownloadPDF} 
            disabled={downloading || loading || error}
          >
            {downloading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CertificateViewModal;