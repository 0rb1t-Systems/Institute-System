import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getDocumentTemplate, setActiveTranscriptTemplate } from '@/lib/api'
import {
  TRANSCRIPT_TEMPLATE_LIBRARY,
  normalizeTranscriptLayoutKey,
  isCustomTranscriptLayout,
  libraryTranscriptLayoutKey,
  type TranscriptLayoutKey,
  type TranscriptRenderData,
} from '@/lib/transcriptTemplates'
import {
  getInstitutionDisplayName,
  getInstitutionPrimary,
  getInstitutionAccent,
  getInstitutionContactLine,
  getTranscriptFooterText,
} from '@/lib/institution'
import TranscriptCanvas from '@/components/transcripts/TranscriptCanvas'
import { useToast } from '@/components/ui/use-toast'
import { getUserMessage } from '@/lib/mapError'
import { MESSAGES } from '@/lib/messages'

/**
 * Transcript Template Library — embedded in Institution Settings.
 * Selects active layout only; branding always from Institution Settings.
 */
const TranscriptTemplateLibrary = () => {
  const { institution } = useAuth()
  const { toast } = useToast()
  const [activeKey, setActiveKey] = useState<TranscriptLayoutKey>('classic')
  const [previewKey, setPreviewKey] = useState<TranscriptLayoutKey>('classic')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const tpl = await getDocumentTemplate('transcript')
        const key = normalizeTranscriptLayoutKey(tpl?.layout_key)
        if (!cancelled) {
          setActiveKey(key)
          setPreviewKey(libraryTranscriptLayoutKey(key))
        }
      } catch {
        if (!cancelled) {
          setActiveKey('classic')
          setPreviewKey('classic')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [institution?.id])

  const sampleData: TranscriptRenderData = useMemo(
    () => ({
      layoutKey: libraryTranscriptLayoutKey(previewKey),
      institutionName: getInstitutionDisplayName(institution),
      primary: getInstitutionPrimary(institution),
      accent: getInstitutionAccent(institution),
      contactLine: getInstitutionContactLine(institution) || undefined,
      logoUrl: institution?.logo_url,
      studentName: 'Amina Hassan',
      studentCode: 'STU-2026-001',
      programName: 'Diploma in Professional Studies',
      credentialNumber: '0000042',
      footerText: getTranscriptFooterText(institution) || undefined,
      gpa: '3.40',
    }),
    [institution, previewKey],
  )

  const handleActivate = async (key: TranscriptLayoutKey) => {
    setSaving(true)
    try {
      const row = await setActiveTranscriptTemplate(key)
      const next = normalizeTranscriptLayoutKey(row?.layout_key || key)
      setActiveKey(next)
      setPreviewKey(libraryTranscriptLayoutKey(next))
      toast({
        title: 'Template activated',
        description: `${TRANSCRIPT_TEMPLATE_LIBRARY.find((t) => t.key === libraryTranscriptLayoutKey(next))?.name || next} is now your active transcript design.`,
      })
    } catch (err) {
      toast({
        title: 'Error',
        description: getUserMessage(err, { fallback: MESSAGES.SAVE_FAILED }),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 rounded-[var(--ds-radius-xl,16px)] border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface,#fff)] p-4">
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--ds-accent,#1F8A5B)]" />
        </div>
      ) : (
        <>
          {isCustomTranscriptLayout(activeKey) ? (
            <p className="rounded-[var(--ds-radius-md,8px)] border border-[var(--ds-warning,#C2410C)]/30 bg-[var(--ds-warning-bg,#FFF7ED)] px-3 py-2 text-xs text-[var(--ds-warning,#C2410C)]">
              Using {activeKey === 'logo_builder' ? 'Builder' : 'Upload'} as the live transcript. Choose a library design only if you want to switch.
            </p>
          ) : null}
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {TRANSCRIPT_TEMPLATE_LIBRARY.map((tpl) => {
              const isActive = tpl.key === activeKey
              const isPreview = tpl.key === previewKey
              return (
                <button
                  key={tpl.key}
                  type="button"
                  onClick={() => setPreviewKey(tpl.key)}
                  className={`rounded-[var(--ds-radius-lg,12px)] border p-2.5 text-left transition ${
                    isPreview
                      ? 'border-[var(--ds-primary,#1F8A5B)] bg-[var(--ds-primary-soft,#ECFDF5)] ring-1 ring-[var(--ds-primary,#1F8A5B)]/30'
                      : 'border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] hover:border-[var(--ds-border-strong,#C5D0C8)]'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-[var(--ds-text-primary,#122018)]">{tpl.name}</p>
                    {isActive ? (
                      <Badge className="border-[var(--ds-accent,#1F8A5B)]/30 bg-[var(--ds-primary-soft,#ECFDF5)] text-[10px] text-[var(--ds-accent,#1F8A5B)]">
                        Active
                      </Badge>
                    ) : (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: tpl.accentHint }}
                      />
                    )}
                  </div>
                  <div className="pointer-events-none max-h-28 overflow-hidden rounded border border-[var(--ds-border,#DDE5DF)] bg-white">
                    <TranscriptCanvas compact data={{ ...sampleData, layoutKey: tpl.key }} />
                  </div>
                </button>
              )
            })}
          </div>

          <div className="rounded-[var(--ds-radius-lg,12px)] border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-[var(--ds-text-secondary,#5B6B61)]">
                Preview:{' '}
                <span className="font-medium text-[var(--ds-text-primary,#122018)]">
                  {TRANSCRIPT_TEMPLATE_LIBRARY.find((t) => t.key === previewKey)?.name}
                </span>
              </p>
              <Button
                type="button"
                size="sm"
                disabled={saving || previewKey === activeKey}
                onClick={() => handleActivate(previewKey)}
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {previewKey === activeKey ? (
                  <>
                    <CheckCircle2 className="mr-1 h-4 w-4" /> In use
                  </>
                ) : (
                  'Use this design'
                )}
              </Button>
            </div>
            <div className="mx-auto max-w-md overflow-hidden rounded bg-white">
              <TranscriptCanvas data={sampleData} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default TranscriptTemplateLibrary
