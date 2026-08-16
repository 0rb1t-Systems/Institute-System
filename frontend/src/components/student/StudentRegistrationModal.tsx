import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { isValidEmail } from '@/lib/utils';
import { Loader2, Copy, CheckCircle2, UserPlus, Mail, AlertCircle, LogIn } from 'lucide-react';
import { normalizePhoneNumber, isValidPhoneFormat } from '@/lib/validatePhoneNumber';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { registerManualStudent, findStudentByPhone } from '@/lib/api';
import { notify, MESSAGES } from '@/lib/notify';

const StudentRegistrationModal = ({ isOpen, onClose, onSuccess, classes, users }) => {
    const { toast } = useToast();
    const navigate = useNavigate();
    
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        university: '',
        faculty: '',
        year: '',
        affiliate_id: 'none',
        class_id: 'none'
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successData, setSuccessData] = useState(null);
    const [phoneError, setPhoneError] = useState('');

    const affiliates = useMemo(
      () =>
        (users || []).filter(
          (u) =>
            u.role === 'affiliate' &&
            (u.status === 'approved' || u.status === 'active' || !u.status),
        ),
      [users],
    );
    const activeClasses = useMemo(() => classes?.filter(c => c.is_active) || [], [classes]);

    const resetForm = () => {
        setFormData({
            name: '', email: '', phone: '', university: '',
            faculty: '', year: '', affiliate_id: 'none', class_id: 'none'
        });
        setSuccessData(null);
        setPhoneError('');
    };

    const handleChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
        
        if (id === 'phone') {
            setPhoneError('');
        }
    };

    const checkPhoneExists = async (phone) => {
        if (!phone) return false;
        try {
            const data = await findStudentByPhone(phone);
            return !!data;
        } catch (err) {
            console.error("Error checking phone existence:", err);
            return false;
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setPhoneError('');
        
        if (!formData.name?.trim()) {
            return notify.validation(MESSAGES.VALIDATION.FULL_NAME);
        }

        if (!isValidEmail(formData.email)) {
            return notify.validation(MESSAGES.VALIDATION.EMAIL);
        }

        const normalizedPhone = normalizePhoneNumber(formData.phone);
        
        if (formData.phone && !isValidPhoneFormat(normalizedPhone)) {
            setPhoneError(MESSAGES.VALIDATION.PHONE);
            return;
        }

        setIsSubmitting(true);

        if (normalizedPhone) {
            const exists = await checkPhoneExists(normalizedPhone);
            if (exists) {
                setPhoneError(MESSAGES.DUPLICATE.PHONE.description);
                setIsSubmitting(false);
                return;
            }
        }

        try {
            const data = await registerManualStudent({
                ...formData,
                phone: normalizedPhone
            });

            setSuccessData(data);
            if (onSuccess) onSuccess(); // Trigger refresh in parent

            if (data.emailed) {
              notify.success(MESSAGES.SUCCESS.STUDENT_CREATED);
            } else {
              notify.success(MESSAGES.SUCCESS.STUDENT_CREATED);
              toast({
                variant: 'destructive',
                title: 'Welcome email failed',
                description: MESSAGES.DOMAIN.EMAIL_SEND_FAILED,
              });
            }

        } catch (error) {
            const mapped = notify.error(error, { context: 'StudentRegistrationModal' });
            if (mapped.description === MESSAGES.DUPLICATE.PHONE.description) {
                setPhoneError(MESSAGES.DUPLICATE.PHONE.description);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const copyCredentials = () => {
        if (!successData) return;
        const text = `Welcome to ${successData.institution_name || 'your institution'}!\n\nLogin URL: ${window.location.origin}/login\nStudent ID / Username: ${successData.student_code}\nEmail: ${successData.email}\nTemporary Password: ${successData.password}\n\nPlease log in and securely store these credentials.`;
        navigator.clipboard.writeText(text);
        toast({ title: "Copied!", description: "Credentials copied to clipboard." });
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    if (successData) {
        return (
            <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
                <DialogContent className="sm:max-w-[450px] bg-slate-900 border-slate-800 text-slate-100">
                    <DialogHeader>
                        <div className="mx-auto w-16 h-16 bg-green-500/10 border border-green-500/20 text-green-400 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-green-900/20">
                            <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <DialogTitle className="text-center text-xl font-bold text-white">Student Registered Successfully!</DialogTitle>
                        <DialogDescription className="text-center text-slate-400 mt-2">
                            Share these credentials with the student for login.
                            {successData.emailed
                              ? ' A welcome email with these details was also sent.'
                              : ' Email delivery failed — please share these details manually.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 my-4 space-y-4">
                        <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Student ID (Username)</p>
                            <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                                <span className="font-mono font-bold text-indigo-400 text-lg">{successData.student_code}</span>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-white" onClick={() => { navigator.clipboard.writeText(successData.student_code); toast({title:"Copied Student ID"}); }}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Email</p>
                            <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                                <span className="font-medium text-slate-200">{successData.email}</span>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-white" onClick={() => { navigator.clipboard.writeText(successData.email); toast({title:"Copied Email"}); }}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Temporary Password</p>
                            <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                                <span className="font-mono font-bold text-yellow-400 text-lg">{successData.password}</span>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-white" onClick={() => { navigator.clipboard.writeText(successData.password); toast({title:"Copied Password"}); }}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="flex-col sm:flex-col gap-3">
                        <Button onClick={copyCredentials} className="w-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 h-11">
                            <Copy className="w-4 h-4 mr-2" /> Copy All Details
                        </Button>
                        <Button variant="ghost" onClick={handleClose} className="w-full text-slate-400 hover:text-white">
                            Close & Continue
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-800 text-slate-100">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UserPlus className="w-5 h-5 text-indigo-400" /> Register New Student
                        </DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Fill in the details below. A user account will be automatically generated. The Student Code will be used as their temporary password.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-1 pr-2">
                        <div className="space-y-1">
                            <Label htmlFor="name" className="text-slate-300">Full Name *</Label>
                            <Input id="name" value={formData.name} onChange={handleChange} className="bg-slate-950 border-slate-800 text-white" required />
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label htmlFor="email" className="text-slate-300">Email Address *</Label>
                                <Input id="email" type="email" value={formData.email} onChange={handleChange} className="bg-slate-950 border-slate-800 text-white" required />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="phone" className="text-slate-300">Phone Number (Optional)</Label>
                                <Input 
                                    id="phone" 
                                    value={formData.phone} 
                                    onChange={handleChange} 
                                    className={cn("bg-slate-950 border-slate-800 text-white", phoneError && "border-red-500 focus-visible:ring-red-500")} 
                                />
                                {phoneError && (
                                    <div className="flex items-center gap-1 mt-1 text-xs text-red-400">
                                        <AlertCircle className="h-3 w-3" />
                                        <span>{phoneError}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="university" className="text-slate-300">University</Label>
                            <Input id="university" value={formData.university} onChange={handleChange} className="bg-slate-950 border-slate-800 text-white" />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label htmlFor="faculty" className="text-slate-300">Faculty</Label>
                                <Input id="faculty" value={formData.faculty} onChange={handleChange} className="bg-slate-950 border-slate-800 text-white" />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="year" className="text-slate-300">Year of Study</Label>
                                <Input id="year" value={formData.year} onChange={handleChange} className="bg-slate-950 border-slate-800 text-white" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-slate-300">Assign Affiliate</Label>
                                <Select value={formData.affiliate_id} onValueChange={(v) => setFormData(p => ({...p, affiliate_id: v}))}>
                                    <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
                                        <SelectValue placeholder="Select Affiliate" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                        <SelectItem value="none">None</SelectItem>
                                        {affiliates.length === 0 ? (
                                          <div className="px-2 py-1.5 text-xs text-slate-500">
                                            No affiliates yet. Create them in Users.
                                          </div>
                                        ) : (
                                          affiliates.map((aff) => (
                                            <SelectItem key={aff.id} value={aff.id}>
                                              {aff.name || aff.full_name || aff.email}
                                            </SelectItem>
                                          ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-slate-300">Initial Class Enrollment</Label>
                                <Select value={formData.class_id} onValueChange={(v) => setFormData(p => ({...p, class_id: v}))}>
                                    <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
                                        <SelectValue placeholder="Select Class" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                        <SelectItem value="none">Register Only (No Class)</SelectItem>
                                        {activeClasses.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="mt-4 pt-4 border-t border-slate-800">
                        <Button type="button" variant="ghost" onClick={handleClose} className="text-slate-400 hover:text-white" disabled={isSubmitting}>Cancel</Button>
                        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white" disabled={isSubmitting || !!phoneError}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Register Student
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default StudentRegistrationModal;