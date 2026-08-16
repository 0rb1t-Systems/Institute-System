import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, ScrollText } from 'lucide-react'
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
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-sky-400" />
          <div>
            <CardTitle className="text-white text-base">Transcript Template Library</CardTitle>
            <CardDescription>
              Preview professional transcript designs and choose one active template. Your institution branding is applied automatically.
              {isCustomTranscriptLayout(activeKey) ? (
                <span className="block mt-1 text-amber-300/90">
                  Active mode: {activeKey === 'logo_builder' ? 'Page Builder' : 'Upload Own'} — select a library template below to switch back.
                </span>
              ) : null}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {TRANSCRIPT_TEMPLATE_LIBRARY.map((tpl) => {
                const isActive = tpl.key === activeKey
                const isPreview = tpl.key === previewKey
                return (
                  <button
                    key={tpl.key}
                    type="button"
                    onClick={() => setPreviewKey(tpl.key)}
                    className={`text-left rounded-lg border p-3 transition ${
                      isPreview
                        ? 'border-sky-500 bg-slate-950 ring-1 ring-sky-500/40'
                        : 'border-slate-800 bg-slate-950/50 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="text-sm font-medium text-white">{tpl.name}</p>
                        <p className="text-[11px] text-slate-500">{tpl.category}</p>
                      </div>
                      {isActive ? (
                        <Badge className="bg-emerald-600/20 text-emerald-300 border-emerald-700/40">Active</Badge>
                      ) : (
                        <span
                          className="h-2.5 w-2.5 rounded-full mt-1.5 shrink-0"
                          style={{ backgroundColor: tpl.accentHint }}
                        />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 mb-2">{tpl.description}</p>
                    <div className="pointer-events-none max-h-40 overflow-hidden rounded border border-slate-800 bg-white">
                      <TranscriptCanvas compact data={{ ...sampleData, layoutKey: tpl.key }} />
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p className="text-sm text-slate-300">
                  Preview:{' '}
                  <span className="text-white font-medium">
                    {TRANSCRIPT_TEMPLATE_LIBRARY.find((t) => t.key === previewKey)?.name}
                  </span>
                </p>
                <Button
                  type="button"
                  size="sm"
                  disabled={saving || previewKey === activeKey}
                  onClick={() => handleActivate(previewKey)}
                  className="bg-sky-600 hover:bg-sky-500"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {previewKey === activeKey ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Active template
                    </>
                  ) : (
                    'Set as active template'
                  )}
                </Button>
              </div>
              <div className="max-w-md mx-auto bg-white rounded overflow-hidden">
                <TranscriptCanvas data={sampleData} />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default TranscriptTemplateLibrary
