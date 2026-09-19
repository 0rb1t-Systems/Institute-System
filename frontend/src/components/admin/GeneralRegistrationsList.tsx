import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle2, XCircle, Search, Loader2, ChevronLeft, ChevronRight, UserCheck } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { formatDate } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { notify, MESSAGES } from '@/lib/notify';

const GeneralRegistrationsList = () => {
  const {
    generalRegistrations,
    approveRegistrationRecord,
    deleteRegistrationRecord,
    updateGeneralRegistration,
    users,
    courses,
    diplomas,
  } = useData();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [rejectDialog, setRejectDialog] = useState(null); // { id, name }
  const [rejectReason, setRejectReason] = useState('');
  const [loadingId, setLoadingId] = useState(null);
  const [createdCreds, setCreatedCreds] = useState(null); // To show after approval

  // Pagination
  const [approvedPage, setApprovedPage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const affiliateNameById = useMemo(() => {
    const map = new Map();
    for (const u of users || []) {
      if (u.role === 'affiliate') {
        map.set(u.id, u.name || u.full_name || u.email || 'Affiliate');
      }
    }
    return map;
  }, [users]);

  const courseNameById = useMemo(() => {
    const map = new Map();
    for (const c of courses || []) map.set(c.id, c.name);
    return map;
  }, [courses]);

  const diplomaNameById = useMemo(() => {
    const map = new Map();
    for (const d of diplomas || []) map.set(d.id, d.name);
    return map;
  }, [diplomas]);

  const resolveAffiliateName = (affiliateId) => {
    if (!affiliateId) return null;
    return affiliateNameById.get(affiliateId) || 'Referred';
  };

  const resolveProgramLabel = (reg) => {
    const name =
      reg.program_name ||
      reg.preferred_course?.name ||
      (reg.preferred_course_id ? courseNameById.get(reg.preferred_course_id) : null) ||
      reg.preferred_diploma?.name ||
      (reg.preferred_diploma_id ? diplomaNameById.get(reg.preferred_diploma_id) : null) ||
      (reg.class?.course_id ? courseNameById.get(reg.class.course_id) : null) ||
      (reg.class?.diploma_id ? diplomaNameById.get(reg.class.diploma_id) : null) ||
      null;
    if (!name) return null;
    const type =
      reg.program_type ||
      (reg.preferred_course || reg.preferred_course_id ? 'course' : null) ||
      (reg.preferred_diploma || reg.preferred_diploma_id ? 'diploma' : null) ||
      reg.class?.program_type ||
      null;
    const typeLabel = type === 'diploma' ? 'Diploma' : type === 'course' ? 'Course' : null;
    return { name, typeLabel };
  };

  // Categorize Registrations
  const { pending, approved, rejected } = useMemo(() => {
    const p = [];
    const a = [];
    const r = [];
    const searchLower = searchTerm.toLowerCase();
    
    generalRegistrations.forEach(reg => {
        const matches = 
            reg.student_name.toLowerCase().includes(searchLower) || 
            reg.student_email.toLowerCase().includes(searchLower) ||
            reg.student_phone?.toLowerCase().includes(searchLower);
        
        if (matches) {
            if (reg.status === 'pending') p.push(reg);
            else if (reg.status === 'approved') a.push(reg);
            else r.push(reg);
        }
    });
    // Newest first
    const byDateDesc = (x, y) => Number(new Date(y.submitted_at)) - Number(new Date(x.submitted_at));
    p.sort(byDateDesc);
    a.sort(byDateDesc);
    return { pending: p, approved: a, rejected: r };
  }, [generalRegistrations, searchTerm]);

  // Pagination Logic
  const totalApprovedPages = Math.max(1, Math.ceil(approved.length / ITEMS_PER_PAGE));
  const safeApprovedPage = Math.min(approvedPage, totalApprovedPages);
  const currentApproved = approved.slice(
    (safeApprovedPage - 1) * ITEMS_PER_PAGE,
    safeApprovedPage * ITEMS_PER_PAGE
  );

  const totalPendingPages = Math.max(1, Math.ceil(pending.length / ITEMS_PER_PAGE));
  const safePendingPage = Math.min(pendingPage, totalPendingPages);
  const currentPending = pending.slice(
    (safePendingPage - 1) * ITEMS_PER_PAGE,
    safePendingPage * ITEMS_PER_PAGE
  );

  const handleApprove = async (reg) => {
    setLoadingId(reg.id);
    try {
      // Use the robust RPC method that creates user, profile, student record, and enrollment
      const response = await approveRegistrationRecord(reg.id, user.id);
      
      if (response?.already_approved) {
          toast({
            title: 'Already approved',
            description: 'This application was already processed. No duplicate account was created.',
          });
      } else {
          const emailNote = response?.emailed
            ? ' Welcome email with login details was sent to the student.'
            : response?.password
              ? ' Welcome email could not be sent — share the credentials below manually.'
              : '';
          toast({
            title: 'Registration Approved',
            description: reg.class_id
              ? `Student ${reg.student_name} has been enrolled successfully.${emailNote}`
              : `Student ${reg.student_name} account created (no class assigned yet).${emailNote}`,
          });
      }

      // Show credentials when a new account was created (admin backup if email fails)
      if (response?.password) {
          setCreatedCreds({
              name: response.name,
              email: response.email,
              username: response.student_code,
              password: response.password
          });
      }
    } catch (error) {
      notify.error(error, {
        context: 'GeneralRegistrationsList.approve',
        title: 'Approval Failed',
        fallback: { description: 'Failed to approve registration.' },
      });
    } finally {
      setLoadingId(null);
    }
  };

  const handleRejectClick = (reg) => {
      setRejectDialog(reg);
      setRejectReason('');
  };

  const confirmReject = async () => {
      if (!rejectDialog) return;
      try {
          const result = await updateGeneralRegistration(rejectDialog.id, { status: 'rejected', rejection_reason: rejectReason });
          toast({
            title: 'Rejected',
            description: result?.emailed
              ? 'The applicant was emailed that their registration was not approved.'
              : 'Registration rejected. The email could not be sent — they can still submit again.',
          });
          setRejectDialog(null);
      } catch (error) {
          notify.error(error, { context: 'GeneralRegistrationsList.reject', fallback: MESSAGES.UPDATE_FAILED });
      }
  };

  const handleDelete = async (id) => {
      if (!window.confirm("Are you sure you want to delete this record permanently?")) return;
      try {
          await deleteRegistrationRecord(id);
          toast({ title: "Success", description: MESSAGES.SUCCESS.DELETED });
      } catch (error) {
          notify.error(error, { context: 'GeneralRegistrationsList.delete', fallback: MESSAGES.DELETE_FAILED });
      }
  };

  return (
    <div className="space-y-8">
        {/* Credentials Modal */}
        <Dialog open={!!createdCreds} onOpenChange={(open) => !open && setCreatedCreds(null)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-[var(--ds-success,#059669)]"><CheckCircle2 /> Approval Successful</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <p className="text-sm text-[var(--ds-text-secondary,#5B6B61)]">The student account has been created. Please share these credentials with the student:</p>
                    <div className="space-y-2 rounded-md border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] p-4 font-mono text-sm">
                        <div className="flex justify-between"><span className="text-[var(--ds-text-tertiary,#8A978E)]">Name:</span> <span className="text-[var(--ds-text-primary,#122018)]">{createdCreds?.name}</span></div>
                        <div className="flex justify-between"><span className="text-[var(--ds-text-tertiary,#8A978E)]">Email:</span> <span className="text-[var(--ds-text-primary,#122018)]">{createdCreds?.email}</span></div>
                        <div className="flex justify-between"><span className="text-[var(--ds-text-tertiary,#8A978E)]">Student ID:</span> <span className="font-bold text-[var(--ds-warning,#C2410C)]">{createdCreds?.username}</span></div>
                        <p className="pt-1 text-xs text-[var(--ds-text-tertiary,#8A978E)]">First password is the Student ID. The student can change it after login.</p>
                        <div className="flex justify-between"><span className="text-[var(--ds-text-tertiary,#8A978E)]">First password (same as ID):</span> <span className="font-bold text-[var(--ds-success,#059669)]">{createdCreds?.password}</span></div>
                    </div>
                    <p className="text-xs italic text-[var(--ds-text-tertiary,#8A978E)]">Usually the password is the same as the Student Code.</p>
                </div>
                <DialogFooter>
                    <Button onClick={() => setCreatedCreds(null)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Rejection Modal */}
        <Dialog open={!!rejectDialog} onOpenChange={(open) => !open && setRejectDialog(null)}>
            <DialogContent>
                <DialogHeader><DialogTitle>Reject Application</DialogTitle></DialogHeader>
                <div className="py-4 space-y-2">
                    <p className="text-sm text-[var(--ds-text-secondary,#5B6B61)]">Reason for rejection (optional):</p>
                    <Textarea 
                        value={rejectReason} 
                        onChange={e => setRejectReason(e.target.value)} 
                        placeholder="e.g. Missing documents, Duplicate application..."
                    />
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setRejectDialog(null)}>Cancel</Button>
                    <Button variant="destructive" onClick={confirmReject}>Confirm Rejection</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ds-text-tertiary,#8A978E)]" />
                <Input 
                    placeholder="Search registrations..." 
                    className="pl-9" 
                    value={searchTerm}
                    onChange={e => {
                      setSearchTerm(e.target.value);
                      setPendingPage(1);
                      setApprovedPage(1);
                    }}
                />
            </div>
        </div>

        {/* SECTION 1: APPROVED HISTORY (MOVED TO TOP AS REQUESTED) */}
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-[var(--ds-success,#059669)]">
                            <UserCheck className="h-5 w-5" /> Approved Students History
                        </CardTitle>
                        <CardDescription>Students who have been successfully registered via online forms.</CardDescription>
                    </div>
                    <Badge variant="outline" className="border-[var(--ds-success,#059669)] text-[var(--ds-success,#059669)]">{approved.length} Total</Badge>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Student</TableHead>
                            <TableHead className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Program</TableHead>
                            <TableHead className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Affiliate</TableHead>
                            <TableHead className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Date</TableHead>
                            <TableHead className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentApproved.length > 0 ? (
                            currentApproved.map(reg => (
                                <TableRow key={reg.id}>
                                    <TableCell className="px-5">
                                        <div className="font-medium text-[var(--ds-text-primary,#122018)]">{reg.student_name}</div>
                                        <div className="text-xs text-[var(--ds-text-tertiary,#8A978E)]">{reg.student_email}</div>
                                    </TableCell>
                                    <TableCell className="px-5 text-[var(--ds-text-secondary,#5B6B61)]">
                                      {(() => {
                                        const program = resolveProgramLabel(reg);
                                        if (!program) {
                                          return <span className="italic text-[var(--ds-text-tertiary,#8A978E)]">No program selected</span>;
                                        }
                                        return (
                                          <div>
                                            <div className="font-medium text-[var(--ds-text-primary,#122018)]">{program.name}</div>
                                            {program.typeLabel ? (
                                              <div className="text-[11px] text-[var(--ds-text-tertiary,#8A978E)]">{program.typeLabel}</div>
                                            ) : null}
                                          </div>
                                        );
                                      })()}
                                    </TableCell>
                                    <TableCell className="px-5 text-sm text-[var(--ds-accent,#1F8A5B)]">
                                        {resolveAffiliateName(reg.affiliate_id) || '—'}
                                    </TableCell>
                                    <TableCell className="px-5 text-xs text-[var(--ds-text-secondary,#5B6B61)]">{formatDate(reg.submitted_at)}</TableCell>
                                    <TableCell className="px-5 text-right">
                                        <Badge className="border-0 bg-[var(--ds-success-bg,#ECFDF5)] text-[var(--ds-success,#059669)]">Approved</Badge>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="py-8 text-center text-[var(--ds-text-tertiary,#8A978E)]">No approved registrations found.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
                
                {/* Approved Pagination */}
                {approved.length > ITEMS_PER_PAGE && (
                    <div className="flex items-center justify-end gap-2 mt-4">
                        <Button variant="outline" size="sm" onClick={() => setApprovedPage(p => Math.max(1, p - 1))} disabled={safeApprovedPage === 1}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-xs text-[var(--ds-text-secondary,#5B6B61)]">Page {safeApprovedPage} of {totalApprovedPages}</span>
                        <Button variant="outline" size="sm" onClick={() => setApprovedPage(p => Math.min(totalApprovedPages, p + 1))} disabled={safeApprovedPage === totalApprovedPages}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>

        {/* SECTION 2: PENDING REGISTRATIONS */}
        <Card className="border-l-4 border-l-[var(--ds-warning,#C2410C)]">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-[var(--ds-warning,#C2410C)]">Pending Applications</CardTitle>
                        <CardDescription>New registrations waiting for review and approval.</CardDescription>
                    </div>
                    <Badge className="bg-[var(--ds-warning,#C2410C)] text-[var(--ds-text-on-primary,#fff)]">{pending.length} Pending</Badge>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Applicant</TableHead>
                            <TableHead className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Details</TableHead>
                            <TableHead className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Program</TableHead>
                            <TableHead className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Affiliate</TableHead>
                            <TableHead className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Date</TableHead>
                            <TableHead className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentPending.length > 0 ? (
                            currentPending.map(reg => (
                                <TableRow key={reg.id}>
                                    <TableCell className="px-5">
                                        <div className="font-medium text-[var(--ds-text-primary,#122018)]">{reg.student_name}</div>
                                        <div className="text-xs text-[var(--ds-text-tertiary,#8A978E)]">{reg.student_email}</div>
                                        <div className="text-xs text-[var(--ds-text-tertiary,#8A978E)]">{reg.student_phone}</div>
                                    </TableCell>
                                    <TableCell className="px-5 text-xs text-[var(--ds-text-secondary,#5B6B61)]">
                                        <div>{reg.university}</div>
                                        <div>{reg.faculty}</div>
                                        <div>Year: {reg.year}</div>
                                    </TableCell>
                                    <TableCell className="px-5 font-medium text-[var(--ds-text-primary,#122018)]">
                                      {(() => {
                                        const program = resolveProgramLabel(reg);
                                        if (!program) {
                                          return <span className="italic text-[var(--ds-text-tertiary,#8A978E)]">No program selected</span>;
                                        }
                                        return (
                                          <div>
                                            <div>{program.name}</div>
                                            {program.typeLabel ? (
                                              <div className="text-[11px] font-normal text-[var(--ds-text-tertiary,#8A978E)]">{program.typeLabel}</div>
                                            ) : null}
                                          </div>
                                        );
                                      })()}
                                    </TableCell>
                                    <TableCell className="px-5 text-sm text-[var(--ds-accent,#1F8A5B)]">
                                        {resolveAffiliateName(reg.affiliate_id) || '—'}
                                    </TableCell>
                                    <TableCell className="px-5 text-xs text-[var(--ds-text-secondary,#5B6B61)]">{formatDate(reg.submitted_at)}</TableCell>
                                    <TableCell className="px-5 text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button size="sm" variant="ghost" className="text-[var(--ds-danger,#DC2626)] hover:bg-[var(--ds-danger-bg,#FEF2F2)] hover:text-[var(--ds-danger,#DC2626)]" onClick={() => handleRejectClick(reg)}>
                                                <XCircle className="h-4 w-4 mr-1" /> Reject
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                className="bg-[var(--ds-success,#059669)] text-[var(--ds-text-on-primary,#fff)] hover:opacity-90" 
                                                onClick={() => handleApprove(reg)}
                                                disabled={loadingId === reg.id}
                                            >
                                                {loadingId === reg.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                                                Approve
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="py-12 text-center text-[var(--ds-text-tertiary,#8A978E)]">
                                    <div className="flex flex-col items-center gap-2">
                                        <CheckCircle2 className="h-8 w-8 opacity-40" />
                                        <span>No pending applications. You're all caught up!</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>

                {/* Pending Pagination */}
                {pending.length > ITEMS_PER_PAGE && (
                    <div className="flex items-center justify-between gap-2 mt-4">
                        <span className="text-xs text-[var(--ds-text-tertiary,#8A978E)]">
                            Showing {(safePendingPage - 1) * ITEMS_PER_PAGE + 1}–
                            {Math.min(safePendingPage * ITEMS_PER_PAGE, pending.length)} of {pending.length}
                        </span>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setPendingPage(p => Math.max(1, p - 1))} disabled={safePendingPage === 1}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-xs text-[var(--ds-text-secondary,#5B6B61)]">Page {safePendingPage} of {totalPendingPages}</span>
                            <Button variant="outline" size="sm" onClick={() => setPendingPage(p => Math.min(totalPendingPages, p + 1))} disabled={safePendingPage === totalPendingPages}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>

        {/* SECTION 3: REJECTED HISTORY (Collapsed or at bottom) */}
        {rejected.length > 0 && (
             <Card>
                <CardHeader><CardTitle className="text-sm text-[var(--ds-text-tertiary,#8A978E)]">Rejected Applications History</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="h-8 px-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Name</TableHead>
                            <TableHead className="h-8 px-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Reason</TableHead>
                            <TableHead className="h-8 px-5 text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rejected.slice(0, 5).map(reg => (
                                <TableRow key={reg.id}>
                                    <TableCell className="px-5 py-2 text-[var(--ds-text-secondary,#5B6B61)]">{reg.student_name}</TableCell>
                                    <TableCell className="px-5 py-2 text-xs italic text-[var(--ds-text-tertiary,#8A978E)]">{reg.rejection_reason || 'No reason provided'}</TableCell>
                                    <TableCell className="px-5 py-2 text-right">
                                        <Button variant="ghost" size="sm" className="h-6 text-[var(--ds-danger,#DC2626)] hover:bg-[var(--ds-danger-bg,#FEF2F2)]" onClick={() => handleDelete(reg.id)}>Delete</Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        )}
    </div>
  );
};

export default GeneralRegistrationsList;