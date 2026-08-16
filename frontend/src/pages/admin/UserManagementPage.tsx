import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { updateProfile, deleteUser, updateUser, createNewUser } from '@/lib/api';
import { Loader2, Search, RefreshCw, Trash2, Pencil, AlertCircle, UserPlus, Copy, CheckCircle2, Mail, Users } from 'lucide-react';
import { useUsers } from '@/hooks/useUsers';
import { Skeleton } from '@/components/ui/skeleton';
import { isValidEmail } from '@/lib/utils';
import { notify, MESSAGES } from '@/lib/notify';
import { useAuth } from '@/contexts/AuthContext';

const STAFF_AFFILIATE_ROLES = [
  { value: 'staff', label: 'Staff' },
  { value: 'affiliate', label: 'Affiliate' },
];

const CreateUserDialog = ({ isOpen, onClose, onCreated }) => {
  const { toast } = useToast();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: 'staff',
    password: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [created, setCreated] = useState(null);

  const reset = () => {
    setForm({
      full_name: '',
      email: '',
      phone: '',
      role: 'staff',
      password: '',
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

    setIsSaving(true);
    try {
      const result = await createNewUser({
        email: form.email.trim().toLowerCase(),
        password: form.password || undefined,
        skipWelcomeEmail: form.role === 'affiliate',
        user_metadata: {
          name: form.full_name.trim(),
          role: form.role,
          phone: form.phone.trim() || null,
        },
        phone: form.phone.trim() || null,
      });

      setCreated({
        name: form.full_name.trim(),
        email: result.user.email,
        password: result.password,
        role: result.role || form.role,
        emailed: result.emailed,
        email_error: result.email_error,
      });

      const roleSuccess = {
        staff: MESSAGES.SUCCESS.STAFF_CREATED,
        affiliate: MESSAGES.SUCCESS.AFFILIATE_CREATED,
      };
      const successMsg = roleSuccess[result.role || form.role] || MESSAGES.SUCCESS.USER_CREATED;
      notify.success(successMsg);
      if (!result.emailed && form.role !== 'affiliate') {
        toast({
          variant: 'destructive',
          title: 'Welcome email failed',
          description: MESSAGES.DOMAIN.EMAIL_SEND_FAILED,
        });
      }

      if (onCreated) onCreated();
    } catch (err) {
      notify.error(err, { context: 'UserManagementPage.create', title: 'Create failed' });
    } finally {
      setIsSaving(false);
    }
  };

  const copyAll = () => {
    if (!created) return;
    const text = `Welcome!\n\nLogin URL: ${window.location.origin}/login\nEmail: ${created.email}\nTemporary Password: ${created.password}\nRole: ${created.role}\n\nPlease sign in and change your password.`;
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
            <DialogTitle className="text-center">User Created Successfully</DialogTitle>
            <DialogDescription className="text-center">
              Share these credentials with the user.
              {created.role === 'affiliate'
                ? ' Affiliates do not receive a welcome email.'
                : ` A welcome email was ${created.emailed ? 'sent' : 'not sent'}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="bg-muted/40 p-4 rounded-lg border space-y-3 my-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Name</p>
              <p className="font-medium">{created.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Email</p>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium break-all">{created.email}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { navigator.clipboard.writeText(created.email); toast({ title: 'Copied email' }); }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Temporary Password</p>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-bold">{created.password}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { navigator.clipboard.writeText(created.password); toast({ title: 'Copied password' }); }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Role</p>
              <Badge className="capitalize">{created.role}</Badge>
            </div>
            {!created.emailed && created.role !== 'affiliate' && (
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
              <UserPlus className="h-5 w-5" /> Create Staff or Affiliate
            </DialogTitle>
            <DialogDescription>
              Create a staff or affiliate account. Credentials can be copied after creation.
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
              <Label>Role *</Label>
              <Select
                value={form.role}
                onValueChange={(role) => setForm({ ...form, role })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAFF_AFFILIATE_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSaving}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const EditUserDialog = ({ user, isOpen, onClose, onSave }) => {
    const isInstructor = user?.role === 'instructor';
    const [data, setData] = useState({
      name: user.name || '',
      email: '',
      password: '',
      settlement_model: user.settlement_model === 'fixed_fee' ? 'fixed_fee' : 'commission',
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
              fixed_fee_amount: String(user.fixed_fee_amount ?? 0),
            });
        }
    }, [isOpen, user]);

    const handleSave = async () => {
        const nameChanged = data.name.trim() && data.name.trim() !== (user.name || '');
        const emailChanged = Boolean(data.email.trim());
        const passwordChanged = Boolean(data.password);
        const settlementChanged =
          isInstructor &&
          (data.settlement_model !== (user.settlement_model === 'fixed_fee' ? 'fixed_fee' : 'commission') ||
            Number(data.fixed_fee_amount) !== Number(user.fixed_fee_amount ?? 0));

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
        if (
          isInstructor &&
          data.settlement_model === 'fixed_fee' &&
          Number(data.fixed_fee_amount) <= 0
        ) {
          return notify.validation('Enter a default fixed fee greater than 0.');
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
                        data.settlement_model === 'fixed_fee'
                          ? Number(data.fixed_fee_amount) || 0
                          : 0,
                    }
                  : {}),
            });
            notify.success(MESSAGES.SUCCESS.USER_UPDATED);
            await onSave();
            onClose();
        } catch (e) {
            notify.error(e, {
                context: 'UserManagementPage.editUser',
                fallback: MESSAGES.UPDATE_FAILED,
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit User: {user.username || user.name}</DialogTitle>
                    <DialogDescription>
                        Current email: {user.email || '—'}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Full Name</Label>
                        <Input value={data.name} onChange={e => setData({...data, name: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <Label>New Email (Optional)</Label>
                        <Input type="email" value={data.email} onChange={e => setData({...data, email: e.target.value})} placeholder="Leave blank to keep current" />
                    </div>
                    <div className="space-y-2">
                        <Label>New Password (Optional)</Label>
                        <Input type="text" value={data.password} onChange={e => setData({...data, password: e.target.value})} placeholder="Leave blank to keep current" />
                    </div>
                    {isInstructor && (
                      <>
                        <div className="space-y-2">
                          <Label>Settlement model</Label>
                          <Select
                            value={data.settlement_model}
                            onValueChange={(settlement_model) =>
                              setData({
                                ...data,
                                settlement_model,
                                fixed_fee_amount:
                                  settlement_model === 'commission' ? '0' : data.fixed_fee_amount,
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
                        {data.settlement_model === 'fixed_fee' && (
                          <div className="space-y-2">
                            <Label>Default fixed fee</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={data.fixed_fee_amount}
                              onChange={(e) =>
                                setData({ ...data, fixed_fee_amount: e.target.value })
                              }
                            />
                          </div>
                        )}
                      </>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const UserManagementPage = () => {
  const { users, loading, error, refresh } = useUsers();
  const { user: currentUser } = useAuth();
  const isTenantAdmin = currentUser?.role === 'admin';
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [editUser, setEditUser] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateProfile(userId, { role: newRole });
      notify.success(MESSAGES.SUCCESS.ROLE_UPDATED);
      refresh();
    } catch (error) {
      notify.error(error, {
        context: 'UserManagementPage.roleChange',
        fallback: MESSAGES.UPDATE_FAILED,
      });
    }
  };

  const handleStatusToggle = async (user) => {
    const next = user.status === 'suspended' ? 'approved' : 'suspended';
    try {
      await updateUser(user.id, { status: next });
      notify.success(MESSAGES.SUCCESS.USER_UPDATED);
      refresh();
    } catch (error) {
      notify.error(error, {
        context: 'UserManagementPage.statusToggle',
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
            context: 'UserManagementPage.delete',
            fallback: MESSAGES.DELETE_FAILED,
          });
      } finally {
          setIsDeleteOpen(false);
      }
  };

  const getDisplayEmail = (user) => {
      if (user.students && user.students.length > 0 && user.students[0].email) {
          return user.students[0].email;
      }
      return user.email || user.username || 'No email attached';
  };

  const getStudentCode = (user) => {
      if (user.students && user.students.length > 0 && user.students[0].student_code) {
          return user.students[0].student_code;
      }
      return user.username;
  };

  const filteredUsers = users.filter(user => {
      if (user.role !== 'staff' && user.role !== 'affiliate') return false;

      const searchLower = searchTerm.toLowerCase();
      const matchName = (user.name || '').toLowerCase().includes(searchLower);
      const matchUsername = (user.username || '').toLowerCase().includes(searchLower);
      const matchEmail = getDisplayEmail(user).toLowerCase().includes(searchLower);
      const matchCode = getStudentCode(user)?.toLowerCase().includes(searchLower) || false;
      return matchName || matchUsername || matchEmail || matchCode;
  });

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const pagedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getRoleBadgeVariant = (role) => {
    switch (role?.toLowerCase()) {
      case 'affiliate': return 'default';
      case 'staff': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <>
      <Helmet>
        <title>Staff & Affiliates - Admin Dashboard</title>
      </Helmet>
      <div className="space-y-6 p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Staff & Affiliates</h1>
            <p className="text-muted-foreground">
              Create and manage staff and affiliate accounts only.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isTenantAdmin && (
              <Button onClick={() => setIsCreateOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Create Staff / Affiliate
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
                    <p className="text-sm">{typeof error === 'string' ? error : MESSAGES.LOAD_FAILED.description}</p>
                </div>
            </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Staff & Affiliates
            </CardTitle>
            <CardDescription>
              Only Staff and Affiliate roles can be created here.
            </CardDescription>
            <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search by name, email, or ID..." 
                    value={searchTerm} 
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                    className="pl-8" 
                />
              </div>
              <div className="text-sm text-muted-foreground shrink-0">
                  Total: {filteredUsers.length}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User Details</TableHead>
                    <TableHead>Identifier / Email</TableHead>
                    <TableHead>System Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[150px]">Change Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                              <TableCell><Skeleton className="h-4 w-[150px] mb-2"/><Skeleton className="h-3 w-[100px]"/></TableCell>
                              <TableCell><Skeleton className="h-4 w-[120px]"/></TableCell>
                              <TableCell><Skeleton className="h-6 w-[80px] rounded-full"/></TableCell>
                              <TableCell><Skeleton className="h-8 w-[120px]"/></TableCell>
                              <TableCell className="text-right"><Skeleton className="h-8 w-8 inline-block rounded"/></TableCell>
                          </TableRow>
                      ))
                  ) : pagedUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                        No staff or affiliates yet. Create one to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagedUsers.map((user) => {
                        const isMissingData = !user.name || !user.role;
                        
                        return (
                          <TableRow key={user.id} className={isMissingData ? 'bg-orange-50/50' : ''}>
                            <TableCell>
                                <div className="font-medium flex items-center gap-2">
                                    {user.name || 'Unnamed User'}
                                    {isMissingData && <AlertCircle className="h-3 w-3 text-orange-500" aria-label="Missing Profile Data" />}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    Code: {getStudentCode(user)}
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="text-sm">{getDisplayEmail(user)}</div>
                            </TableCell>
                            <TableCell><Badge variant={getRoleBadgeVariant(user.role)} className="capitalize">{user.role || 'Unknown'}</Badge></TableCell>
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
                            <TableCell>
                              <Select value={user.role} onValueChange={(value) => handleRoleChange(user.id, value)}>
                                <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {STAFF_AFFILIATE_ROLES.map((r) => (
                                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleStatusToggle(user)}
                                      className="h-8 text-xs"
                                      title={user.status === 'suspended' ? 'Activate' : 'Deactivate'}
                                    >
                                      {user.status === 'suspended' ? 'Activate' : 'Deactivate'}
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => setEditUser(user)} className="h-8 w-8 text-blue-600 hover:bg-blue-100/50" title="Edit User">
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(user.id)} className="h-8 w-8 text-red-600 hover:bg-red-100/50" title="Delete Account">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </TableCell>
                          </TableRow>
                        );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            
            {!loading && totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
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
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                    >
                        Next
                    </Button>
                </div>
            )}
          </CardContent>
        </Card>

        <CreateUserDialog
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onCreated={refresh}
        />

        {editUser && (
            <EditUserDialog user={editUser} isOpen={!!editUser} onClose={() => setEditUser(null)} onSave={refresh} />
        )}

        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-red-600">Delete User Account?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action <b>cannot be undone</b>. This will permanently delete the user's authentication account, profile, and associated data.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 text-white hover:bg-red-700">
                        Permanently Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

      </div>
    </>
  );
};

export default UserManagementPage;
