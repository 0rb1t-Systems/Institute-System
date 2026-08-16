import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { CheckCircle2, XCircle, Loader2, GraduationCap, Calendar, User, Building2 } from 'lucide-react';
import { verifyDocumentById } from '@/lib/api';
import { getUserMessage } from '@/lib/mapError';
import { MESSAGES } from '@/lib/messages';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import Logo from '@/components/Logo';

const VerificationPage = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [documentData, setDocumentData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const verifyDocument = async () => {
      try {
        const result = await verifyDocumentById(id);

        if (result?.valid) {
          setDocumentData({
            type: result.type,
            studentName: result.student_name,
            title: result.title || result.class_name,
            date: result.date || result.issued_at,
            institutionName: result.institution_name,
            certificateNumber: result.certificate_number,
            verificationCode: result.verification_code,
            themePrimary: result.theme_primary,
            logoUrl: result.institution_logo_url,
          });
          return;
        }

        setError(MESSAGES.DOMAIN.CERTIFICATE_NOT_FOUND);
      } catch (err) {
        setError(getUserMessage(err, { context: 'VerificationPage', fallback: { description: MESSAGES.DOMAIN.CERTIFICATE_VERIFY } }));
      } finally {
        setLoading(false);
      }
    };

    if (id && String(id).trim().length >= 8) verifyDocument();
    else {
      setError('This verification link is invalid. Please check the URL and try again.');
      setLoading(false);
    }
  }, [id]);

  const accent = documentData?.themePrimary || '#2563eb';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 pt-12 font-sans">
      <Helmet><title>Document Verification - Portal</title></Helmet>
      
      <div className="mb-8 scale-125">
         {documentData?.logoUrl ? (
           <img src={documentData.logoUrl} alt="" className="h-12 w-auto object-contain mx-auto" />
         ) : (
           <Logo />
         )}
      </div>

      <Card className="w-full max-w-md shadow-xl border-t-4" style={{ borderTopColor: accent }}>
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl">Credential Verification</CardTitle>
          <CardDescription>Official training center credential registry</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
            {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" style={{ color: accent }} /></div>
            ) : error ? (
                <div className="text-center py-6 space-y-3">
                    <XCircle className="h-16 w-16 text-red-500 mx-auto" />
                    <h3 className="text-lg font-semibold text-red-600">Invalid Document</h3>
                    <p className="text-slate-500 text-sm">{error}</p>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="flex flex-col items-center space-y-2 pb-4 border-b border-slate-100">
                        <CheckCircle2 className="h-16 w-16 text-green-500" />
                        <h3 className="text-lg font-bold text-green-700">Verified Authentic</h3>
                        <p className="text-xs text-slate-400 uppercase tracking-widest">Official Record Found</p>
                    </div>

                    <div className="space-y-4">
                        {documentData.institutionName && (
                          <div className="flex items-start gap-3">
                            <Building2 className="h-5 w-5 text-slate-400 mt-0.5" />
                            <div>
                              <p className="text-xs text-slate-500 uppercase">Institution</p>
                              <p className="font-semibold text-slate-900">{documentData.institutionName}</p>
                            </div>
                          </div>
                        )}

                        <div className="flex items-start gap-3">
                            <User className="h-5 w-5 text-slate-400 mt-0.5" />
                            <div>
                                <p className="text-xs text-slate-500 uppercase">Student</p>
                                <p className="font-semibold text-slate-900">{documentData.studentName}</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <GraduationCap className="h-5 w-5 text-slate-400 mt-0.5" />
                            <div>
                                <p className="text-xs text-slate-500 uppercase">Credential</p>
                                <p className="font-semibold text-slate-900 capitalize">{documentData.type}</p>
                                <p className="text-sm" style={{ color: accent }}>{documentData.title}</p>
                                {documentData.certificateNumber && (
                                  <p className="text-xs text-slate-400 font-mono mt-1">{documentData.certificateNumber}</p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                             <Calendar className="h-5 w-5 text-slate-400 mt-0.5" />
                             <div>
                                 <p className="text-xs text-slate-500 uppercase">Issue Date</p>
                                 <p className="font-medium text-slate-900">{formatDate(documentData.date)}</p>
                             </div>
                        </div>
                    </div>

                    <div className="pt-4 text-center">
                        <p className="text-[10px] text-slate-400">
                            This digital record confirms that the individual named above has completed the requirements for the stated credential.
                        </p>
                    </div>
                </div>
            )}
            <div className="pt-2">
                <Button asChild variant="outline" className="w-full">
                    <Link to="/login">Login to Portal</Link>
                </Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerificationPage;
