import React, { useEffect, useMemo, useRef, useState } from 'react'
import CertificateImportDropzone from '@/components/certificates/import/CertificateImportDropzone'
import CertificateImportLibrary from '@/components/certificates/import/CertificateImportLibrary'
import CertificateImportProgress from '@/components/certificates/import/CertificateImportProgress'
import CertificateImportReview from '@/components/certificates/import/CertificateImportReview'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import {
  activateImportedCertificateTemplate,
  deleteImportedCertificateTemplate,
  listImportedCertificateTemplates,
  saveImportedCertificateTemplate,
  updateImportedCertificateTemplate,
  type SavedCertificateImport,
} from '@/lib/certificateImport/api'
import { runCertificateImport, type CertificateImportResult } from '@/lib/certificateImport/runImport'
import {
  importErrorMessage,
  type ImportStageId,
} from '@/lib/certificateImport/types'
import type { CertificateRenderData } from '@/lib/certificateTemplates'
import {
  extractCertStoragePath,
  normalizeLogoBuilderDesign,
  type LogoBuilderDesign,
} from '@/lib/certificateBuilder'
import {
  getCertificateTemplateSignedUrl,
  getClasses,
  getDocumentTemplate,
} from '@/lib/api'
import {
  getCertificateFooterText,
  getInstitutionAccent,
  getInstitutionDisplayName,
  getInstitutionPrimary,
  getSignatoryLeftName,
  getSignatoryLeftTitle,
  getSignatoryRightName,
  getSignatoryRightTitle,
  institutionLogoUrl,
  type InstitutionBrand,
} from '@/lib/institution'

async function resolveImportDesignImages(design: LogoBuilderDesign): Promise<LogoBuilderDesign> {
  const normalized = normalizeLogoBuilderDesign(design)
  const elements = await Promise.all(
    (normalized.elements || []).map(async (el) => {
      if (el.type !== 'image' || !el.src) return el
      const path = extractCertStoragePath(el.src)
      if (!path) return el
      try {
        const url = await getCertificateTemplateSignedUrl(path)
        return url ? { ...el, src: url } : el
      } catch {
        return el
      }
    }),
  )
  return { ...normalized, elements }
}

function defaultName(fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
  return (base || 'Imported certificate').slice(0, 120)
}

function saveErrorMessage(err: unknown) {
  const message = err && typeof err === 'object' && 'message' in err ? String((err as { message?: string }).message) : ''
  if (/imported_certificate_templates|schema cache|PGRST205|42P01/i.test(message)) {
    return 'Imported templates are not available in the database yet. Apply migration 0111 and try saving again.'
  }
  if (/IMPORT_BACKGROUND_FORBIDDEN/i.test(message)) {
    return 'The generated template was rejected because it still depended on the uploaded file.'
  }
  if (/FORBIDDEN/i.test(message)) return 'Only an institution admin can save imported certificate templates.'
  if (/IMPORT_LIMIT/i.test(message)) return 'This institution already has 40 imported templates. Delete one before saving another.'
  if (/CLASS_NOT_FOUND/i.test(message)) return 'That class was not found for this institution.'
  return 'The template could not be saved.'
}

/**
 * Certificate Import — lives under Institution Settings → Documents / Certificates → Upload.
 * Analyzes PDF/DOCX into editable elements; separate from Page Builder (logo_builder).
 */
const CertificateImportPanel = () => {
  const { institution } = useAuth()
  const brandSource = (institution || null) as InstitutionBrand | null
  const { toast } = useToast()
  const runRef = useRef(0)
  const [saved, setSaved] = useState<SavedCertificateImport[]>([])
  const [loadingSaved, setLoadingSaved] = useState(true)
  const [activeStage, setActiveStage] = useState<ImportStageId | null>(null)
  const [doneStages, setDoneStages] = useState<ImportStageId[]>([])
  const [stageDetail, setStageDetail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CertificateImportResult | null>(null)
  const [referenceFile, setReferenceFile] = useState<File | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [classId, setClassId] = useState('')
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([])
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [activeImportedId, setActiveImportedId] = useState<string | null>(null)
  const [activatingId, setActivatingId] = useState<string | null>(null)
  const [openSaved, setOpenSaved] = useState<SavedCertificateImport | null>(null)
  const [resolvedPreviewDesign, setResolvedPreviewDesign] = useState<LogoBuilderDesign | null>(null)

  const institutionName = getInstitutionDisplayName(brandSource)

  const loadActiveImportedId = async () => {
    try {
      const tpl = await getDocumentTemplate('certificate')
      const upload = tpl?.config?.custom_upload as { imported_template_id?: string } | undefined
      setActiveImportedId(upload?.imported_template_id ? String(upload.imported_template_id) : null)
    } catch {
      setActiveImportedId(null)
    }
  }

  const loadSaved = async () => {
    setLoadingSaved(true)
    try {
      const rows = await listImportedCertificateTemplates()
      setSaved(rows)
      await loadActiveImportedId()
    } catch {
      setSaved([])
    } finally {
      setLoadingSaved(false)
    }
  }

  useEffect(() => {
    loadSaved()
    getClasses()
      .then((rows) =>
        setClasses(
          (rows || []).map((c: { id: string; name?: string }) => ({
            id: String(c.id),
            name: String(c.name || 'Class'),
          })),
        ),
      )
      .catch(() => setClasses([]))
  }, [brandSource?.id])

  useEffect(() => {
    const design = openSaved?.design || result?.design
    if (!design) {
      setResolvedPreviewDesign(null)
      return
    }
    let cancelled = false
    resolveImportDesignImages(design).then((next) => {
      if (!cancelled) setResolvedPreviewDesign(next)
    })
    return () => {
      cancelled = true
    }
  }, [openSaved?.id, openSaved?.design, result?.design])

  const preview = useMemo<CertificateRenderData>(() => {
    const design = resolvedPreviewDesign || openSaved?.design || result?.design
    const programFromDesign = (design?.elements || []).find(
      (el) => el.type === 'text' && (el.name === 'Program title' || el.bind === 'programName'),
    )?.text
    const certNoFromDesign = (design?.elements || []).find(
      (el) => el.type === 'text' && el.bind === 'certificateNumber',
    )?.text
    return {
      layoutKey: 'custom_upload',
      institutionName,
      primary: getInstitutionPrimary(brandSource),
      accent: getInstitutionAccent(brandSource),
      motto: brandSource?.motto || undefined,
      logoUrl: institutionLogoUrl(brandSource) || null,
      sealUrl: brandSource?.seal_url,
      signatureUrl: brandSource?.signature_url,
      institutionEmail: brandSource?.email || undefined,
      institutionPhone: brandSource?.phone || undefined,
      institutionAddress: brandSource?.address || undefined,
      institutionWebsite: brandSource?.website || undefined,
      studentName: 'Amina Hassan',
      studentId: 'STU-001',
      programName:
        (programFromDesign && programFromDesign !== 'Program / Course'
          ? programFromDesign
          : null) || 'Diploma in Professional Studies',
      className: 'Morning Cohort',
      certificateNumber: certNoFromDesign || 'CERT-0000042',
      dateIssued: new Date().toISOString(),
      gpa: '3.40',
      verifyCode: 'previewcode12345678',
      verificationUrl: 'https://example.com/verify/previewcode12345678',
      footerText: getCertificateFooterText(brandSource) || undefined,
      leftTitle: getSignatoryLeftTitle(brandSource),
      rightTitle: getSignatoryRightTitle(brandSource),
      leftName: getSignatoryLeftName(brandSource) || undefined,
      rightName: getSignatoryRightName(brandSource) || undefined,
      logoBuilderDesign: design,
    }
  }, [brandSource, institutionName, openSaved, result, resolvedPreviewDesign])

  const start = async (file: File) => {
    const run = ++runRef.current
    setError(null)
    setResult(null)
    setOpenSaved(null)
    setSavedId(null)
    setReferenceFile(file)
    setTemplateName(defaultName(file.name))
    setClassId('')
    setDoneStages([])
    setActiveStage('reading')
    setStageDetail(null)
    try {
      const next = await runCertificateImport(
        file,
        {
          institutionName,
          logoUrl: institutionLogoUrl(brandSource) || null,
          sealUrl: brandSource?.seal_url || null,
          signatureUrl: brandSource?.signature_url || null,
          primary: getInstitutionPrimary(brandSource),
          accent: getInstitutionAccent(brandSource),
          address: String(brandSource?.address || ''),
          email: String(brandSource?.email || ''),
          phone: String(brandSource?.phone || ''),
          website: String(brandSource?.website || ''),
          motto: String(brandSource?.motto || ''),
          leftName: getSignatoryLeftName(brandSource),
          leftTitle: getSignatoryLeftTitle(brandSource),
          rightName: getSignatoryRightName(brandSource),
          rightTitle: getSignatoryRightTitle(brandSource),
          footerText: getCertificateFooterText(brandSource),
        },
        (stage, detail) => {
          if (runRef.current !== run) return
          setActiveStage(stage)
          setStageDetail(detail || null)
          setDoneStages((prev) => {
            const order = ['reading', 'layout', 'typography', 'colors', 'decorations', 'mapping', 'generating']
            const index = order.indexOf(stage)
            return order.slice(0, index) as ImportStageId[]
          })
        },
      )
      if (runRef.current !== run) return
      setDoneStages(['reading', 'layout', 'typography', 'colors', 'decorations', 'mapping', 'generating'])
      setActiveStage(null)
      setResult(next)
    } catch (err) {
      if (runRef.current !== run) return
      setActiveStage(null)
      setReferenceFile(null)
      setError(importErrorMessage(err))
    }
  }

  const save = async () => {
    if (!result && !openSaved) return
    setSaving(true)
    try {
      const design = (result?.design || openSaved?.design)!
      const selectedClass = classes.find((c) => c.id === classId)
      const baseName = templateName.trim() || 'Imported certificate'
      const nameWithClass =
        selectedClass && !baseName.toLowerCase().includes(selectedClass.name.toLowerCase())
          ? `${selectedClass.name} — ${baseName}`.slice(0, 120)
          : baseName

      let row: SavedCertificateImport
      if (openSaved?.id && !result) {
        row = await updateImportedCertificateTemplate({
          id: openSaved.id,
          name: nameWithClass,
          design,
          classId: classId || null,
          warnings: openSaved.warnings,
        })
      } else if (result) {
        row = await saveImportedCertificateTemplate({
          name: nameWithClass,
          sourceFileName: referenceFile?.name || 'certificate',
          sourceKind: result.sourceKind,
          design: result.design,
          summary: result.summary,
          warnings: result.warnings,
          classId: classId || null,
        })
        if (brandSource?.id && row.institutionId && row.institutionId !== brandSource.id) {
          throw new Error('This template was not saved to the current institution.')
        }
      } else {
        throw new Error('Nothing to save')
      }
      setSavedId(row.id)
      setActiveImportedId(row.id)
      setResult(null)
      setOpenSaved(row)
      setTemplateName(row.name)
      setClassId(row.classId || classId || '')
      await loadSaved()
      toast({
        title: `Saved: ${row.name}`,
        description: selectedClass
          ? `“${row.name}” is live for class “${selectedClass.name}”. Generate students from Report Center → Certificates.`
          : `“${row.name}” is live. Generate students from Report Center → Certificates.`,
      })
    } catch (err) {
      toast({ title: 'Save failed', description: saveErrorMessage(err), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const removeSaved = async (id: string) => {
    if (!window.confirm('Delete this imported template?')) return
    try {
      await deleteImportedCertificateTemplate(id)
      if (openSaved?.id === id) setOpenSaved(null)
      if (activeImportedId === id) setActiveImportedId(null)
      await loadSaved()
      toast({ title: 'Deleted', description: 'The certificate template was removed.' })
    } catch (err) {
      toast({ title: 'Delete failed', description: saveErrorMessage(err), variant: 'destructive' })
    }
  }

  const activateSaved = async (item: SavedCertificateImport) => {
    setActivatingId(item.id)
    try {
      const row = await activateImportedCertificateTemplate(item)
      setActiveImportedId(row.id)
      await loadSaved()
      toast({
        title: `Live: ${row.name}`,
        description: row.className
          ? `Students in “${row.className}” will use this template when you generate certificates.`
          : 'This template is now active for student certificate generation.',
      })
    } catch (err) {
      toast({ title: 'Activate failed', description: saveErrorMessage(err), variant: 'destructive' })
    } finally {
      setActivatingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ds-accent,#1F8A5B)]">
          Upload own
        </p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--ds-text-primary,#122018)]">
          Turn a sample certificate into your institution template
        </h2>
        <p className="mt-1 text-sm text-[var(--ds-text-secondary,#5B6B61)]">
          Upload a PDF or DOCX — we auto-rebuild editable blocks with {institutionName} branding.
          Name it, attach a class, save many designs, then generate for students from Report Center.
        </p>
      </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : null}

        {!result && !openSaved ? (
          <div className="space-y-6">
            <CertificateImportDropzone disabled={activeStage != null} onFile={start} />
            {activeStage || doneStages.length ? (
              <CertificateImportProgress active={activeStage} detail={stageDetail} done={doneStages} />
            ) : (
              <p className="text-sm text-[var(--ds-text-secondary,#5B6B61)]">
                Upload a PDF or DOCX certificate. The file is analyzed for page size, typography, colors, and layout, then rebuilt as editable elements for {institutionName}.
              </p>
            )}
          </div>
        ) : null}

        {result && !openSaved ? (
          <CertificateImportReview
            design={result.design}
            summary={result.summary}
            warnings={result.warnings}
            referenceFile={referenceFile}
            referenceTexts={result.referenceTexts}
            preview={preview}
            templateName={templateName}
            onTemplateName={setTemplateName}
            classId={classId}
            onClassId={setClassId}
            classes={classes}
            onDesignChange={(design) => {
              setResult({ ...result, design })
              setSavedId(null)
            }}
            saving={saving}
            saved={Boolean(savedId)}
            onSave={save}
            onDiscardReference={() => setReferenceFile(null)}
            onStartOver={() => {
              runRef.current += 1
              setResult(null)
              setReferenceFile(null)
              setSavedId(null)
              setClassId('')
              setDoneStages([])
              setActiveStage(null)
              setError(null)
            }}
          />
        ) : null}

        {openSaved ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--ds-text-primary,#122018)]">{openSaved.name}</h2>
                <p className="text-sm text-[var(--ds-text-secondary,#5B6B61)]">
                  {openSaved.className
                    ? `Saved for class “${openSaved.className}”. Drag/resize anything, then save again — or import another certificate.`
                    : `Saved for ${institutionName}. Drag/resize anything, then save again — or import another certificate.`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setOpenSaved(null)
                    setResult(null)
                    setSavedId(null)
                    setReferenceFile(null)
                    setClassId('')
                    setTemplateName('')
                    setDoneStages([])
                    setActiveStage(null)
                    setError(null)
                  }}
                >
                  Import another
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setOpenSaved(null)
                    setClassId('')
                  }}
                >
                  Back
                </Button>
              </div>
            </div>
            <CertificateImportReview
              design={openSaved.design}
              summary={{
                sourceKind: openSaved.sourceKind,
                scanned: false,
                pageCount: 1,
                page: {
                  width: openSaved.design.canvas?.width || 794,
                  height: openSaved.design.canvas?.height || 1123,
                  orientation:
                    (openSaved.design.canvas?.width || 794) >= (openSaved.design.canvas?.height || 1123)
                      ? 'landscape'
                      : 'portrait',
                  paperKey: String(openSaved.design.canvas?.paperKey || 'a4'),
                  pageSizeLabel: 'Custom',
                  widthMm: 210,
                  heightMm: 297,
                  marginTop: 40,
                  marginRight: 40,
                  marginBottom: 40,
                  marginLeft: 40,
                },
                colors: {
                  background: '#ffffff',
                  text: '#0f172a',
                  accent: getInstitutionAccent(brandSource),
                  secondary: getInstitutionPrimary(brandSource),
                  border: getInstitutionPrimary(brandSource),
                  fromDocument: false,
                },
                counts: { texts: 0, shapes: 0, elements: (openSaved.design.elements || []).length },
              }}
              warnings={openSaved.warnings}
              referenceFile={null}
              referenceTexts={[]}
              preview={preview}
              templateName={templateName || openSaved.name}
              onTemplateName={setTemplateName}
              classId={classId || openSaved.classId || ''}
              onClassId={setClassId}
              classes={classes}
              onDesignChange={(design) => setOpenSaved({ ...openSaved, design })}
              saving={saving}
              saved={false}
              onSave={save}
              onDiscardReference={() => undefined}
              onStartOver={() => {
                setOpenSaved(null)
                setResult(null)
                setSavedId(null)
                setReferenceFile(null)
                setClassId('')
                setTemplateName('')
                setDoneStages([])
                setActiveStage(null)
                setError(null)
              }}
            />
          </div>
        ) : null}

        <section className="mt-10 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ds-accent,#1F8A5B)]">
                Library
              </p>
              <h2 className="mt-1 text-base font-semibold text-[var(--ds-text-primary,#122018)]">
                Saved certificates
              </h2>
              <p className="mt-1 max-w-xl text-sm text-[var(--ds-text-secondary,#5B6B61)]">
                Name each upload, attach a class, then edit or delete anytime. Use for students makes it
                the live template for Report Center generation.
              </p>
            </div>
            {(result || openSaved) ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  runRef.current += 1
                  setOpenSaved(null)
                  setResult(null)
                  setSavedId(null)
                  setReferenceFile(null)
                  setClassId('')
                  setTemplateName('')
                  setDoneStages([])
                  setActiveStage(null)
                  setError(null)
                }}
              >
                Import another certificate
              </Button>
            ) : null}
          </div>
          <CertificateImportLibrary
            items={saved}
            loading={loadingSaved}
            activeId={activeImportedId}
            activatingId={activatingId}
            institution={brandSource}
            onEdit={(item) => {
              setOpenSaved(item)
              setResult(null)
              setTemplateName(item.name)
              setClassId(item.classId || '')
            }}
            onDelete={(id) => void removeSaved(id)}
            onActivate={(item) => void activateSaved(item)}
          />
        </section>
    </div>
  )
}

export default CertificateImportPanel
