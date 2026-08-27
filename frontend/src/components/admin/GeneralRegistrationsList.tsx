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
  const { generalRegistrations, approveRegistrationRecord, deleteRegistrationRecord, updateGeneralRegistration, users } = useData();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [rejectDialog, setRejectDialog] = useState(null); // { id, name }
  const [rejectReason, setRejectReason] = useState('');
  const [loadingId, setLoadingId] = useState(null);
  const [createdCreds, setCreatedCreds] = useState(null); // To show after approval

  // Pagination State for Approved List
  const [approvedPage, setApprovedPage] = useState(1);
  const APPROVED_ITEMS_PER_PAGE = 10;

  const affiliateNameById = useMemo(() => {
    const map = new Map();
    for (const u of users || []) {
      if (u.role === 'affiliate') {
        map.set(u.id, u.name || u.full_name || u.email || 'Affiliate');
      }
    }
    return map;
  }, [users]);

  const resolveAffiliateName = (affiliateId) => {
    if (!affiliateId) return null;
    return affiliateNameById.get(affiliateId) || 'Referred';
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
    // Sort Approved by date desc (newest first)
    a.sort((x, y) => Number(new Date(y.submitted_at)) - Number(new Date(x.submitted_at)));
    return { pending: p, approved: a, rejected: r };
  }, [generalRegistrations, searchTerm]);

  // Pagination Logic for Approved
  const totalApprovedPages = Math.ceil(approved.length / APPROVED_ITEMS_PER_PAGE);
  const currentApproved = approved.slice((approvedPage - 1) * APPROVED_ITEMS_PER_PAGE, approvedPage * APPROVED_ITEMS_PER_PAGE);

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
            <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
                <DialogHeader>
                    <DialogTitle className="text-green-400 flex items-center gap-2"><CheckCircle2 /> Approval Successful</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <p className="text-sm text-slate-300">The student account has been created. Please share these credentials with the student:</p>
                    <div className="bg-slate-950 p-4 rounded-md border border-slate-800 space-y-2 font-mono text-sm">
                        <div className="flex justify-between"><span className="text-slate-500">Name:</span> <span className="text-white">{createdCreds?.name}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Email:</span> <span className="text-white">{createdCreds?.email}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Student ID:</span> <span className="text-yellow-400 font-bold">{createdCreds?.username}</span></div>
                        <p className="text-xs text-slate-500 pt-1">First password is the Student ID. The student can change it after login.</p>
                        <div className="flex justify-between"><span className="text-slate-500">First password (same as ID):</span> <span className="text-green-400 font-bold">{createdCreds?.password}</span></div>
                    </div>
                    <p className="text-xs text-slate-500 italic">Usually the password is the same as the Student Code.</p>
                </div>
                <DialogFooter>
                    <Button onClick={() => setCreatedCreds(null)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Rejection Modal */}
        <Dialog open={!!rejectDialog} onOpenChange={(open) => !open && setRejectDialog(null)}>
            <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
                <DialogHeader><DialogTitle>Reject Application</DialogTitle></DialogHeader>
                <div className="py-4 space-y-2">
                    <p className="text-sm text-slate-400">Reason for rejection (optional):</p>
                    <Textarea 
                        value={rejectReason} 
                        onChange={e => setRejectReason(e.target.value)} 
                        placeholder="e.g. Missing documents, Duplicate application..."
                        className="bg-slate-950 border-slate-800"
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                    placeholder="Search registrations..." 
                    className="pl-9 bg-slate-900/50 border-slate-700" 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        {/* SECTION 1: APPROVED HISTORY (MOVED TO TOP AS REQUESTED) */}
        <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-green-500">
                            <UserCheck className="h-5 w-5" /> Approved Students History
                        </CardTitle>
                        <CardDescription>Students who have been successfully registered via online forms.</CardDescription>
                    </div>
                    <Badge variant="outline" className="text-green-500 border-green-500/50">{approved.length} Total</Badge>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow className="border-slate-800 hover:bg-slate-800/50">
                            <TableHead className="text-slate-400">Student</TableHead>
                            <TableHead className="text-slate-400">Class Applied</TableHead>
                            <TableHead className="text-slate-400">Affiliate</TableHead>
                            <TableHead className="text-slate-400">Date</TableHead>
                            <TableHead className="text-slate-400 text-right">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentApproved.length > 0 ? (
                            currentApproved.map(reg => (
                                <TableRow key={reg.id} className="border-slate-800 hover:bg-slate-800/50">
                                    <TableCell>
                                        <div className="font-medium text-slate-200">{reg.student_name}</div>
                                        <div className="text-xs text-slate-500">{reg.student_email}</div>
                                    </TableCell>
                                    <TableCell className="text-slate-300">
                                      {reg.class?.name || (
                                        <span className="text-slate-500 italic">No class selected</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-purple-300 text-sm">
                                        {resolveAffiliateName(reg.affiliate_id) || '—'}
                                    </TableCell>
                                    <TableCell className="text-slate-400 text-xs">{formatDate(reg.submitted_at)}</TableCell>
                                    <TableCell className="text-right">
                                        <Badge className="bg-green-500/20 text-green-400 border-0">Approved</Badge>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-slate-500">No approved registrations found.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
                
                {/* Approved Pagination */}
                {totalApprovedPages > 1 && (
                    <div className="flex items-center justify-end gap-2 mt-4">
                        <Button variant="outline" size="sm" onClick={() => setApprovedPage(p => Math.max(1, p - 1))} disabled={approvedPage === 1}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-xs text-slate-400">Page {approvedPage} of {totalApprovedPages}</span>
                        <Button variant="outline" size="sm" onClick={() => setApprovedPage(p => Math.min(totalApprovedPages, p + 1))} disabled={approvedPage === totalApprovedPages}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>

        {/* SECTION 2: PENDING REGISTRATIONS */}
        <Card className="bg-slate-900/50 border-slate-800 border-l-4 border-l-orange-500">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-orange-400">Pending Applications</CardTitle>
                        <CardDescription>New registrations waiting for review and approval.</CardDescription>
                    </div>
                    <Badge className="bg-orange-500 text-white">{pending.length} Pending</Badge>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow className="border-slate-800 hover:bg-slate-800/50">
                            <TableHead className="text-slate-400">Applicant</TableHead>
                            <TableHead className="text-slate-400">Details</TableHead>
                            <TableHead className="text-slate-400">Class</TableHead>
                            <TableHead className="text-slate-400">Affiliate</TableHead>
                            <TableHead className="text-slate-400">Date</TableHead>
                            <TableHead className="text-right text-slate-400">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {pending.length > 0 ? (
                            pending.map(reg => (
                                <TableRow key={reg.id} className="border-slate-800 hover:bg-slate-800/50">
                                    <TableCell>
                                        <div className="font-medium text-slate-200">{reg.student_name}</div>
                                        <div className="text-xs text-slate-500">{reg.student_email}</div>
                                        <div className="text-xs text-slate-500">{reg.student_phone}</div>
                                    </TableCell>
                                    <TableCell className="text-xs text-slate-400">
                                        <div>{reg.university}</div>
                                        <div>{reg.faculty}</div>
                                        <div>Year: {reg.year}</div>
                                    </TableCell>
                                    <TableCell className="text-slate-300 font-medium">
                                      {reg.class?.name || (
                                        <span className="text-slate-500 italic">No class selected</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-purple-300 text-sm">
                                        {resolveAffiliateName(reg.affiliate_id) || '—'}
                                    </TableCell>
                                    <TableCell className="text-slate-400 text-xs">{formatDate(reg.submitted_at)}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-900/20" onClick={() => handleRejectClick(reg)}>
                                                <XCircle className="h-4 w-4 mr-1" /> Reject
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                className="bg-green-600 hover:bg-green-700 text-white" 
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
                                <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                                    <div className="flex flex-col items-center gap-2">
                                        <CheckCircle2 className="h-8 w-8 text-slate-600" />
                                        <span>No pending applications. You're all caught up!</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

        {/* SECTION 3: REJECTED HISTORY (Collapsed or at bottom) */}
        {rejected.length > 0 && (
             <Card className="bg-slate-900/30 border-slate-800">
                <CardHeader><CardTitle className="text-sm text-slate-500">Rejected Applications History</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow className="border-slate-800"><TableHead className="text-slate-500 h-8">Name</TableHead><TableHead className="text-slate-500 h-8">Reason</TableHead><TableHead className="text-right text-slate-500 h-8">Action</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {rejected.slice(0, 5).map(reg => (
                                <TableRow key={reg.id} className="border-slate-800 hover:bg-slate-800/30">
                                    <TableCell className="text-slate-500 py-2">{reg.student_name}</TableCell>
                                    <TableCell className="text-slate-500 py-2 text-xs italic">{reg.rejection_reason || 'No reason provided'}</TableCell>
                                    <TableCell className="text-right py-2">
                                        <Button variant="ghost" size="sm" className="h-6 text-red-900 hover:text-red-700" onClick={() => handleDelete(reg.id)}>Delete</Button>
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