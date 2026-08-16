import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Award, Download, Eye, Loader2, FileText } from 'lucide-react';
import { getCertificatesByStudent, getStudentByProfileId } from '@/lib/api';
import { notify, MESSAGES } from '@/lib/notify';
import CertificateViewModal from '@/components/certificates/CertificateViewModal';
import { formatDate } from '@/lib/utils';

/**
 * Student issued-certificates list.
 * Deep link: /portal/certificate/:certificateId opens that certificate in the modal.
 */
const StudentPortalCertificate = () => {
  const { user } = useAuth();
  const { certificateId: paramId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [certificates, setCertificates] = useState([]);
  const [selectedCertificateId, setSelectedCertificateId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchStudentCertificates();
    }
  }, [user?.id]);

  // Open modal when deep-linked to a specific issued certificate
  useEffect(() => {
    if (!paramId || loading) return;
    const match = certificates.find((c) => c.id === paramId);
    if (match) {
      setSelectedCertificateId(paramId);
      setModalOpen(true);
    }
  }, [paramId, certificates, loading]);

  const fetchStudentCertificates = async () => {
    setLoading(true);
    try {
      const student =
        (await getStudentByProfileId(user.id)) ||
        (user.studentId ? { id: user.studentId } : null);

      if (!student?.id) {
        notify.error(new Error('STUDENT_NOT_FOUND'), {
          context: 'StudentPortalCertificate',
          fallback: { title: 'Error', description: MESSAGES.DOMAIN.STUDENT_NOT_FOUND },
        });
        return;
      }

      const data = await getCertificatesByStudent(student.id);
      setCertificates(data || []);
    } catch (error) {
      notify.error(error, { context: 'StudentPortalCertificate - load', fallback: MESSAGES.LOAD_FAILED });
    } finally {
      setLoading(false);
    }
  };

  const handleViewCertificate = (certificateId) => {
    setSelectedCertificateId(certificateId);
    setModalOpen(true);
    if (paramId !== certificateId) {
      navigate(`/portal/certificate/${certificateId}`, { replace: true });
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedCertificateId(null);
    if (paramId) {
      navigate('/portal/certificates', { replace: true });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'issued':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'generated':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'revoked':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  if (user?.role !== 'student') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      <Helmet>
        <title>My Certificates - Student Portal</title>
        <meta name="description" content="View and download your certificates" />
      </Helmet>

      <div className="min-h-screen bg-slate-950 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Award className="h-8 w-8 text-blue-500" />
              <h1 className="text-3xl font-bold text-white">My Certificates</h1>
            </div>
            <p className="text-slate-400">View, download, and print your certificates</p>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <span className="ml-3 text-slate-300">Loading certificates...</span>
            </div>
          )}

          {!loading && certificates.length === 0 && (
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="py-16">
                <div className="text-center">
                  <FileText className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">No Certificates Yet</h3>
                  <p className="text-slate-400">
                    You don't have any certificates at the moment. Complete your courses to earn certificates.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {!loading && certificates.length > 0 && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {certificates.map((cert) => (
                <Card
                  key={cert.id}
                  className="bg-slate-900 border-slate-800 hover:border-blue-500/50 transition-colors"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <Award className="h-6 w-6 text-blue-500" />
                      <Badge variant="outline" className={getStatusColor(cert.status)}>
                        {cert.status?.toUpperCase()}
                      </Badge>
                    </div>
                    <CardTitle className="text-white line-clamp-2">
                      {cert.diploma?.name || cert.course?.name || cert.class?.name || 'Certificate'}
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      Issued: {formatDate(cert.date_issued || cert.issued_at)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Certificate No:</span>
                          <span className="text-white font-mono text-xs">{cert.certificate_number}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Serial No:</span>
                          <span className="text-white font-mono text-xs">{cert.serial_number}</span>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewCertificate(cert.id)}
                          className="flex-1 border-slate-700 hover:border-blue-500"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                        <Button size="sm" onClick={() => handleViewCertificate(cert.id)} className="flex-1">
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <CertificateViewModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        certificateId={selectedCertificateId}
      />
    </>
  );
};

export default StudentPortalCertificate;
