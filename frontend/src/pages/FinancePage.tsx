import React, { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { PlusCircle, CheckCircle2, XCircle, AlertCircle, Lock, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { notify, MESSAGES } from '@/lib/notify';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FinanceStats from '@/components/finance/FinanceStats';
import StudentFinanceList from '@/components/finance/StudentFinanceList';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatCurrency, formatDate, getMonthsBetween } from '@/lib/utils';
import { getRegistrationFeeAmount } from '@/lib/institution';
import { computeStudentBalance, mustPayRegistrationFirst } from '@/lib/finance';

// --- Payment Form Component ---
const PaymentForm = ({ closeDialog, preSelectedStudentId, existingPayment, financials, initialMode = 'payment' }) => {
  const { students, classes, enrollments, addPayment, updatePaymentData, payments, refreshData } = useData();
  const { institution } = useAuth();
  const { toast } = useToast();
  const registrationFee = getRegistrationFeeAmount(institution);
  
  const isEditing = !!existingPayment;
  const targetStudentId = existingPayment ? existingPayment.student_id : preSelectedStudentId;
  const studentFin = financials.find(f => f.student.id === targetStudentId);
  const activeEnrollment = studentFin?.activeEnrollment;
  const activeClass = classes.find(c => c.id === (existingPayment?.class_id || activeEnrollment?.class_id));

  // Determine Monthly Discount
  const monthlyDiscount = activeEnrollment?.discount_amount ? Number(activeEnrollment.discount_amount) : 0;
  
  // Calculate Standard Monthly Fee
  const standardMonthlyFee = useMemo(() => {
      if(!activeClass) return 0;
      const fee = Number(activeClass.fee || 0);
      const duration = activeClass.duration_months || 1;
      return duration > 0 ? fee / duration : fee;
  }, [activeClass]);

  // Apply Discount to Monthly Fee
  const discountedMonthlyFee = Math.max(0, standardMonthlyFee - monthlyDiscount);
  
  const [formData, setFormData] = useState({
      student_id: targetStudentId || '',
      class_id: activeClass?.id || '',
      amount: existingPayment ? existingPayment.amount : '', 
      method: existingPayment?.method || (initialMode === 'charge' ? 'other' : 'cash'),
      month_paid: existingPayment?.month_paid || '',
      type: existingPayment ? (existingPayment.is_registration_fee ? 'registration' : 'tuition') : 'tuition',
      notes: existingPayment?.notes || '',
      payment_date: existingPayment ? existingPayment.payment_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      status: existingPayment?.status || (initialMode === 'charge' ? 'pending' : 'completed')
  });

  const studentClasses = useMemo(() => {
      if (!formData.student_id) return [];
      const studentEnrollmentIds = enrollments
        .filter(e => e.student_id === formData.student_id)
        .map(e => e.class_id);
      return classes.filter(c => studentEnrollmentIds.includes(c.id));
  }, [classes, enrollments, formData.student_id]);

  const validMonths = useMemo(() => {
      if (!activeClass?.start_date || !activeClass?.end_date) return [];
      return getMonthsBetween(activeClass.start_date, activeClass.end_date);
  }, [activeClass]);

  const paidMonths = useMemo(() => {
      if (!targetStudentId || !formData.class_id) return new Set();
      return new Set(
          payments
            .filter(p => 
                p.student_id === targetStudentId && 
                p.class_id === formData.class_id && 
                p.month_paid && 
                p.id !== existingPayment?.id
            )
            .map(p => p.month_paid)
      );
  }, [payments, targetStudentId, formData.class_id, existingPayment]);
  
  const hasExistingRegFee = useMemo(() => {
      if (!targetStudentId) return false;
      return payments.some(p => 
          p.student_id === targetStudentId && 
          p.is_registration_fee === true &&
          (p.status === 'completed' || !p.status) &&
          p.id !== existingPayment?.id 
      );
  }, [payments, targetStudentId, existingPayment]);

  const studentPaymentsForGate = useMemo(() => {
      const sid = formData.student_id || targetStudentId;
      if (!sid) return [];
      return payments.filter(
        (p) =>
          p.student_id === sid &&
          p.id !== existingPayment?.id
      );
  }, [payments, formData.student_id, targetStudentId, existingPayment]);

  const requiresRegistrationFirst = useMemo(() => {
      if (isEditing && existingPayment?.is_registration_fee) return false;
      return mustPayRegistrationFirst({
        payments: studentPaymentsForGate,
        institution,
        registrationFeeAmount: registrationFee,
      });
  }, [isEditing, existingPayment, studentPaymentsForGate, institution, registrationFee]);

  const getNextMonth = () => {
      if (!validMonths.length) return new Date().toISOString().slice(0, 7);
      for (const m of validMonths) {
          if (!paidMonths.has(m)) return m;
      }
      return '';
  };

  useEffect(() => {
      if (!isEditing && !formData.amount && !formData.month_paid) {
         const type =
           requiresRegistrationFirst || (!hasExistingRegFee && registrationFee > 0 && preSelectedStudentId)
             ? 'registration'
             : 'tuition';
         let amount = type === 'registration' ? String(registrationFee) : discountedMonthlyFee.toFixed(2);
         let month = type === 'tuition' ? getNextMonth() : '';
         setFormData(prev => ({ ...prev, type, amount, month_paid: month }));
      }
  }, [isEditing, hasExistingRegFee, requiresRegistrationFirst, preSelectedStudentId, discountedMonthlyFee, validMonths, paidMonths, registrationFee]);

  useEffect(() => {
      if (!isEditing && requiresRegistrationFirst && formData.type !== 'registration') {
          setFormData(prev => ({
            ...prev,
            type: 'registration',
            amount: String(registrationFee),
            month_paid: '',
          }));
      }
  }, [requiresRegistrationFirst, isEditing, formData.type, registrationFee]);

  useEffect(() => {
      if (!isEditing) {
          if (formData.type === 'registration') {
              setFormData(prev => ({ ...prev, amount: String(registrationFee), month_paid: '' }));
          } else if (formData.type === 'tuition') {
               setFormData(prev => ({ ...prev, amount: discountedMonthlyFee.toFixed(2), month_paid: getNextMonth() }));
          }
      }
  }, [formData.type, discountedMonthlyFee]);

  const handleStudentChange = (sid) => {
      if (isEditing) return; 
      
      const studentPays = payments.filter((p) => p.student_id === sid);
      const mustRegFirst = mustPayRegistrationFirst({
        payments: studentPays,
        institution,
        registrationFeeAmount: registrationFee,
      });
      const hasReg = !mustRegFirst && studentPays.some(
        (p) => p.is_registration_fee === true && (p.status === 'completed' || !p.status)
      );
      const studentEnrollment = enrollments.find(e => e.student_id === sid);
      const studentClassId = studentEnrollment?.class_id;
      const studentClass = classes.find(c => c.id === studentClassId);
      
      const cFee = studentClass ? Number(studentClass.fee || 0) : 0;
      const cDur = studentClass ? (studentClass.duration_months || 1) : 1;
      const mFee = cDur > 0 ? cFee / cDur : cFee;
      
      // Calculate specific student discount for payment form default
      const sDiscount = studentEnrollment?.discount_amount ? Number(studentEnrollment.discount_amount) : 0;
      const finalMFee = Math.max(0, mFee - sDiscount);

      const forceRegistration = mustRegFirst || (!hasReg && registrationFee > 0);

      setFormData(prev => ({ 
          ...prev, 
          student_id: sid, 
          class_id: studentClass?.id || '',
          type: forceRegistration ? 'registration' : 'tuition', 
          amount: forceRegistration ? String(registrationFee) : finalMFee.toFixed(2),
          month_paid: forceRegistration ? '' : prev.month_paid,
      }));
  };

  const validation = useMemo(() => {
      if (requiresRegistrationFirst && formData.type !== 'registration') {
          return {
            valid: false,
            error: MESSAGES.DOMAIN.REGISTRATION_FEE_FIRST,
            requiresRegistration: true,
          };
      }
      if (formData.type === 'registration') {
          if (!formData.student_id) return { valid: false };
          if (!formData.class_id) {
              return { valid: false, error: 'Select the class/enrollment for this registration payment.' };
          }
      }
      if (formData.type === 'tuition') {
          if (!formData.student_id) return { valid: false };
          if (!formData.class_id) return { valid: false };
          if (!formData.month_paid) return { valid: false, error: "Please select a month." };
          if (validMonths.length > 0 && !validMonths.includes(formData.month_paid)) {
              return { valid: false, error: "Selected month is outside of the class duration.", isInvalidMonth: true };
          }
          if (paidMonths.has(formData.month_paid)) {
              return { valid: false, error: `A payment for ${formData.month_paid} is already recorded.`, isDuplicate: true };
          }
      }
      return { valid: true };
  }, [formData, paidMonths, validMonths, requiresRegistrationFirst]);

  const handleSubmit = async (e) => {
      e.preventDefault();
      if (!validation.valid) return;

      try {
          const isRegistration = formData.type === 'registration';
          if (requiresRegistrationFirst && !isRegistration) {
              toast({
                title: 'Registration fee required',
                description: MESSAGES.DOMAIN.REGISTRATION_FEE_FIRST,
                variant: 'destructive',
              });
              return;
          }
          const methodMap = {
            Cash: 'cash',
            'EVC Plus': 'other',
            'Bank Transfer': 'bank',
            Pending: 'other',
            cash: 'cash',
            bank: 'bank',
            other: 'other',
          };
          const paymentPayload = {
              student_id: formData.student_id,
              class_id: formData.class_id || null,
              amount: formData.amount,
              method: methodMap[formData.method] || 'cash',
              month_paid: isRegistration ? null : formData.month_paid,
              is_registration_fee: isRegistration,
              notes: formData.notes,
              note: formData.notes || formData.month_paid || null,
              payment_date: new Date(formData.payment_date).toISOString(),
              status: formData.status
          };
          
          if (isEditing) {
              await updatePaymentData(existingPayment.id, paymentPayload);
              toast({ title: "Success", description: MESSAGES.SUCCESS.UPDATED });
          } else {
              await addPayment(paymentPayload);
              toast({ title: "Success", description: MESSAGES.SUCCESS.PAYMENT_RECORDED });
          }

          await refreshData();
          closeDialog();
      } catch(e) {
          notify.error(e, { context: 'FinancePage - savePayment', fallback: { title: 'Error', description: MESSAGES.DOMAIN.PAYMENT_SAVE } });
      }
  };

  return (
      <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
              <Label>Student</Label>
              <Select value={formData.student_id} onValueChange={handleStudentChange} required disabled={!!preSelectedStudentId || isEditing}>
                  <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                      {students.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.student_code})</SelectItem>)}
                  </SelectContent>
              </Select>
          </div>

          {requiresRegistrationFirst && (
              <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100">
                  <Lock className="h-4 w-4" />
                  <AlertTitle>Registration fee required first</AlertTitle>
                  <AlertDescription>
                      This student cannot pay tuition or other fees until the registration fee ({formatCurrency(registrationFee)}) is recorded.
                  </AlertDescription>
              </Alert>
          )}

          <div className="space-y-2">
              <Label>Payment Type</Label>
              <Select
                value={formData.type}
                onValueChange={v => setFormData({
                  ...formData, 
                  type: v,
                  month_paid: v === 'tuition' ? getNextMonth() : ''
                })}
                disabled={requiresRegistrationFirst && !isEditing}
              >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                      {!requiresRegistrationFirst && (
                        <SelectItem value="tuition">Tuition / Class Fee</SelectItem>
                      )}
                      {((!hasExistingRegFee && registrationFee > 0) || requiresRegistrationFirst || (isEditing && existingPayment?.is_registration_fee)) && (
                          <SelectItem value="registration">Registration Fee ({formatCurrency(registrationFee)})</SelectItem>
                      )}
                      {!requiresRegistrationFirst && (
                        <SelectItem value="other">Other/Misc</SelectItem>
                      )}
                  </SelectContent>
              </Select>
          </div>

          {(formData.type === 'tuition' || formData.type === 'registration') && (
              <>
                <div className={formData.type === 'tuition' ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : 'space-y-2'}>
                    <div className="space-y-2">
                        <Label>Class</Label>
                        <Select value={formData.class_id} onValueChange={(v) => setFormData({...formData, class_id: v, month_paid: ''})}>
                            <SelectTrigger><SelectValue placeholder="Select class..." /></SelectTrigger>
                            <SelectContent>
                                {studentClasses.length > 0 ? (
                                    studentClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
                                ) : (
                                    <SelectItem value="none" disabled>No enrolled classes found</SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                    {formData.type === 'tuition' && (
                    <div className="space-y-2">
                        <Label>For Month</Label>
                        {activeClass && validMonths.length > 0 ? (
                            <Select value={formData.month_paid} onValueChange={v => setFormData({...formData, month_paid: v})}>
                                <SelectTrigger className={validation.isDuplicate || validation.isInvalidMonth ? "border-red-500 focus:ring-red-500" : ""}>
                                    <SelectValue placeholder="Select billing month" />
                                </SelectTrigger>
                                <SelectContent>
                                    {validMonths.map(m => (
                                        <SelectItem 
                                            key={m} 
                                            value={m} 
                                            disabled={paidMonths.has(m) && m !== existingPayment?.month_paid} 
                                            className={paidMonths.has(m) ? "opacity-50" : ""}
                                        >
                                            {m} {paidMonths.has(m) && m !== existingPayment?.month_paid ? '(Paid)' : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <Input 
                                type="month" 
                                value={formData.month_paid} 
                                onChange={e => setFormData({...formData, month_paid: e.target.value})}
                            />
                        )}
                    </div>
                    )}
                </div>
                {validation.error && (formData.type === 'tuition' || formData.type === 'registration') && (
                    <Alert variant="destructive" className="py-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Invalid Selection</AlertTitle>
                        <AlertDescription>{validation.error}</AlertDescription>
                    </Alert>
                )}
              </>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="space-y-2">
                  <Label>Amount ($)</Label>
                  <Input 
                    type="number" 
                    value={formData.amount} 
                    onChange={e => setFormData({...formData, amount: e.target.value})} 
                    required 
                    readOnly={formData.type === 'registration' && !isEditing}
                  />
                  {monthlyDiscount > 0 && formData.type === 'tuition' && (
                     <div className="text-[10px] text-green-500 text-right">
                        Discount applied: -{formatCurrency(monthlyDiscount)}
                     </div>
                  )}
               </div>
               <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v})}>
                      <SelectTrigger className={formData.status === 'pending' ? 'text-orange-500 font-medium' : 'text-green-500 font-medium'}><SelectValue /></SelectTrigger>
                      <SelectContent>
                          <SelectItem value="completed" className="text-green-600">Completed (Paid)</SelectItem>
                          <SelectItem value="pending" className="text-orange-500">Pending (Charge/Invoice)</SelectItem>
                      </SelectContent>
                  </Select>
               </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="space-y-2">
                  <Label>Method</Label>
                   <Select value={formData.method} onValueChange={v => setFormData({...formData, method: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="bank">Bank Transfer</SelectItem>
                          <SelectItem value="other">Other / EVC</SelectItem>
                      </SelectContent>
                  </Select>
               </div>
               <div className="space-y-2">
                  <Label>Date</Label>
                  <Input 
                      type="date" 
                      value={formData.payment_date} 
                      onChange={e => setFormData({...formData, payment_date: e.target.value})} 
                      required 
                  />
               </div>
          </div>

          <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Optional notes..." />
          </div>
          <DialogFooter>
              <Button 
                type="submit" 
                className={`w-full disabled:opacity-50 disabled:cursor-not-allowed ${formData.status === 'pending' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'}`}
                disabled={!validation.valid}
              >
                {validation.isDuplicate ? "Record Exists" : (isEditing ? "Update Record" : (initialMode === 'charge' ? "Create Charge" : "Record Payment"))}
              </Button>
          </DialogFooter>
      </form>
  );
};

// --- Withdrawal List Component ---
const WithdrawalApprovalList = () => {
    const { withdrawalRequests, approveWithdrawal, users } = useData();
    const { user, institution } = useAuth();
    const { toast } = useToast();

    // Sort by requested_at descending
    const sortedRequests = useMemo(() => [...withdrawalRequests].sort((a, b) => Number(new Date(b.requested_at)) - Number(new Date(a.requested_at))), [withdrawalRequests]);

    const pendingRequests = sortedRequests.filter(r => r.status === 'pending');
    const historyRequests = sortedRequests.filter(r => r.status !== 'pending');

    const instructorName = (instructorId) =>
      users.find((u) => u.id === instructorId)?.name || users.find((u) => u.id === instructorId)?.full_name || 'Unknown';

    const handleAction = async (id, action) => {
        try {
            const timestamp = new Date().toISOString();
            await approveWithdrawal(id, {
                status: action === 'approve' ? 'approved' : 'rejected',
                processed_at: timestamp,
                processed_by: user.id,
            });
            toast({
              title: action === 'approve' ? 'Approved' : 'Rejected',
              description: action === 'approve' ? 'Funds marked as transferred.' : 'Request returned to balance.',
            });
        } catch (e) {
             notify.error(e, { context: 'FinancePage - withdrawalAction', fallback: MESSAGES.UNEXPECTED });
        }
    };

    return (
        <div className="space-y-6">
            {/* Pending Requests Table */}
            <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-yellow-500" />
                        Pending Requests
                    </CardTitle>
                    <CardDescription>Instructors waiting for payout. Approve to deduct from system balance.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow className="border-slate-800 hover:bg-transparent">
                                <TableHead>Instructor</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Details</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pendingRequests.length > 0 ? pendingRequests.map(req => (
                                <TableRow key={req.id} className="border-slate-800 hover:bg-slate-800/50">
                                    <TableCell className="font-medium text-white">{instructorName(req.instructor_id)}</TableCell>
                                    <TableCell className="text-slate-400">{formatDate(req.requested_at)}</TableCell>
                                    <TableCell>
                                        <div className="text-xs text-slate-300">{req.method || '—'}</div>
                                        <div className="text-[10px] text-slate-500">{req.payment_details || req.note || ''}</div>
                                    </TableCell>
                                    <TableCell className="font-bold text-green-400">{formatCurrency(req.amount)}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                className="text-red-400 hover:bg-red-900/20 border-red-900/50 hover:text-red-300" 
                                                onClick={() => handleAction(req.id, 'reject')}
                                            >
                                                <XCircle className="h-4 w-4 mr-1" /> Reject
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                className="bg-green-600 hover:bg-green-700 text-white border-none" 
                                                onClick={() => handleAction(req.id, 'approve')}
                                            >
                                                <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                        No pending withdrawal requests.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* History Table */}
            <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Lock className="h-5 w-5 text-slate-500" />
                        Transaction History
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow className="border-slate-800 hover:bg-transparent">
                                <TableHead>Instructor</TableHead>
                                <TableHead>Date Requested</TableHead>
                                <TableHead>Date Processed</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead className="text-right">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {historyRequests.length > 0 ? historyRequests.slice(0, 10).map(req => (
                                <TableRow key={req.id} className="border-slate-800 hover:bg-slate-800/50">
                                    <TableCell className="text-slate-300">{instructorName(req.instructor_id)}</TableCell>
                                    <TableCell className="text-slate-400">{formatDate(req.requested_at)}</TableCell>
                                    <TableCell className="text-slate-400">{req.processed_at ? formatDate(req.processed_at) : '-'}</TableCell>
                                    <TableCell className="font-medium text-white">{formatCurrency(req.amount)}</TableCell>
                                    <TableCell className="text-right">
                                        {req.status === 'approved' ? (
                                            <Badge className="bg-green-900/30 text-green-400 border-green-900">Approved</Badge>
                                        ) : (
                                            <Badge className="bg-red-900/30 text-red-400 border-red-900">Rejected</Badge>
                                        )}
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                        No history found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

// --- Main Page Component ---
const FinancePage = () => {
  const { students, enrollments, classes, payments, addPayment, sendPaymentReminder } = useData();
  const { user, institution } = useAuth();
  const isAdmin = user?.role === 'admin';
  const registrationFee = getRegistrationFeeAmount(institution);
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState('payment'); // 'payment' or 'charge'
  const [preSelectedStudent, setPreSelectedStudent] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const { toast } = useToast();

  const financials = useMemo(() => {
      return students.map(student => {
          const enrollment = enrollments.find(e => e.student_id === student.id && e.status === 'active');
          const activeClass = enrollment ? classes.find(c => c.id === enrollment.class_id) : null;
          const studentPayments = payments.filter(p => p.student_id === student.id);
          const bal = computeStudentBalance({
            payments: studentPayments,
            activeClass,
            enrollment,
            institution,
            registrationFeeAmount: registrationFee,
          });

          return {
              student,
              activeClass,
              activeEnrollment: enrollment,
              payments: studentPayments,
              registrationPaid: bal.registrationPaid,
              classFee: bal.classFee,
              originalFee: bal.originalFee,
              discountTotal: bal.discountTotal,
              monthlyDiscount: bal.monthlyDiscount,
              totalTuitionPaid: bal.totalTuitionPaid,
              totalPending: bal.totalPending,
              balance: bal.balance,
              totalPaid: bal.totalPaid,
          };
      }).filter(f => f.activeClass || f.payments.length > 0);
  }, [students, enrollments, classes, payments, registrationFee, institution]);

  const stats = useMemo(() => {
      const totalCollected = financials.reduce((sum: any, f: any) => sum + f.totalPaid, 0);
      const totalOutstanding = financials.reduce((sum: any, f: any) => sum + f.balance, 0);
      const totalPendingCharges = financials.reduce((sum: any, f: any) => sum + f.totalPending, 0);
      const overdueCount = financials.filter(f => f.balance > 0).length;
      const regCount = financials.filter(f => f.registrationPaid).length;
      // Sum actual recorded registration-fee payment amounts (not a hard-coded fee × count)
      const totalRegFees = financials.reduce((sum: any, f: any) => {
          if (!f.registrationPaid) return sum;
          const regPay = f.payments.find((p) => p.is_registration_fee === true);
          return sum + Number(regPay?.amount || 0);
      }, 0);
      
      return { totalCollected, totalOutstanding, overdueCount, regCount, totalRegFees, totalPendingCharges };
  }, [financials]);

  const handleRecordPayment = (studentId) => {
      setPreSelectedStudent(studentId);
      setEditingPayment(null);
      setPaymentMode('payment');
      setIsPayOpen(true);
  };

  const handleChargeBalance = (studentId) => {
      setPreSelectedStudent(studentId);
      setEditingPayment(null);
      setPaymentMode('charge');
      setIsPayOpen(true);
  };

  const handleEditPayment = (payment) => {
      setPreSelectedStudent(payment.student_id);
      setEditingPayment(payment);
      setPaymentMode('payment');
      setIsPayOpen(true);
  };

  const handleSendReminder = async (studentId, balance) => {
      if (balance <= 0) {
          toast({ variant: "default", title: "No Balance", description: "Student has no outstanding balance." });
          return;
      }
      try {
          await sendPaymentReminder(studentId, `You have an outstanding balance of ${formatCurrency(balance)}. Please pay soon.`);
          toast({ title: "Reminder Sent", description: "Notification sent to student portal." });
      } catch (e) {
          notify.error(e, { context: 'FinancePage - sendReminder', fallback: MESSAGES.UNEXPECTED });
      }
  };

  return (
    <AnimatedPage>
      <Helmet><title>Finance Management - Portal</title></Helmet>
      <PageHeader 
        title="Finance Dashboard" 
        subtitle="Manage student billing, payments, and withdrawals."
        action={
            <Button onClick={() => { setPreSelectedStudent(null); setEditingPayment(null); setPaymentMode('payment'); setIsPayOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700">
                <PlusCircle className="mr-2 h-4 w-4" /> Record Payment
            </Button>
        }
      />

      <Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
          <DialogContent>
              <DialogHeader><DialogTitle>{editingPayment ? "Edit Record" : (paymentMode === 'charge' ? "Charge Balance" : "Record Payment")}</DialogTitle></DialogHeader>
              <PaymentForm 
                  closeDialog={() => setIsPayOpen(false)} 
                  preSelectedStudentId={preSelectedStudent}
                  existingPayment={editingPayment}
                  financials={financials}
                  initialMode={paymentMode}
              />
          </DialogContent>
      </Dialog>

      <Tabs defaultValue="billing" className="mt-6">
          <TabsList className="bg-slate-900 border-slate-800">
              <TabsTrigger value="billing">Student Billing</TabsTrigger>
              {/* PRD: instructor settlements/withdrawals — Admin only (Staff —) */}
              {isAdmin && <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>}
          </TabsList>

          <TabsContent value="billing" className="space-y-6 mt-4">
              <FinanceStats stats={stats} />
              <StudentFinanceList 
                  students={financials.map(f => f.student)} 
                  financials={financials}
                  onRecordPayment={handleRecordPayment}
                  onChargeBalance={handleChargeBalance}
                  onEditPayment={handleEditPayment}
                  onSendReminder={handleSendReminder}
              />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="withdrawals" className="mt-4">
                <WithdrawalApprovalList />
            </TabsContent>
          )}
      </Tabs>
    </AnimatedPage>
  );
};

export default FinancePage;