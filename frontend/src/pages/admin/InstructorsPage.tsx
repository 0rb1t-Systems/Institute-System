import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { deleteUser, updateUser, createNewUser } from '@/lib/api';
import {
  Loader2,
  Search,
  RefreshCw,
  Trash2,
  Pencil,
  AlertCircle,
  UserPlus,
  Copy,
  CheckCircle2,
  Mail,
  GraduationCap,
} from 'lucide-react';
import { useUsers } from '@/hooks/useUsers';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, isValidEmail } from '@/lib/utils';
import { notify, MESSAGES } from '@/lib/notify';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';

const rateToPct = (rate) => {
  if (rate == null || rate === '') return '';
  const n = Number(rate);
  if (!Number.isFinite(n)) return '';
  return String(Math.round(n * 10000) / 100);
};

const pctToRate = (pct) => {
  if (pct == null || String(pct).trim() === '') return null;
  const n = Number(pct);
  if (!Number.isFinite(n)) return null;
  return Math.min(1, Math.max(0, n / 100));
};

const CreateInstructorDialog = ({ isOpen, onClose, onCreated }) => {
  const { toast } = useToast();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    settlement_model: 'commission',
    commission_mode: 'institution',
    unique_commission_pct: '',
    fixed_fee_amount: '0',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [created, setCreated] = useState(null);

  const reset = () => {
    setForm({
      full_name: '',
      email: '',
      phone: '',
      password: '',
      settlement_model: 'commission',
      commission_mode: 'institution',
      unique_commission_pct: '',
      fixed_fee_amount: '0',
    });
    setCreated(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      return notify.validation(MESSAGES.VALIDATION.FULL_NAME);
    }
    if (!isValidEmail(form.email)) {
      return notify.validation(MESSAGES.VALIDATION.EMAIL);
    }
    if (form.password && form.password.length < 8) {
      return notify.validation(MESSAGES.VALIDATION.PASSWORD_MIN);
    }
    if (form.settlement_model === 'fixed_fee' && Number(form.fixed_fee_amount) <= 0) {
      return notify.validation('Enter a default fixed fee greater than 0 for this instructor.');
    }
    if (
      form.settlement_model === 'commission' &&
      form.commission_mode === 'unique' &&
      (form.unique_commission_pct === '' || Number(form.unique_commission_pct) < 0 || Number(form.unique_commission_pct) > 100)
    ) {
      return notify.validation('Enter a unique commission between 0 and 100%.');
    }

    const uniqueRate =
      form.settlement_model === 'commission' && form.commission_mode === 'unique'
        ? pctToRate(form.unique_commission_pct)
        : null;

    setIsSaving(true);
    try {
      const result = await createNewUser({
        email: form.email.trim().toLowerCase(),
        password: form.password || undefined,
        user_metadata: {
          name: form.full_name.trim(),
          role: 'instructor',
          phone: form.phone.trim() || null,
          settlement_model: form.settlement_model,
          fixed_fee_amount: Number(form.fixed_fee_amount) || 0,
          instructor_commission_rate: uniqueRate,
        },
        phone: form.phone.trim() || null,
        settlement_model: form.settlement_model,
        fixed_fee_amount: Number(form.fixed_fee_amount) || 0,
        instructor_commission_rate: uniqueRate,
      });

      setCreated({
        name: form.full_name.trim(),
        email: result.user.email,
        password: result.password,
        role: 'instructor',
        emailed: result.emailed,
        email_error: result.email_error,
      });

      notify.success(MESSAGES.SUCCESS.INSTRUCTOR_CREATED);
      if (!result.emailed) {
        toast({
          variant: 'destructive',
          title: 'Welcome email failed',
          description: MESSAGES.DOMAIN.EMAIL_SEND_FAILED,
        });
      }

      if (onCreated) onCreated();
    } catch (err) {
      notify.error(err, { context: 'InstructorsPage.create', title: 'Create failed' });
    } finally {
      setIsSaving(false);
    }
  };

  const copyAll = () => {
    if (!created) return;
    const text = `Welcome!\n\nLogin URL: ${window.location.origin}/login\nEmail: ${created.email}\nTemporary Password: ${created.password}\nRole: instructor\n\nPlease sign in and change your password.`;
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: 'Credentials copied to clipboard.' });
  };

  if (created) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent>
          <DialogHeader>
            <div className="mx-auto w-14 h-14 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-2 border border-green-100">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <DialogTitle className="text-center">Instructor Created Successfully</DialogTitle>
            <DialogDescription className="text-center">
              Share these credentials with the instructor. A welcome email was{' '}
              {created.emailed ? 'sent' : 'not sent'}.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-muted/40 p-4 rounded-lg border space-y-3 my-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                Name
              </p>
              <p className="font-medium">{created.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                Email
              </p>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium break-all">{created.email}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    navigator.clipboard.writeText(created.email);
                    toast({ title: 'Copied email' });
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                Temporary Password
              </p>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-bold">{created.password}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    navigator.clipboard.writeText(created.password);
                    toast({ title: 'Copied password' });
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {!created.emailed && (
              <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
                <Mail className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{MESSAGES.DOMAIN.EMAIL_SEND_FAILED}</span>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button onClick={copyAll} className="w-full">
              <Copy className="w-4 h-4 mr-2" /> Copy All Details
            </Button>
            <Button variant="ghost" onClick={handleClose} className="w-full">
              Close & Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <form onSubmit={handleCreate}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" /> Create Instructor
            </DialogTitle>
            <DialogDescription>
              Create an instructor account. Login credentials are emailed automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Phone (Optional)</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Settlement model</Label>
              <Select
                value={form.settlement_model}
                onValueChange={(settlement_model) =>
                  setForm({
                    ...form,
                    settlement_model,
                    commission_mode:
                      settlement_model === 'commission' ? form.commission_mode : 'institution',
                    unique_commission_pct:
                      settlement_model === 'fixed_fee' ? '' : form.unique_commission_pct,
                    fixed_fee_amount:
                      settlement_model === 'commission' ? '0' : form.fixed_fee_amount,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="commission">Commission (% of payments)</SelectItem>
                  <SelectItem value="fixed_fee">Fixed fee (per class)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Commission uses a % of each tuition payment. Fixed fee is one amount per class, not a %.
              </p>
            </div>
            {form.settlement_model === 'commission' && (
              <div className="space-y-2">
                <Label>Commission rate</Label>
                <Select
                  value={form.commission_mode}
                  onValueChange={(commission_mode) => setForm({ ...form, commission_mode })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="institution">Institution default (from Settings)</SelectItem>
                    <SelectItem value="unique">Unique commission for this instructor</SelectItem>
                  </SelectContent>
                </Select>
                {form.commission_mode === 'unique' && (
                  <div className="space-y-1">
                    <Label>Unique commission (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={form.unique_commission_pct}
                      onChange={(e) => setForm({ ...form, unique_commission_pct: e.target.value })}
                      placeholder="e.g. 25"
                    />
                    <p className="text-xs text-muted-foreground">
                      This instructor keeps this % even if Institution Settings change.
                    </p>
                  </div>
                )}
              </div>
            )}
            {form.settlement_model === 'fixed_fee' && (
              <div className="space-y-2">
                <Label>Default fixed fee</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.fixed_fee_amount}
                  onChange={(e) => setForm({ ...form, fixed_fee_amount: e.target.value })}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Temporary Password (Optional)</Label>
              <Input
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Auto-generated if left blank"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Instructor
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const EditInstructorDialog = ({ user, isOpen, onClose, onSave }) => {
  const [data, setData] = useState({
    name: user.name || '',
    email: '',
    password: '',
    settlement_model: user.settlement_model === 'fixed_fee' ? 'fixed_fee' : 'commission',
    commission_mode: user.instructor_commission_rate != null ? 'unique' : 'institution',
    unique_commission_pct: rateToPct(user.instructor_commission_rate),
    fixed_fee_amount: String(user.fixed_fee_amount ?? 0),
  });
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    if (isOpen && user) {
      setData({
        name: user.name || '',
        email: '',
        password: '',
        settlement_model: user.settlement_model === 'fixed_fee' ? 'fixed_fee' : 'commission',
        commission_mode: user.instructor_commission_rate != null ? 'unique' : 'institution',
        unique_commission_pct: rateToPct(user.instructor_commission_rate),
        fixed_fee_amount: String(user.fixed_fee_amount ?? 0),
      });
    }
  }, [isOpen, user]);

  const handleSave = async () => {
    const nameChanged = data.name.trim() && data.name.trim() !== (user.name || '');
    const emailChanged = Boolean(data.email.trim());
    const passwordChanged = Boolean(data.password);
    const uniqueRate =
      data.settlement_model === 'commission' && data.commission_mode === 'unique'
        ? pctToRate(data.unique_commission_pct)
        : null;
    const settlementChanged =
      data.settlement_model !== (user.settlement_model === 'fixed_fee' ? 'fixed_fee' : 'commission') ||
      Number(data.fixed_fee_amount) !== Number(user.fixed_fee_amount ?? 0) ||
      uniqueRate !== (user.instructor_commission_rate == null ? null : Number(user.instructor_commission_rate));

    if (!nameChanged && !emailChanged && !passwordChanged && !settlementChanged) {
      onClose();
      return;
    }
    if (emailChanged && !isValidEmail(data.email.trim())) {
      return notify.validation(MESSAGES.VALIDATION.EMAIL);
    }
    if (passwordChanged && data.password.length < 6) {
      return notify.validation(MESSAGES.VALIDATION.PASSWORD_MIN);
    }
    if (data.settlement_model === 'fixed_fee' && Number(data.fixed_fee_amount) <= 0) {
      return notify.validation('Enter a default fixed fee greater than 0.');
    }
    if (
      data.settlement_model === 'commission' &&
      data.commission_mode === 'unique' &&
      (data.unique_commission_pct === '' || Number(data.unique_commission_pct) < 0 || Number(data.unique_commission_pct) > 100)
    ) {
      return notify.validation('Enter a unique commission between 0 and 100%.');
    }

    setIsSaving(true);
    try {
      await updateUser(user.id, {
        name: nameChanged ? data.name.trim() : undefined,
        email: emailChanged ? data.email.trim() : undefined,
        password: passwordChanged ? data.password : undefined,
        ...(settlementChanged
          ? {
              settlement_model: data.settlement_model,
              fixed_fee_amount:
                data.settlement_model === 'fixed_fee' ? Number(data.fixed_fee_amount) || 0 : 0,
              instructor_commission_rate: uniqueRate,
            }
          : {}),
      });
      notify.success(MESSAGES.SUCCESS.USER_UPDATED);
      await onSave();
      onClose();
    } catch (e) {
      notify.error(e, {
        context: 'InstructorsPage.edit',
        fallback: MESSAGES.UPDATE_FAILED,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Instructor: {user.name || user.email}</DialogTitle>
          <DialogDescription>Current email: {user.email || '—'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>New Email (Optional)</Label>
            <Input
              type="email"
              value={data.email}
              onChange={(e) => setData({ ...data, email: e.target.value })}
              placeholder="Leave blank to keep current"
            />
          </div>
          <div className="space-y-2">
            <Label>New Password (Optional)</Label>
            <Input
              type="text"
              value={data.password}
              onChange={(e) => setData({ ...data, password: e.target.value })}
              placeholder="Leave blank to keep current"
            />
          </div>
          <div className="space-y-2">
            <Label>Settlement model</Label>
            <Select
              value={data.settlement_model}
              onValueChange={(settlement_model) =>
                setData({
                  ...data,
                  settlement_model,
                  commission_mode:
                    settlement_model === 'commission' ? data.commission_mode : 'institution',
                  unique_commission_pct:
                    settlement_model === 'fixed_fee' ? '' : data.unique_commission_pct,
                  fixed_fee_amount: settlement_model === 'commission' ? '0' : data.fixed_fee_amount,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="commission">Commission (% of payments)</SelectItem>
                <SelectItem value="fixed_fee">Fixed fee (per class)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {data.settlement_model === 'commission' && (
            <div className="space-y-2">
              <Label>Commission rate</Label>
              <Select
                value={data.commission_mode}
                onValueChange={(commission_mode) => setData({ ...data, commission_mode })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="institution">Institution default (from Settings)</SelectItem>
                  <SelectItem value="unique">Unique commission for this instructor</SelectItem>
                </SelectContent>
              </Select>
              {data.commission_mode === 'unique' && (
                <div className="space-y-1">
                  <Label>Unique commission (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={data.unique_commission_pct}
                    onChange={(e) => setData({ ...data, unique_commission_pct: e.target.value })}
                    placeholder="e.g. 25"
                  />
                  <p className="text-xs text-muted-foreground">
                    Saving applies this % to this instructor&apos;s commission classes. Institution Settings will not override it.
                  </p>
                </div>
              )}
            </div>
          )}
          {data.settlement_model === 'fixed_fee' && (
            <div className="space-y-2">
              <Label>Default fixed fee</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={data.fixed_fee_amount}
                onChange={(e) => setData({ ...data, fixed_fee_amount: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Saving also updates this instructor&apos;s assigned classes and their fixed-fee earnings.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const InstructorsPage = () => {
  const { users, loading, error, refresh } = useUsers();
  const { refreshData } = useData();
  const { user: currentUser } = useAuth();
  const isTenantAdmin = currentUser?.role === 'admin';
  /** Only tenant admin may create instructors; staff can view the list only. */
  const canCreateInstructor = isTenantAdmin;
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [editUser, setEditUser] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleStatusToggle = async (user) => {
    const next = user.status === 'suspended' ? 'approved' : 'suspended';
    try {
      await updateUser(user.id, { status: next });
      notify.success(MESSAGES.SUCCESS.USER_UPDATED);
      refresh();
    } catch (err) {
      notify.error(err, {
        context: 'InstructorsPage.statusToggle',
        fallback: MESSAGES.UPDATE_FAILED,
      });
    }
  };

  const handleDeleteClick = (id) => {
    setDeleteId(id);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteUser(deleteId);
      notify.success(MESSAGES.SUCCESS.USER_DELETED);
      refresh();
    } catch (e) {
      notify.error(e, {
        context: 'InstructorsPage.delete',
        fallback: MESSAGES.DELETE_FAILED,
      });
    } finally {
      setIsDeleteOpen(false);
    }
  };

  const instructors = users.filter((u) => u.role === 'instructor');

  const filtered = instructors.filter((user) => {
    const searchLower = searchTerm.toLowerCase();
    const matchName = (user.name || '').toLowerCase().includes(searchLower);
    const matchEmail = (user.email || '').toLowerCase().includes(searchLower);
    const matchPhone = (user.phone || '').toLowerCase().includes(searchLower);
    return matchName || matchEmail || matchPhone;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paged = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const settlementLabel = (user) => {
    if (user.settlement_model === 'fixed_fee') {
      return `Fixed fee · ${formatCurrency(user.fixed_fee_amount ?? 0)}`;
    }
    if (user.instructor_commission_rate != null) {
      return `Unique commission · ${rateToPct(user.instructor_commission_rate)}%`;
    }
    return 'Commission (institution default)';
  };

  return (
    <>
      <Helmet>
        <title>Instructors - Admin Dashboard</title>
      </Helmet>
      <div className="space-y-6 p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Instructors</h1>
            <p className="text-muted-foreground">
              {isTenantAdmin
                ? 'Create and manage instructor accounts for your institution.'
                : 'View instructor accounts for your institution.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canCreateInstructor && (
              <Button onClick={() => setIsCreateOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Create Instructor
              </Button>
            )}
            <Button variant="outline" onClick={refresh} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Sync Data
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-center gap-3">
            <AlertCircle className="h-5 w-5" />
            <div>
              <p className="font-medium">{MESSAGES.LOAD_FAILED.title}</p>
              <p className="text-sm">
                {typeof error === 'string' ? error : MESSAGES.LOAD_FAILED.description}
              </p>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" /> Instructor Directory
            </CardTitle>
            <CardDescription>
              Instructors are managed here — not under Users.
            </CardDescription>
            <div className="pt-4 flex items-center justify-between">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-8"
                />
              </div>
              <div className="text-sm text-muted-foreground">Total: {filtered.length}</div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Instructor</TableHead>
                    <TableHead>Email / Phone</TableHead>
                    <TableHead>Settlement</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton className="h-4 w-[150px] mb-2" />
                          <Skeleton className="h-3 w-[100px]" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-[120px]" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-[100px]" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-[80px] rounded-full" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Skeleton className="h-8 w-8 inline-block rounded" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : paged.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                        No instructors found. Create your first instructor to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paged.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="font-medium">{user.name || 'Unnamed Instructor'}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{user.email || '—'}</div>
                          {user.phone && (
                            <div className="text-xs text-muted-foreground mt-1">{user.phone}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{settlementLabel(user)}</span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              user.status === 'suspended'
                                ? 'border-amber-600 text-amber-600'
                                : user.status === 'pending'
                                  ? 'border-slate-500 text-slate-500'
                                  : 'border-emerald-600 text-emerald-600'
                            }
                          >
                            {user.status || 'approved'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end items-center gap-1">
                            {isTenantAdmin && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleStatusToggle(user)}
                                  className="h-8 text-xs"
                                  title={
                                    user.status === 'suspended' ? 'Activate' : 'Deactivate'
                                  }
                                >
                                  {user.status === 'suspended' ? 'Activate' : 'Deactivate'}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setEditUser(user)}
                                  className="h-8 w-8 text-blue-600 hover:bg-blue-100/50"
                                  title="Edit Instructor"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteClick(user.id)}
                                  className="h-8 w-8 text-red-600 hover:bg-red-100/50"
                                  title="Delete Account"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {!loading && totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <CreateInstructorDialog
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onCreated={refresh}
        />

        {editUser && (
          <EditInstructorDialog
            user={editUser}
            isOpen={!!editUser}
            onClose={() => setEditUser(null)}
            onSave={async () => {
              await refresh();
              await refreshData();
            }}
          />
        )}

        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-red-600">Delete Instructor?</AlertDialogTitle>
              <AlertDialogDescription>
                This action <b>cannot be undone</b>. This will permanently delete the instructor
                account and related data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                Permanently Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
};

export default InstructorsPage;
