import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from '@/components/ui/use-toast';
import { notify, MESSAGES } from '@/lib/notify';
import { Loader2, Upload, User, Save, Lock, X } from 'lucide-react';
import { updateStudentAndProfile, uploadAvatar, removeAvatar, updateUser, verifyStudentCredentials } from '@/lib/api';
import { cn } from '@/lib/utils';

const ACCEPTED = 'image/png,image/jpeg,image/jpg,image/webp,image/gif';

const StudentProfileSettings = ({ student, onUpdate }) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    bio: '',
    avatar_url: ''
  });
  
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [dragging, setDragging] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (student) {
      setFormData({
        name: student.name || '',
        email: student.email || '',
        phone: student.phone || '',
        address: student.address || '',
        bio: student.bio || '',
        avatar_url: student.avatar_url || ''
      });
      setPreviewUrl(student.avatar_url || null);
      setFile(null);
    }
  }, [student]);

  const profileId = student?.profile_id || student?.id;

  const pickFile = (selectedFile) => {
    if (!selectedFile) return;
    if (selectedFile.size > 2 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Please choose an image smaller than 2MB.' });
      return;
    }
    const ok = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'].includes(selectedFile.type);
    if (!ok) {
      toast({ variant: 'destructive', title: 'Invalid file type', description: 'Please upload a PNG, JPG, WEBP, or GIF.' });
      return;
    }
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
  };

  const handleRemovePhoto = async () => {
    setFile(null);
    setPreviewUrl(null);
    if (!formData.avatar_url || !profileId) return;
    setIsLoading(true);
    try {
      await removeAvatar(profileId);
      setFormData((prev) => ({ ...prev, avatar_url: '' }));
      if (onUpdate) await onUpdate();
      toast({ title: 'Success', description: 'Profile picture removed.' });
    } catch (error) {
      notify.error(error, { context: 'StudentProfileSettings.removeAvatar', fallback: MESSAGES.UPDATE_FAILED });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!student || !profileId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Student profile not found.' });
      return;
    }

    setIsLoading(true);

    try {
      let finalAvatarUrl = formData.avatar_url;
      if (file) {
        finalAvatarUrl = await uploadAvatar(file, profileId);
      }

      if (newPassword) {
        if (!currentPassword) throw new Error('VALIDATION');
        if (newPassword.length < 8) {
          notify.validation(MESSAGES.VALIDATION.PASSWORD_MIN);
          setIsLoading(false);
          return;
        }

        const verify = await verifyStudentCredentials(student.email, currentPassword);
        if (!verify.success) throw new Error('AUTH.INVALID_CREDENTIALS');

        await updateUser(profileId, { password: newPassword });
        toast({ title: 'Security Updated', description: 'Password changed successfully.' });
        setCurrentPassword('');
        setNewPassword('');
      }

      const updates = { ...formData, avatar_url: finalAvatarUrl || null };
      await updateStudentAndProfile(student.id, profileId, updates);
      
      if (onUpdate) await onUpdate();

      toast({
        title: 'Success',
        description: MESSAGES.SUCCESS.PROFILE_UPDATED,
      });
      
      setFile(null);
      setFormData((prev) => ({ ...prev, avatar_url: finalAvatarUrl || '' }));
      setPreviewUrl(finalAvatarUrl || null);
    } catch (error) {
      notify.error(error, { context: 'StudentProfileSettings', fallback: MESSAGES.UPDATE_FAILED });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>Update your photo, personal details, and password.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-white">Profile Picture</h4>
            <div className="flex flex-col sm:flex-row items-start gap-5">
              <div className="relative shrink-0">
                <div className="h-28 w-28 rounded-full overflow-hidden bg-slate-800 border-2 border-slate-700">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-slate-500">
                      <User className="h-12 w-12" />
                    </div>
                  )}
                </div>
                {previewUrl && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    disabled={isLoading}
                    className="absolute -top-1 -right-1 h-7 w-7 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg hover:bg-red-500"
                    title="Remove photo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  pickFile(e.dataTransfer.files?.[0]);
                }}
                className={cn(
                  'flex-1 w-full min-h-[112px] rounded-xl border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-colors',
                  dragging
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-slate-700 bg-slate-950/50 hover:border-slate-500',
                )}
              >
                <Upload className="h-5 w-5 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-300">Click or drag image here to upload</p>
                <p className="text-xs text-slate-500 mt-1">JPG, PNG, GIF, WEBP — max 2MB</p>
                {file && <p className="text-xs text-emerald-400 mt-2">Selected: {file.name}</p>}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED}
                  className="hidden"
                  onChange={(e) => {
                    pickFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-300">Full Name</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">Email Address</Label>
              <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-slate-300">Phone Number</Label>
              <Input id="phone" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address" className="text-slate-300">Address</Label>
              <Input id="address" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} className="bg-slate-800 border-slate-700 text-white" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio" className="text-slate-300">Bio</Label>
            <Textarea id="bio" value={formData.bio} onChange={(e) => setFormData({...formData, bio: e.target.value})} className="bg-slate-800 border-slate-700 text-white min-h-[100px]" placeholder="Tell us a little about yourself..." />
          </div>

          <div className="space-y-4 border-t border-slate-800 pt-4 mt-4">
            <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Lock className="h-4 w-4" /> Change Password
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="current-password" className="text-slate-300">Current Password</Label>
                <Input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="bg-slate-800 border-slate-700 text-white" placeholder="Required if changing password" autoComplete="current-password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-slate-300">New Password</Label>
                <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="bg-slate-800 border-slate-700 text-white" placeholder="Min. 8 characters" autoComplete="new-password" />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t border-slate-800 pt-6">
          <Button type="submit" disabled={isLoading} className="ml-auto bg-primary text-primary-foreground hover:bg-primary/90">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default StudentProfileSettings;
