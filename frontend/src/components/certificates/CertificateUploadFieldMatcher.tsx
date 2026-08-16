import React, { useCallback, useRef, useState } from 'react'
import QRCode from 'react-qr-code'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Save } from 'lucide-react'
import {
  getUploadFieldLabels,
  type DocumentBuilderKind,
  type UploadFieldKey,
  type UploadFieldLayout,
  type UploadFieldSlot,
} from '@/lib/certificateBuilder'

type Props = {
  backgroundUrl: string
  aspectRatio: number
  layout: UploadFieldLayout
  sample: {
    studentName: string
    studentId?: string
    programName: string
    certificateNumber: string
    dateIssued: string
    verificationUrl: string
  }
  onChange: (next: UploadFieldLayout) => void
  onSave: () => Promise<void>
  saving?: boolean
  documentType?: DocumentBuilderKind
}

/**
 * Match student data slots onto the scanned/uploaded certificate design.
 * Drag boxes to the empty areas of YOUR design — nothing else is added to the artwork.
 */
const CertificateUploadFieldMatcher = ({
  backgroundUrl,
  aspectRatio,
  layout,
  sample,
  onChange,
  onSave,
  saving = false,
  documentType = 'certificate',
}: Props) => {
  const labels = getUploadFieldLabels(documentType)
  const stageRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<UploadFieldKey>('studentName')
  const dragRef = useRef<{
    key: UploadFieldKey
    mode: 'move' | 'resize'
    startX: number
    startY: number
    orig: UploadFieldSlot
  } | null>(null)

  const updateField = useCallback(
    (key: UploadFieldKey, patch: Partial<UploadFieldSlot>) => {
      onChange({
        ...layout,
        fields: layout.fields.map((f) => (f.key === key ? { ...f, ...patch } : f)),
      })
    },
    [layout, onChange],
  )

  const onPointerDown = (
    e: React.PointerEvent,
    key: UploadFieldKey,
    mode: 'move' | 'resize',
  ) => {
    e.preventDefault()
    e.stopPropagation()
    const slot = layout.fields.find((f) => f.key === key)
    if (!slot) return
    setActive(key)
    dragRef.current = {
      key,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...slot },
    }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    const stage = stageRef.current
    if (!drag || !stage) return
    const rect = stage.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return
    const dx = ((e.clientX - drag.startX) / rect.width) * 100
    const dy = ((e.clientY - drag.startY) / rect.height) * 100

    if (drag.mode === 'move') {
      updateField(drag.key, {
        x: Math.min(100 - drag.orig.w, Math.max(0, drag.orig.x + dx)),
        y: Math.min(100 - drag.orig.h, Math.max(0, drag.orig.y + dy)),
      })
    } else {
      updateField(drag.key, {
        w: Math.min(100 - drag.orig.x, Math.max(4, drag.orig.w + dx)),
        h: Math.min(100 - drag.orig.y, Math.max(3, drag.orig.h + dy)),
      })
    }
  }

  const onPointerUp = () => {
    dragRef.current = null
  }

  const sampleText = (key: UploadFieldKey) => {
    switch (key) {
      case 'studentName':
        return sample.studentName
      case 'studentId':
        return sample.studentId || 'STU-001'
      case 'programName':
        return sample.programName
      case 'certificateNumber':
        return sample.certificateNumber
      case 'dateIssued':
        return sample.dateIssued
      default:
        return ''
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-white font-medium">Match fields on your design</p>
          <p className="text-xs text-slate-500">
            Drag each box onto the blank area of the uploaded certificate. Only your design + these
            matched fields are used when generating.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={saving}
          onClick={() => onSave()}
          className="bg-indigo-600 hover:bg-indigo-500"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          Save field match
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {layout.fields
          .filter((f) => Boolean(labels[f.key]))
          .map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setActive(f.key)}
            className={`text-[11px] px-2 py-1 rounded border transition-colors ${
              active === f.key
                ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
            } ${!f.enabled ? 'opacity-40' : ''}`}
          >
            {labels[f.key]}
          </button>
        ))}
      </div>

      {active ? (
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={layout.fields.find((f) => f.key === active)?.enabled !== false}
              onChange={(e) => updateField(active, { enabled: e.target.checked })}
            />
            Show {labels[active]}
          </label>
          {active !== 'qr' ? (
            <label className="inline-flex items-center gap-1.5">
              Size
              <input
                type="range"
                min={10}
                max={56}
                value={layout.fields.find((f) => f.key === active)?.fontSize || 14}
                onChange={(e) => updateField(active, { fontSize: Number(e.target.value) })}
                className="w-24"
              />
            </label>
          ) : null}
          <label className="inline-flex items-center gap-1.5">
            Color
            <input
              type="color"
              value={layout.fields.find((f) => f.key === active)?.color || '#111827'}
              onChange={(e) => updateField(active, { color: e.target.value })}
              className="h-6 w-8 bg-transparent border-0 cursor-pointer"
            />
          </label>
        </div>
      ) : null}

      <div
        ref={stageRef}
        className="relative w-full max-w-3xl mx-auto bg-white rounded overflow-hidden border border-slate-700 touch-none select-none"
        style={{ aspectRatio: `${Math.min(2.2, Math.max(0.5, aspectRatio))}` }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <img
          src={backgroundUrl}
          alt="Uploaded certificate template"
          className="absolute inset-0 w-full h-full object-fill pointer-events-none"
          draggable={false}
        />

        {layout.fields
          .filter((f) => f.enabled)
          .map((slot) => {
            const isActive = slot.key === active
            return (
              <div
                key={slot.key}
                onPointerDown={(e) => onPointerDown(e, slot.key, 'move')}
                className={`absolute cursor-move ${
                  isActive ? 'ring-2 ring-indigo-400 z-20' : 'ring-1 ring-sky-400/70 z-10'
                }`}
                style={{
                  left: `${slot.x}%`,
                  top: `${slot.y}%`,
                  width: `${slot.w}%`,
                  height: `${slot.h}%`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent:
                    slot.align === 'left'
                      ? 'flex-start'
                      : slot.align === 'right'
                        ? 'flex-end'
                        : 'center',
                  color: slot.color,
                  fontSize: Math.max(9, Math.round(slot.fontSize * 0.55)),
                  background: isActive ? 'rgba(99,102,241,0.12)' : 'rgba(14,165,233,0.08)',
                  boxSizing: 'border-box',
                }}
              >
                <Badge
                  className="absolute -top-5 left-0 text-[9px] px-1 py-0 h-4 bg-slate-900/90 text-slate-200 border-slate-600 pointer-events-none"
                >
                  {labels[slot.key]}
                </Badge>
                {slot.key === 'qr' ? (
                  <QRCode
                    value={sample.verificationUrl || 'https://verify.local/preview'}
                    size={128}
                    level="H"
                    fgColor={slot.color}
                    bgColor="transparent"
                    style={{ width: '80%', height: '80%' }}
                  />
                ) : (
                  <span className="w-full truncate px-1 text-center pointer-events-none">
                    {sampleText(slot.key)}
                  </span>
                )}
                <div
                  onPointerDown={(e) => onPointerDown(e, slot.key, 'resize')}
                  className="absolute right-0 bottom-0 w-3 h-3 bg-indigo-400 cursor-se-resize"
                />
              </div>
            )
          })}
      </div>
    </div>
  )
}

export default CertificateUploadFieldMatcher
