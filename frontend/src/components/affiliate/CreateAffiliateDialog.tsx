import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, UserPlus } from 'lucide-react'
import { createNewUser } from '@/lib/api'
import { isValidEmail } from '@/lib/utils'
import { notify, MESSAGES } from '@/lib/notify'

/**
 * @deprecated Prefer creating affiliates from Users → Staff & Affiliates.
 * Kept for any remaining imports; Affiliate Report no longer uses this.
 */
const CreateAffiliateDialog = ({ isOpen, onClose, onCreated }) => {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
  })
  const [isSaving, setIsSaving] = useState(false)

  const reset = () => {
    setForm({ full_name: '', email: '', phone: '', password: '' })
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.full_name.trim()) {
      return notify.validation(MESSAGES.VALIDATION.FULL_NAME)
    }
    if (!isValidEmail(form.email)) {
      return notify.validation(MESSAGES.VALIDATION.EMAIL)
    }
    if (!form.password || form.password.length < 8) {
      return notify.validation(MESSAGES.VALIDATION.PASSWORD_MIN)
    }

    setIsSaving(true)
    try {
      await createNewUser({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        skipWelcomeEmail: true,
        user_metadata: {
          name: form.full_name.trim(),
          role: 'affiliate',
          phone: form.phone.trim() || null,
        },
        phone: form.phone.trim() || null,
      })

      notify.success(MESSAGES.SUCCESS.AFFILIATE_CREATED)
      onCreated?.()
      handleClose()
    } catch (err) {
      notify.error(err, { context: 'CreateAffiliateDialog', title: 'Create failed' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="bg-slate-950 border-slate-800 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-indigo-400" />
            Create Affiliate
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Affiliates are managed here only. No welcome email is sent.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="aff_name">Full Name *</Label>
            <Input
              id="aff_name"
              value={form.full_name}
              onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
              className="bg-slate-900 border-slate-800"
              placeholder="Real affiliate name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="aff_email">Email *</Label>
            <Input
              id="aff_email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              className="bg-slate-900 border-slate-800"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="aff_phone">Phone</Label>
            <Input
              id="aff_phone"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              className="bg-slate-900 border-slate-800"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="aff_password">Password *</Label>
            <Input
              id="aff_password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              className="bg-slate-900 border-slate-800"
              placeholder="Min. 8 characters"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-500">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Create Affiliate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default CreateAffiliateDialog
