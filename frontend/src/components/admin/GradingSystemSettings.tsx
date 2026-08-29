import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, GraduationCap, Plus, Trash2, Upload, RotateCcw, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { updateInstitution, uploadInstitutionAsset, resyncInstitutionGradeLetters } from '@/lib/api'
import { useToast } from '@/components/ui/use-toast'
import { getUserMessage } from '@/lib/mapError'
import { MESSAGES } from '@/lib/messages'
import {
  type GradeBand,
  type GradeClassification,
  type GradingScale,
  getDefaultGradingScale,
  getInstitutionGradeScale,
  isCustomGradingScale,
  validateGradingScale,
  buildGradingScalePayload,
  formatClassificationRange,
} from '@/lib/gradingScale'
import { extractGradingScaleFromFile } from '@/lib/extractGradingScale'

const emptyBand = (): GradeBand => ({
  min: 0,
  max: 59.9,
  letter: 'F',
  points: 0,
  label: 'Below 60',
})

const GradingSystemSettings = ({ onUpdated }: { onUpdated?: (inst: unknown) => void }) => {
  const { institution, refreshUser } = useAuth()
  const { toast } = useToast()
  const [scale, setScale] = useState<GradingScale>(getDefaultGradingScale())
  const [saving, setSaving] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [ocrPct, setOcrPct] = useState(0)
  const [rawPreview, setRawPreview] = useState('')

  const isCustom = useMemo(() => isCustomGradingScale(institution), [institution])

  useEffect(() => {
    setScale(getInstitutionGradeScale(institution))
    setRawPreview('')
  }, [institution])

  const updateBand = (idx: number, patch: Partial<GradeBand>) => {
    setScale((prev) => {
      const bands = prev.bands.map((b, i) => {
        if (i !== idx) return b
        const next = { ...b, ...patch }
        if (patch.min != null || patch.max != null) {
          const min = Number(next.min)
          const max = Number(next.max)
          next.label =
            min <= 0.05
              ? `Below ${Math.ceil(max + 0.05)}`
              : `${min} - ${max}`
        }
        return next
      })
      return { ...prev, bands }
    })
  }

  const updateClassification = (idx: number, patch: Partial<GradeClassification>) => {
    setScale((prev) => ({
      ...prev,
      classifications: prev.classifications.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    }))
  }

  const handleUploadExtract = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setExtracting(true)
    setOcrPct(0)
    try {
      let sourceUrl: string | null = null
      try {
        if (file.type.startsWith('image/')) {
          sourceUrl = await uploadInstitutionAsset(file, 'grading_key')
        }
      } catch {
        // Optional asset upload — extraction can still proceed
      }

      const extracted = await extractGradingScaleFromFile(file, setOcrPct)
      setRawPreview(extracted.rawText || '')

      if (!extracted.bands?.length) {
        toast({
          title: 'Could not read grades',
          description:
            'No grade rows found. Check the image is clear, or enter bands manually.',
          variant: 'destructive',
        })
        return
      }

      setScale((prev) => ({
        ...prev,
        source: 'upload',
        bands: extracted.bands,
        pass_mark: extracted.pass_mark ?? prev.pass_mark,
        scale_max: extracted.scale_max ?? prev.scale_max,
        classifications: extracted.classifications?.length
          ? extracted.classifications
          : prev.classifications,
        source_file_url: sourceUrl || prev.source_file_url,
      }))
      toast({
        title: 'Grading extracted',
        description: `Found ${extracted.bands.length} grade bands. Review and save.`,
      })
    } catch (err) {
      toast({
        title: 'Extraction failed',
        description: getUserMessage(err, { fallback: 'Could not read the grading document.' }),
        variant: 'destructive',
      })
    } finally {
      setExtracting(false)
      setOcrPct(0)
      e.target.value = ''
    }
  }

  const handleSave = async (source: GradingScale['source'] = 'manual') => {
    const payload = buildGradingScalePayload(scale, source === 'default' ? scale.source : source)
    const err = validateGradingScale(payload)
    if (err) {
      toast({ title: 'Validation', description: err, variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const updated = await updateInstitution({ grading_scale: payload })
      if (institution?.id) {
        try {
          await resyncInstitutionGradeLetters(institution.id)
        } catch {
          // Letters refresh is best-effort; scale is already saved
        }
      }
      await refreshUser?.()
      onUpdated?.(updated)
      toast({ title: 'Saved', description: 'Institution grading system updated.' })
    } catch (e) {
      toast({
        title: 'Error',
        description: getUserMessage(e, { fallback: MESSAGES.SAVE_FAILED }),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleResetDefault = async () => {
    setSaving(true)
    try {
      const updated = await updateInstitution({ grading_scale: null })
      if (institution?.id) {
        try {
          await resyncInstitutionGradeLetters(institution.id)
        } catch {
          /* ignore */
        }
      }
      setScale(getDefaultGradingScale())
      setRawPreview('')
      await refreshUser?.()
      onUpdated?.(updated)
      toast({ title: 'Reset', description: 'Using the default BRCE grading scale.' })
    } catch (e) {
      toast({
        title: 'Error',
        description: getUserMessage(e, { fallback: MESSAGES.SAVE_FAILED }),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="bg-[var(--tenant-bg-2)] border-[var(--tenant-line)] shadow-none">
      <CardHeader>
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-indigo-400" />
          <div>
            <CardTitle className="text-[var(--tenant-text)] text-base">Grading System</CardTitle>
            <CardDescription>
              Set your institution&apos;s Key to Grades. Used on gradebooks, dashboards, GPA, and
              transcripts. Leave default until you customize.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <Alert
          className={
            isCustom
              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-100'
              : 'bg-[var(--tenant-bg)] border-[var(--tenant-line)] text-[var(--tenant-text)]'
          }
        >
          {isCustom ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <GraduationCap className="h-4 w-4" />
          )}
          <AlertDescription>
            {isCustom
              ? 'Using your custom institution grading scale.'
              : 'Using default BRCE scale (A–F / 4.0). Upload or edit below to customize.'}
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label>Upload Key to Grades (image or PDF)</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Label
              htmlFor="grading_key_upload"
              className="inline-flex items-center gap-2 text-sm text-[var(--tenant-text)] cursor-pointer m-0"
            >
              <span className="inline-flex items-center gap-1 rounded-md border border-[var(--tenant-line)] px-3 py-1.5 hover:bg-[var(--tenant-bg)]">
                {extracting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {extracting ? `Reading… ${ocrPct}%` : 'Upload & extract'}
              </span>
              <input
                id="grading_key_upload"
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                className="hidden"
                onChange={handleUploadExtract}
                disabled={extracting || saving}
              />
            </Label>
            <p className="text-xs text-[var(--tenant-muted)]">
              OCR extracts mark %, letter, and grade points for review before save.
            </p>
          </div>
          {scale.source_file_url ? (
            <a
              href={scale.source_file_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-indigo-400 hover:underline"
            >
              View uploaded grading document
            </a>
          ) : null}
        </div>

        {rawPreview ? (
          <details className="rounded-md border border-[var(--tenant-line)] bg-[var(--tenant-bg)] p-3">
            <summary className="text-xs text-[var(--tenant-muted)] cursor-pointer">OCR text preview</summary>
            <pre className="mt-2 text-[11px] text-[var(--tenant-muted)] whitespace-pre-wrap max-h-40 overflow-auto">
              {rawPreview}
            </pre>
          </details>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pass_mark">Course pass mark (%)</Label>
            <Input
              id="pass_mark"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={scale.pass_mark}
              onChange={(e) => setScale((p) => ({ ...p, pass_mark: Number(e.target.value) }))}
              className="bg-[var(--tenant-surface)] border-[var(--tenant-line)]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="scale_max">GPA scale max</Label>
            <Input
              id="scale_max"
              type="number"
              min={1}
              max={10}
              step={0.1}
              value={scale.scale_max}
              onChange={(e) => setScale((p) => ({ ...p, scale_max: Number(e.target.value) }))}
              className="bg-[var(--tenant-surface)] border-[var(--tenant-line)]"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Grade bands (Mark % → Letter → Points)</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 border-[var(--tenant-line)]"
              onClick={() => setScale((p) => ({ ...p, bands: [...p.bands, emptyBand()] }))}
              disabled={saving}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add band
            </Button>
          </div>
          <div className="rounded-md border border-[var(--tenant-line)] overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_0.7fr_0.7fr_2rem] gap-1 bg-[var(--tenant-bg)] px-2 py-2 text-[11px] uppercase text-[var(--tenant-muted)] font-semibold">
              <span>Min %</span>
              <span>Max %</span>
              <span>Letter</span>
              <span>Points</span>
              <span />
            </div>
            {scale.bands.map((band, idx) => (
              <div
                key={`${band.letter}-${idx}`}
                className="grid grid-cols-[1fr_1fr_0.7fr_0.7fr_2rem] gap-1 border-t border-[var(--tenant-line)] px-2 py-1.5 items-center"
              >
                <Input
                  type="number"
                  step="0.1"
                  value={band.min}
                  onChange={(e) => updateBand(idx, { min: Number(e.target.value) })}
                  className="h-8 bg-[var(--tenant-surface)] border-[var(--tenant-line)] text-sm"
                />
                <Input
                  type="number"
                  step="0.1"
                  value={band.max}
                  onChange={(e) => updateBand(idx, { max: Number(e.target.value) })}
                  className="h-8 bg-[var(--tenant-surface)] border-[var(--tenant-line)] text-sm"
                />
                <Input
                  value={band.letter}
                  onChange={(e) => updateBand(idx, { letter: e.target.value })}
                  className="h-8 bg-[var(--tenant-surface)] border-[var(--tenant-line)] text-sm"
                />
                <Input
                  type="number"
                  step="0.1"
                  value={band.points}
                  onChange={(e) => updateBand(idx, { points: Number(e.target.value) })}
                  className="h-8 bg-[var(--tenant-surface)] border-[var(--tenant-line)] text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-[var(--tenant-muted)] hover:text-red-600"
                  onClick={() =>
                    setScale((p) => ({
                      ...p,
                      bands: p.bands.filter((_, i) => i !== idx),
                    }))
                  }
                  disabled={scale.bands.length <= 1}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Key to classification of awards (CGPA)</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 border-[var(--tenant-line)]"
              onClick={() =>
                setScale((p) => ({
                  ...p,
                  classifications: [
                    ...p.classifications,
                    { name: 'New class', min: 0, max: 0 },
                  ],
                }))
              }
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {scale.classifications.map((c, idx) => (
              <div key={`${c.name}-${idx}`} className="grid grid-cols-[1.5fr_0.7fr_0.7fr_2rem] gap-1 items-center">
                <Input
                  value={c.name}
                  onChange={(e) => updateClassification(idx, { name: e.target.value })}
                  className="h-8 bg-[var(--tenant-surface)] border-[var(--tenant-line)] text-sm"
                  placeholder="Classification name"
                />
                <Input
                  type="number"
                  step="0.01"
                  value={c.min}
                  onChange={(e) => updateClassification(idx, { min: Number(e.target.value) })}
                  className="h-8 bg-[var(--tenant-surface)] border-[var(--tenant-line)] text-sm"
                  placeholder="Min"
                />
                <Input
                  type="number"
                  step="0.01"
                  value={c.max}
                  onChange={(e) => updateClassification(idx, { max: Number(e.target.value) })}
                  className="h-8 bg-[var(--tenant-surface)] border-[var(--tenant-line)] text-sm"
                  placeholder="Max"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-[var(--tenant-muted)] hover:text-red-600"
                  onClick={() =>
                    setScale((p) => ({
                      ...p,
                      classifications: p.classifications.filter((_, i) => i !== idx),
                    }))
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {scale.classifications.length === 0 ? (
              <p className="text-xs text-[var(--tenant-muted)]">No classifications (optional).</p>
            ) : (
              <p className="text-xs text-[var(--tenant-muted)]">
                Preview:{' '}
                {scale.classifications
                  .map((c) => `${c.name} (${formatClassificationRange(c)})`)
                  .join(' · ')}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            disabled={saving || extracting}
            onClick={() => handleSave(scale.source === 'upload' ? 'upload' : 'manual')}
            className="bg-indigo-600 hover:bg-indigo-500"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save grading system
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-[var(--tenant-line)]"
            disabled={saving || extracting || !isCustom}
            onClick={handleResetDefault}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to default
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default GradingSystemSettings
