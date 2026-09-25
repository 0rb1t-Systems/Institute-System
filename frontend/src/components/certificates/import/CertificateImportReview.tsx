import React, { useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import CertificateImportEditor from '@/components/certificates/import/CertificateImportEditor'
import { designDependsOnSourceFile } from '@/lib/certificateImport/generateTemplate'
import {
  PARTIAL_RECONSTRUCTION_MESSAGE,
  type ImportSummary,
  type TextBlock,
} from '@/lib/certificateImport/types'
import { expandCleanLines, looksLikeJammedMash } from '@/lib/certificateImport/untangle'
import type { CertificateRenderData } from '@/lib/certificateTemplates'
import type { LogoBuilderDesign } from '@/lib/certificateBuilder'

type Props = {
  design: LogoBuilderDesign
  summary: ImportSummary
  warnings: string[]
  referenceFile: File | null
  referenceTexts: TextBlock[]
  preview: CertificateRenderData
  templateName: string
  onTemplateName: (value: string) => void
  classId: string
  onClassId: (value: string) => void
  classes: Array<{ id: string; name: string }>
  onDesignChange: (design: LogoBuilderDesign) => void
  saving: boolean
  saved: boolean
  onSave: () => void
  onDiscardReference: () => void
  onStartOver: () => void
}

async function paintPdf(file: File, canvas: HTMLCanvasElement) {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()
  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjs.getDocument({ data }).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 1.15 })
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  await page.render({ canvasContext: ctx, viewport }).promise
}

const ReferencePreview = ({
  file,
  texts,
  summary,
}: {
  file: File | null
  texts: TextBlock[]
  summary: ImportSummary
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [failed, setFailed] = useState(false)

  React.useEffect(() => {
    if (!file || summary.sourceKind !== 'pdf') return
    let cancel = false
    setFailed(false)
    const canvas = canvasRef.current
    if (!canvas) return
    paintPdf(file, canvas).catch(() => {
      if (!cancel) setFailed(true)
    })
    return () => {
      cancel = true
    }
  }, [file, summary.sourceKind])

  if (!file) {
    return (
      <p className="text-sm text-[var(--ds-text-secondary,#5B6B61)]">
        The reference file has been removed. The generated template does not use it.
      </p>
    )
  }
  if (summary.sourceKind === 'pdf') {
    if (failed) {
      return <p className="text-sm text-[var(--ds-text-secondary,#5B6B61)]">The reference preview could not be drawn.</p>
    }
    return <canvas ref={canvasRef} className="h-auto w-full bg-white" />
  }

  const clean = expandCleanLines(texts)
    .filter((t) => !looksLikeJammedMash(t) && t.length >= 3)
    .slice(0, 24)
  return (
    <div
      className="flex w-full flex-col items-center justify-center gap-2 bg-white px-6 py-8 text-center"
      style={{
        aspectRatio: `${summary.page.width} / ${summary.page.height}`,
        fontFamily: 'Georgia, "Times New Roman", serif',
      }}
    >
      {clean.map((text, index) => (
        <p
          key={`${text}-${index}`}
          style={{
            color: '#0f172a',
            fontSize: Math.max(11, Math.min(22, 14)),
            lineHeight: 1.35,
            letterSpacing: '0.02em',
            maxWidth: '92%',
          }}
        >
          {text}
        </p>
      ))}
    </div>
  )
}

const CertificateImportReview = ({
  design,
  summary,
  warnings,
  referenceFile,
  referenceTexts,
  preview,
  templateName,
  onTemplateName,
  classId,
  onClassId,
  classes,
  onDesignChange,
  saving,
  saved,
  onSave,
  onDiscardReference,
  onStartOver,
}: Props) => {
  const independent = !designDependsOnSourceFile(design)

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface,#fff)] px-4 py-3 text-sm text-[var(--ds-text-primary,#122018)]">
        Drag any text or image to move it. Use the green corner handles to resize. Positions you set are kept exactly when you save and when students generate. You can save many templates — upload another certificate anytime.
        {warnings.length ? ` ${PARTIAL_RECONSTRUCTION_MESSAGE}` : ''}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-[var(--ds-text-primary,#122018)]">Original reference</h2>
          <Badge variant="outline">Reference only</Badge>
        </div>
        <div className="mx-auto max-w-xl overflow-hidden rounded-[var(--ds-radius-xl,16px)] border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F4F7F5)] p-3">
          <ReferencePreview file={referenceFile} texts={referenceTexts} summary={summary} />
        </div>
        {referenceFile ? (
          <Button type="button" variant="outline" onClick={onDiscardReference}>
            Remove reference file
          </Button>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-[var(--ds-text-primary,#122018)]">Edit generated template</h2>
          <Badge>Generated template</Badge>
        </div>
        <div className="rounded-[var(--ds-radius-xl,16px)] border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface,#fff)] p-3 sm:p-4">
          <CertificateImportEditor design={design} preview={preview} onChange={onDesignChange} />
        </div>
        <p className="text-xs text-[var(--ds-text-secondary,#5B6B61)]">
          {independent
            ? 'Drag to move · corner handles to resize · side panel for font/size/color · Upload logo or Upload patch. Save keeps every position.'
            : 'This result still depends on the uploaded file and cannot be saved.'}
        </p>
      </section>

      {warnings.length ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--ds-text-secondary,#5B6B61)]">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      <div className="rounded-2xl border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] p-4 sm:p-5">
        <p className="text-sm font-semibold text-[var(--ds-text-primary,#122018)]">Save this certificate</p>
        <p className="mt-1 text-xs text-[var(--ds-text-secondary,#5B6B61)]">
          Give it a clear name, optionally lock it to one class, then activate for student generation.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="import-template-name">Template name</Label>
            <Input
              id="import-template-name"
              value={templateName}
              maxLength={120}
              placeholder="e.g. Morning Cohort Completion"
              onChange={(event) => onTemplateName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="import-template-class">Class (prints on generate)</Label>
            <select
              id="import-template-class"
              className="h-10 w-full rounded-md border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface,#fff)] px-3 text-sm text-[var(--ds-text-primary,#122018)] outline-none focus:border-[var(--ds-accent,#1F8A5B)] focus:ring-1 focus:ring-[var(--ds-focus-ring,#1F8A5B)]"
              value={classId}
              onChange={(event) => onClassId(event.target.value)}
            >
              <option value="">All classes (institution default)</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[var(--ds-text-secondary,#5B6B61)]">
              When you generate that class in Report Center, student + class names print on this design.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <Button type="button" onClick={onSave} disabled={saving || saved || !independent}>
            {saved ? 'Saved & active' : saving ? 'Saving…' : 'Save & activate for students'}
          </Button>
          <Button type="button" variant="outline" onClick={onStartOver} disabled={saving}>
            Import another certificate
          </Button>
        </div>
      </div>
    </div>
  )
}

export default CertificateImportReview
