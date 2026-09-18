import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from '@/components/ui/use-toast';
import { notify, MESSAGES } from '@/lib/notify';
import { Loader2, Save, AlertTriangle, Upload, User, Lock, X } from 'lucide-react';
import { updateProfile, uploadAvatar, removeAvatar, updateUser, verifyStudentCredentials } from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const ACCEPTED = 'image/png,image/jpeg,image/jpg,image/webp,image/gif';

const UserProfileSettings = ({ user, onUpdate }) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setUsername(user.username || '');
      setEmail(user.email || '');
      setAvatarUrl(user.avatar_url || '');
      setAvatarPreview(null);
      setAvatarFile(null);
    }
  }, [user]);

  const pickFile = (file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Please choose an image smaller than 2MB.' });
      return;
    }
    const ok = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'].includes(file.type);
    if (!ok) {
      toast({ variant: 'destructive', title: 'Invalid file type', description: 'Please upload a PNG, JPG, WEBP, or GIF.' });
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleFileChange = (e) => {
    pickFile(e.target.files?.[0]);
    e.target.value = '';
  };

  const handleRemovePhoto = async () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    if (!avatarUrl) return;
    setIsLoading(true);
    try {
      await removeAvatar(user.id);
      setAvatarUrl('');
      if (onUpdate) await onUpdate();
      toast({ title: 'Success', description: 'Profile picture removed.' });
    } catch (error) {
      notify.error(error, { context: 'UserProfileSettings.removeAvatar', fallback: MESSAGES.UPDATE_FAILED });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let newAvatarUrl = avatarUrl;

      if (avatarFile) {
        newAvatarUrl = await uploadAvatar(avatarFile, user.id);
        setAvatarUrl(newAvatarUrl);
      }

      await updateProfile(user.id, {
        name,
        avatar_url: newAvatarUrl || null,
      });

      if (email !== user.email) {
        await updateProfile(user.id, { email });
        toast({
          title: 'Email Updated',
          description: 'Your email has been updated successfully.',
        });
      }

      if (newPassword) {
        if (!currentPassword) {
          throw new Error('Current password is required to set a new password.');
        }
        if (newPassword.length < 8) {
          throw new Error(MESSAGES.VALIDATION.PASSWORD_MIN);
        }

        const verify = await verifyStudentCredentials(user.email, currentPassword);
        if (!verify.success) {
          throw new Error('Incorrect current password.');
        }

        await updateUser(user.id, { password: newPassword });
        toast({
          title: 'Password Updated',
          description: 'Your password has been changed successfully.',
        });
        setCurrentPassword('');
        setNewPassword('');
      }

      if (onUpdate) await onUpdate();

      toast({
        title: 'Success',
        description: MESSAGES.SUCCESS.PROFILE_UPDATED,
      });
      
      setAvatarFile(null);
      setAvatarPreview(null);
    } catch (error) {
      notify.error(error, { context: 'UserProfileSettings', fallback: MESSAGES.UPDATE_FAILED });
    } finally {
      setIsLoading(false);
    }
  };

  const displaySrc = avatarPreview || avatarUrl;

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Your account</CardTitle>
        <CardDescription>Photo, name, and password.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <h3 className="font-medium text-[var(--ds-text-primary,#122018)]">Profile Picture</h3>
            <div className="flex flex-col items-start gap-5 sm:flex-row">
              <div className="relative shrink-0">
                <Avatar className="h-28 w-28 border-4 border-[var(--ds-border,#DDE5DF)] shadow-sm">
                  <AvatarImage src={displaySrc} className="object-cover" />
                  <AvatarFallback className="bg-[var(--ds-primary-soft,#ECFDF5)] text-2xl text-[var(--ds-primary,#1F8A5B)]">
                    {name?.charAt(0) || <User />}
                  </AvatarFallback>
                </Avatar>
                {displaySrc && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    disabled={isLoading}
                    className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--ds-danger,#DC2626)] text-[var(--ds-text-on-primary,#fff)] shadow-lg hover:bg-[var(--ds-danger-hover,#B91C1C)]"
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
                  'min-h-[112px] w-full flex-1 cursor-pointer rounded-[var(--ds-radius-lg,12px)] border-2 border-dashed px-4 py-6 text-center transition-colors',
                  dragging
                    ? 'border-[var(--ds-accent,#1F8A5B)] bg-[var(--ds-primary-soft,#ECFDF5)]'
                    : 'border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] hover:border-[var(--ds-primary,#1F8A5B)] hover:bg-[var(--ds-bg,#F2F5F3)]',
                )}
              >
                <Upload className="mx-auto mb-2 h-5 w-5 text-[var(--ds-text-secondary,#5B6B61)]" />
                <p className="text-sm text-[var(--ds-text-primary,#122018)]">Click or drag image here to upload</p>
                <p className="mt-1 text-xs text-[var(--ds-text-secondary,#5B6B61)]">JPG, PNG, GIF, WEBP — max 2MB</p>
                {avatarFile && (
                  <p className="mt-2 text-xs text-[var(--ds-success,#059669)]">Selected: {avatarFile.name}</p>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED}
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username (ID)</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="font-mono"
                placeholder="e.g. INST1234"
                readOnly={user?.role !== 'admin'}
                disabled={user?.role !== 'admin'}
              />
            </div>
          </div>

          <div className="space-y-4 border-t border-[var(--ds-border,#DDE5DF)] pt-4">
            <h3 className="flex items-center gap-2 text-sm font-medium text-[var(--ds-text-primary,#122018)]">
              <Lock className="h-4 w-4 text-[var(--ds-accent,#1F8A5B)]" /> Security
            </h3>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="flex items-center text-xs text-[var(--ds-text-secondary,#5B6B61)]">
                <AlertTriangle className="mr-1 h-3 w-3 text-[var(--ds-warning,#C2410C)]" />
                Changing email requires confirmation.
              </p>
            </div>

            <div className="grid gap-4 pt-2 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Required to change password"
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t border-[var(--ds-border,#DDE5DF)] pt-6">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default UserProfileSettings;
