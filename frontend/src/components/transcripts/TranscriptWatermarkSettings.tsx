import React, { useEffect, useState } from 'react'
import { Loader2, Upload, Droplets } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import {
  getTranscriptWatermarkSettings,
  saveTranscriptWatermarkSettings,
  uploadInstitutionAsset,
} from '@/lib/api'
import { useToast } from '@/components/ui/use-toast'
import { getUserMessage } from '@/lib/mapError'
import { MESSAGES } from '@/lib/messages'
import {
  brandedImageSrc,
  getTranscriptWatermarkUrl,
  institutionLogoUrl,
} from '@/lib/institution'

/**
 * Compact watermark controls — follows dashboard light/dark tokens.
 * Paper preview stays light so the print look is clear.
 */
const TranscriptWatermarkSettings = () => {
  const { institution } = useAuth()
  const { toast } = useToast()
  const [watermarkUrl, setWatermarkUrl] = useState('')
  const [opacity, setOpacity] = useState(12)
  const [scale, setScale] = useState(45)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const wm = await getTranscriptWatermarkSettings()
        if (cancelled) return
        setWatermarkUrl(String(wm.url || ''))
        setOpacity(wm.opacity)
        setScale(wm.scale)
      } catch {
        if (!cancelled) {
          setWatermarkUrl('')
          setOpacity(12)
          setScale(45)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [institution?.id])

  const previewSrc = brandedImageSrc(
    watermarkUrl || getTranscriptWatermarkUrl(institution, { url: watermarkUrl }) || institutionLogoUrl(institution),
  )
  const usingInstitutionLogo = !String(watermarkUrl || '').trim() && Boolean(institutionLogoUrl(institution))

  const persist = async (patch: { url?: string | null; opacity?: number; scale?: number }) => {
    setSaving(true)
    try {
      const saved = await saveTranscriptWatermarkSettings(patch)
      setWatermarkUrl(String(saved.url || ''))
      setOpacity(saved.opacity)
      setScale(saved.scale)
      toast({
        title: 'Watermark saved',
        description: 'Transcript pages will show the updated watermark.',
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

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadInstitutionAsset(file, 'watermark')
      setWatermarkUrl(url || '')
      await persist({ url: url || null, opacity, scale })
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: getUserMessage(err, { fallback: MESSAGES.SAVE_FAILED }),
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="rounded-xl border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface,#fff)] p-3 space-y-3 text-[var(--ds-text-primary,#122018)]">
      <div className="flex items-center gap-2 min-w-0">
        <Droplets className="h-3.5 w-3.5 shrink-0 text-[var(--ds-accent,#1F8A5B)]" />
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold leading-none">Transcript watermark</h3>
          <p className="text-[11px] text-[var(--ds-text-secondary,#5B6B61)] mt-1 leading-snug">
            Compact controls · faint logo behind each page · defaults to institution logo.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--ds-accent,#1F8A5B)]" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[1fr_140px] items-start">
          <div className="space-y-2.5 min-w-0">
            <div className="flex items-center gap-2 rounded-lg border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] p-2">
              <div className="relative h-10 w-10 shrink-0 rounded-md border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface,#fff)] flex items-center justify-center overflow-hidden">
                {previewSrc ? (
                  <img
                    src={previewSrc}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                    style={{ opacity: Math.max(0.25, opacity / 100) }}
                  />
                ) : (
                  <span className="text-[8px] text-[var(--ds-text-tertiary,#8A978E)]">None</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1 min-w-0">
                <Label
                  htmlFor="transcript_watermark_file"
                  className="inline-flex items-center gap-1 text-[11px] cursor-pointer m-0 rounded-md border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface,#fff)] px-2 py-1 text-[var(--ds-text-primary,#122018)] hover:opacity-90"
                >
                  {uploading || saving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Upload className="h-3 w-3" />
                  )}
                  {watermarkUrl ? 'Replace' : 'Upload'}
                  <input
                    id="transcript_watermark_file"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={onUpload}
                    disabled={uploading || saving}
                  />
                </Label>
                {watermarkUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-[11px] text-[var(--ds-text-secondary,#5B6B61)]"
                    onClick={() => persist({ url: null, opacity, scale })}
                    disabled={uploading || saving}
                  >
                    Use logo
                  </Button>
                ) : null}
              </div>
            </div>
            <p className="text-[10px] text-[var(--ds-text-tertiary,#8A978E)] leading-snug">
              {usingInstitutionLogo
                ? 'Using institution logo.'
                : watermarkUrl
                  ? 'Custom watermark active.'
                  : 'Upload a logo or set an institution logo first.'}
            </p>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="transcript_watermark_opacity" className="text-[11px]">
                  Strength
                </Label>
                <span className="text-[10px] font-mono font-semibold">{opacity}%</span>
              </div>
              <input
                id="transcript_watermark_opacity"
                type="range"
                min={0}
                max={40}
                step={1}
                value={opacity}
                disabled={saving || uploading}
                onChange={(e) => setOpacity(Number(e.target.value))}
                onMouseUp={(e) => persist({ opacity: Number((e.target as HTMLInputElement).value) })}
                onTouchEnd={(e) => persist({ opacity: Number((e.target as HTMLInputElement).value) })}
                onBlur={(e) => persist({ opacity: Number(e.target.value) })}
                className="w-full h-1.5 accent-[var(--ds-primary,#1F8A5B)]"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="transcript_watermark_scale" className="text-[11px]">
                  Size
                </Label>
                <span className="text-[10px] font-mono font-semibold">{scale}%</span>
              </div>
              <input
                id="transcript_watermark_scale"
                type="range"
                min={25}
                max={65}
                step={1}
                value={scale}
                disabled={saving || uploading}
                onChange={(e) => setScale(Number(e.target.value))}
                onMouseUp={(e) => persist({ scale: Number((e.target as HTMLInputElement).value) })}
                onTouchEnd={(e) => persist({ scale: Number((e.target as HTMLInputElement).value) })}
                onBlur={(e) => persist({ scale: Number(e.target.value) })}
                className="w-full h-1.5 accent-[var(--ds-primary,#1F8A5B)]"
              />
              <p className="text-[10px] text-[var(--ds-text-tertiary,#8A978E)]">Compact mark · recommended ~45%</p>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-[var(--ds-text-secondary,#5B6B61)]">Paper preview</Label>
            <div
              className="relative h-[120px] rounded-md border border-[var(--ds-border,#DDE5DF)] bg-white overflow-hidden"
              aria-hidden
            >
              {previewSrc ? (
                <img
                  src={previewSrc}
                  alt=""
                  className="absolute inset-0 m-auto pointer-events-none"
                  style={{
                    opacity: opacity / 100,
                    width: `${scale}%`,
                    maxWidth: `${scale}%`,
                    height: 'auto',
                    aspectRatio: '1 / 1',
                    objectFit: 'contain',
                    objectPosition: 'center',
                  }}
                />
              ) : null}
              <div className="relative z-[1] p-2">
                <p className="text-[8px] font-black uppercase tracking-wide text-black/80">Transcript</p>
                <p className="text-[7px] font-bold text-black/60 leading-snug mt-1 max-w-[75%]">
                  Watermark stays behind the table text.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TranscriptWatermarkSettings
