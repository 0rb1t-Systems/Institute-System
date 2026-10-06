import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2, Printer } from 'lucide-react'
import {
  downloadCertificatePDF,
  hydrateCertificateRenderData,
  printCertificatePDF,
} from '@/lib/certificateGenerator'
import { useToast } from '@/hooks/use-toast'
import { notify, MESSAGES } from '@/lib/notify'
import { useAuth } from '@/contexts/AuthContext'
import { getVerificationUrl, resolveDocumentBranding } from '@/lib/institution'
import type { CertificateRenderData } from '@/lib/certificateTemplates'
import CertificateCanvas from '@/components/certificates/CertificateCanvas'

/** Reuse hydrated canvas data when reopening the same certificate in-session. */
const hydratedPreviewCache = new Map<string, CertificateRenderData>()

function previewCacheKey(parts: {
  id?: string
  certificateNumber?: string
  verifyCode?: string
  dateIssued?: string | null
  studentName?: string
  programName?: string
  className?: string
  brandKey?: string
}) {
  return [
    parts.id || '',
    parts.certificateNumber || '',
    parts.verifyCode || '',
    parts.dateIssued || '',
    parts.studentName || '',
    parts.programName || '',
    parts.className || '',
    parts.brandKey || '',
  ].join('|')
}

const CertificatePreview = ({ certificate }) => {
  const { toast } = useToast()
  const [downloading, setDownloading] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [renderData, setRenderData] = useState<CertificateRenderData | null>(null)
  const { institution } = useAuth()
  const brand = resolveDocumentBranding(institution, certificate?.template_snapshot)

  const studentName =
    certificate?.student?.name || certificate?.student?.full_name || 'Student Name'
  const studentId = certificate?.student?.student_code || undefined
  const programName =
    certificate?.diploma?.name ||
    certificate?.course?.name ||
    certificate?.class?.name ||
    certificate?.template_snapshot?.program_name ||
    'Certificate of Completion'
  const className =
    certificate?.class?.name || certificate?.template_snapshot?.class_name || undefined
  const certificateNumber = certificate?.certificate_number || 'N/A'
  const serialNumber = certificate?.serial_number || certificate?.certificate_number || 'N/A'
  const dateIssued = certificate?.date_issued || certificate?.issued_at
  const verifyCode = String(certificate?.verification_code || '').trim()
  const verificationUrl = verifyCode
    ? getVerificationUrl(verifyCode, brand, 'certificate')
    : ''
  const brandKey = [
    brand?.id,
    brand?.name,
    brand?.logo_url,
    brand?.theme_primary,
    brand?.theme_accent,
  ]
    .filter(Boolean)
    .join(':')

  const cacheKey = previewCacheKey({
    id: certificate?.id,
    certificateNumber,
    verifyCode,
    dateIssued: dateIssued ? String(dateIssued) : null,
    studentName,
    programName,
    className,
    brandKey,
  })
  // Synchronous cache hit so reopen paints immediately (useEffect would flash a spinner).
  const cachedRender = certificate ? hydratedPreviewCache.get(cacheKey) || null : null
  const displayRender = cachedRender || renderData

  const buildPayload = () => ({
    institution: brand,
    student: certificate?.student || { name: studentName, student_code: studentId },
    diploma: certificate?.diploma || { name: programName },
    course: certificate?.course,
    class: certificate?.class || (className ? { name: className } : null),
    className,
    certificateNumber,
    dateIssued,
    verifyCode,
    verificationUrl,
    qrData: verificationUrl,
    serialNumber,
    template_snapshot: certificate?.template_snapshot,
    verification_code: verifyCode,
    layoutKey:
      certificate?.template_snapshot?.template?.layout_key ||
      certificate?.template_snapshot?.layout_key,
  })

  useEffect(() => {
    if (!certificate) {
      setRenderData(null)
      return
    }

    if (hydratedPreviewCache.has(cacheKey)) {
      setRenderData(hydratedPreviewCache.get(cacheKey) || null)
      return
    }

    let cancelled = false
    // Do not paint an incomplete first frame (default layout) then swap after hydrate —
    // that was the blink. Wait for a single hydrated result.
    setRenderData(null)

    ;(async () => {
      const hydrated = await hydrateCertificateRenderData(buildPayload())
      if (cancelled) return
      hydratedPreviewCache.set(cacheKey, hydrated)
      setRenderData(hydrated)
    })()

    return () => {
      cancelled = true
    }
    // Primitive deps only — object identity from refetch must not re-trigger hydrate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cacheKey,
    certificate?.id,
    studentName,
    studentId,
    programName,
    className,
    certificateNumber,
    verifyCode,
    verificationUrl,
    dateIssued,
    brandKey,
    certificate?.template_snapshot?.template?.layout_key ||
      certificate?.template_snapshot?.layout_key ||
      '',
  ])

  const handleDownload = async () => {
    if (!certificate) return
    if (!verifyCode) {
      toast({
        title: 'Cannot download',
        description: 'Certificate has no verification code yet.',
        variant: 'destructive',
      })
      return
    }
    setDownloading(true)
    try {
      await downloadCertificatePDF(buildPayload())
      toast({
        title: 'Download successful',
        description: 'Full certificate PDF downloaded.',
      })
    } catch (error) {
      notify.error(error, {
        context: 'CertificatePreview - download',
        fallback: { title: 'Download failed', description: MESSAGES.DOMAIN.CERTIFICATE_DOWNLOAD },
      })
    } finally {
      setDownloading(false)
    }
  }

  const handlePrint = async () => {
    if (!certificate) return
    if (!verifyCode) {
      toast({
        title: 'Cannot print',
        description: 'Certificate has no verification code yet.',
        variant: 'destructive',
      })
      return
    }
    setPrinting(true)
    try {
      // Prints the full certificate PDF only — no preview UI / buttons / metadata
      await printCertificatePDF(buildPayload())
    } catch (error) {
      notify.error(error, {
        context: 'CertificatePreview - print',
        fallback: { title: 'Print failed', description: 'Could not prepare the certificate for printing.' },
      })
    } finally {
      setPrinting(false)
    }
  }

  if (!certificate) {
    return (
      <div className="w-full aspect-[210/297] bg-white flex items-center justify-center rounded-lg border-2 border-slate-200">
        <p className="text-slate-500">No certificate data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div id="printable-certificate" className="cert-print-sheet bg-white">
        {displayRender ? (
          <CertificateCanvas data={displayRender} />
        ) : (
          <div className="w-full aspect-[210/297] bg-white flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        )}
      </div>

      <div className="flex gap-3 justify-center print-hide">
        <Button onClick={handlePrint} variant="outline" size="lg" disabled={printing || !verifyCode}>
          {printing ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Preparing…
            </>
          ) : (
            <>
              <Printer className="h-5 w-5 mr-2" />
              Print Certificate
            </>
          )}
        </Button>
        <Button onClick={handleDownload} disabled={downloading || !verifyCode} size="lg">
          {downloading ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Downloading...
            </>
          ) : (
            <>
              <Download className="h-5 w-5 mr-2" />
              Download PDF
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

export default CertificatePreview
