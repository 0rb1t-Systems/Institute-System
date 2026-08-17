import React, { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, LayoutTemplate, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import TenantLandingRenderer from '@/components/landing/TenantLandingRenderer'
import type { LandingInstitution } from '@/components/landing/types'
import {
  LANDING_TEMPLATES,
  getLandingTemplate,
  type LandingTemplateId,
} from '@/lib/landingTemplates'

type Props = {
  open: boolean
  onClose: () => void
  /** Saves the selected template as the institution default. */
  onDone: (selectedId: LandingTemplateId) => void | Promise<void>
  institution: LandingInstitution
  activeId: LandingTemplateId
  /** Live preview on the page behind the dialog. */
  onSelect: (id: LandingTemplateId) => void
  canSave?: boolean
  saving?: boolean
  saveError?: string
}

/**
 * Pick a template; Done applies the last clicked choice as the active default.
 */
export default function LandingTemplateSwitcher({
  open,
  onClose,
  onDone,
  institution,
  activeId,
  onSelect,
  canSave = false,
  saving = false,
  saveError = '',
}: Props) {
  /** Draft selection inside the dialog — always what Done will save. */
  const [draftId, setDraftId] = useState<LandingTemplateId>(activeId)
  const meta = getLandingTemplate(draftId)

  const previewInst = useMemo(
    () => ({
      ...institution,
      landing_template_id: draftId,
      // Preview with this template's palette so each design looks distinct
      theme_primary: meta.defaultPrimary,
      theme_accent: meta.defaultAccent,
    }),
    [institution, draftId, meta.defaultPrimary, meta.defaultAccent],
  )

  // Every time the dialog opens, start from the current active template
  useEffect(() => {
    if (!open) return
    setDraftId(activeId)
  }, [open, activeId])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose, saving])

  const pick = (id: LandingTemplateId) => {
    if (saving) return
    setDraftId(id)
    onSelect(id)
  }

  const handleDone = () => {
    if (saving) return
    void onDone(draftId)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-label="Close"
            disabled={saving}
            onClick={() => !saving && onClose()}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="template-switcher-title"
            className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0b1220] shadow-2xl sm:rounded-3xl"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <LayoutTemplate className="h-4 w-4 text-teal-300" />
                <div>
                  <p id="template-switcher-title" className="text-sm font-semibold text-white">
                    Landing templates
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {canSave
                      ? 'Click a design, then Done to save it as your public page'
                      : 'Click Done — sign in as admin once, then it saves automatically'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={onClose}
                className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-white/10 bg-[#070d18] px-3 pt-3 sm:px-4">
              <p className="mb-2 px-1 text-xs text-slate-400">
                Preview · <span className="font-medium text-white">{meta.name}</span>
                {canSave ? (
                  <span className="ml-2 text-teal-300/90">· saved when you press Done</span>
                ) : (
                  <span className="ml-2 text-teal-300/90">· Done opens admin sign-in, then saves</span>
                )}
              </p>
              <div className="overflow-hidden rounded-xl border border-white/10">
                <div className="max-h-[36vh] overflow-y-auto">
                  <div className="pointer-events-none origin-top scale-[0.92] select-none sm:scale-100">
                    <TenantLandingRenderer institution={previewInst} preview templateId={draftId} />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              {saveError && <p className="mb-3 text-xs text-red-300">{saveError}</p>}
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {LANDING_TEMPLATES.map((t) => {
                  const selected = draftId === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={saving}
                      onClick={() => pick(t.id)}
                      className={`relative rounded-xl border p-2.5 text-left transition disabled:opacity-60 ${
                        selected
                          ? 'border-teal-400/70 bg-teal-500/10 ring-2 ring-teal-400/30'
                          : 'border-white/10 bg-white/5 hover:border-white/25'
                      }`}
                    >
                      <div
                        className="mb-2 h-14 rounded-lg bg-cover bg-center"
                        style={{
                          backgroundImage: `linear-gradient(135deg, ${t.defaultPrimary}bb, transparent 55%), url(${t.defaultHeroImage})`,
                        }}
                      />
                      <p className="text-xs font-semibold text-white">{t.name}</p>
                      {selected && (
                        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-teal-400 text-[#04201c]">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-white/10 px-4 py-3 sm:px-5">
              <Button
                type="button"
                variant="ghost"
                className="text-slate-400"
                disabled={saving}
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={saving}
                className="min-w-[7.5rem] bg-teal-500 font-semibold text-[#04201c] hover:bg-teal-400"
                onClick={handleDone}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Done'
                )}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
