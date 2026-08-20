import React, { useEffect, useMemo, useState } from 'react'

import { Card } from '@/components/ui/card'

import { Button } from '@/components/ui/button'

import { Printer, Download, Edit, Loader2 } from 'lucide-react'

import { formatCurrency, formatDate } from '@/lib/utils'

import { useAuth } from '@/contexts/AuthContext'

import {

  getInstitutionDisplayName,

  getInstitutionContactLine,

  getTenantBaseUrl,

  getInstitutionPrimary,

  getRegistrationFeeAmount,

  getInvoiceFooterText,

  getSignatoryLeftName,

  getSignatoryLeftTitle,

  getSignatoryRightName,

  getSignatoryRightTitle,

} from '@/lib/institution'

import { computeMonthlyFee } from '@/lib/finance'

import { getDocumentTemplate } from '@/lib/api'

import {

  normalizeInvoiceLayoutKey,

  libraryInvoiceLayoutKey,

  isCustomInvoiceLayout,

  type InvoiceLayoutKey,

  type InvoiceRenderData,

} from '@/lib/invoiceTemplates'

import {

  hydrateDocumentDesignFromTemplate,

  type HydratedDocumentDesign,

} from '@/lib/documentDesign'

import {

  downloadDesignPDF,

  printDesignPDF,

  downloadDomPagesPdf,

} from '@/lib/documentPdf'

import InvoiceCanvas from '@/components/finance/InvoiceCanvas'

import CertificateDesignRenderer from '@/components/certificates/CertificateDesignRenderer'

import type { CertificateRenderData } from '@/lib/certificateTemplates'



const InvoiceView = ({ student, payments, enrollment, activeClass, onEditPayment }) => {

  const { institution } = useAuth()

  const institutionName = getInstitutionDisplayName(institution)

  const contactLine = getInstitutionContactLine(institution)

  const hostLabel = getTenantBaseUrl(institution).replace(/^https?:\/\//, '')

  const primary = getInstitutionPrimary(institution)

  const registrationFee = getRegistrationFeeAmount(institution)

  const footerText = getInvoiceFooterText(institution)



  const [isDownloading, setIsDownloading] = useState(false)

  const [layoutKey, setLayoutKey] = useState<InvoiceLayoutKey>('classic')

  const [showLogo, setShowLogo] = useState(true)

  const [showContact, setShowContact] = useState(true)

  const [customDesign, setCustomDesign] = useState<HydratedDocumentDesign | null>(null)



  useEffect(() => {

    let cancelled = false

    ;(async () => {

      try {

        const tpl = await getDocumentTemplate('invoice')

        if (cancelled) return

        const key = normalizeInvoiceLayoutKey(tpl?.layout_key)

        setLayoutKey(key)

        const cfg = tpl?.config || {}

        setShowLogo(cfg.show_logo !== false)

        setShowContact(cfg.show_contact !== false)

        if (isCustomInvoiceLayout(key)) {

          const hydrated = await hydrateDocumentDesignFromTemplate(tpl, 'invoice')

          if (!cancelled) setCustomDesign(hydrated)

        } else {

          setCustomDesign(null)

        }

      } catch {

        if (!cancelled) {

          setLayoutKey('classic')

          setCustomDesign(null)

        }

      }

    })()

    return () => {

      cancelled = true

    }

  }, [institution?.id])



  const today = useMemo(() => new Date(), [])

  const invoiceNumber = `INV-${student.student_code}-${today.getFullYear()}${today.getMonth() + 1}`



  const sortedPayments = useMemo(

    () =>

      [...(payments || [])].sort(

        (a, b) => Number(new Date(b.payment_date)) - Number(new Date(a.payment_date))

      ),

    [payments]

  )



  const monthlyFee = computeMonthlyFee(activeClass, enrollment)

  const isRegPaid = sortedPayments.some(

    (p) => p.is_registration_fee === true && (p.status === 'completed' || !p.status)

  )

  const totalDue = (!isRegPaid ? registrationFee : 0) + monthlyFee

  const amountPaid = sortedPayments

    .filter((p) => p.status === 'completed' || !p.status)

    .reduce((sum, p) => sum + Number(p.amount || 0), 0)

  const balance = Math.max(0, totalDue - amountPaid)

  const monthLabel = today.toLocaleString('default', { month: 'long', year: 'numeric' })

  const invoiceDateLabel = formatDate(today)

  const useCustomLayout = isCustomInvoiceLayout(layoutKey)



  const lineItemsSummary = useMemo(() => {

    const lines: string[] = []

    if (!isRegPaid) {

      lines.push(`Registration Fee (One-Time)    ${formatCurrency(registrationFee)}`)

    }

    lines.push(`Tuition Fee - ${monthLabel}    ${formatCurrency(monthlyFee)}`)

    return lines.join('\n')

  }, [isRegPaid, registrationFee, monthLabel, monthlyFee])



  const renderData: InvoiceRenderData = useMemo(() => {

    const lineItems = []

    if (!isRegPaid) {

      lineItems.push({

        description: 'Registration Fee (One-Time)',

        amountLabel: formatCurrency(registrationFee),

      })

    }

    lineItems.push({

      description: `Tuition Fee - ${monthLabel}`,

      amountLabel: formatCurrency(monthlyFee),

    })



    return {

      layoutKey: libraryInvoiceLayoutKey(layoutKey),

      institutionName,

      primary,

      motto: institution?.motto || null,

      contactLine: contactLine || hostLabel,

      logoUrl: institution?.logo_url,

      showLogo,

      showContact,

      invoiceNumber,

      invoiceDate: invoiceDateLabel,

      studentName: student.name,

      studentCode: student.student_code,

      studentEmail: student.email,

      studentPhone: student.phone || 'No Phone',

      className: activeClass?.name || 'No Active Class',

      monthlyFeeLabel: formatCurrency(monthlyFee),

      lineItems,

      totalDueLabel: formatCurrency(totalDue),

      payments: sortedPayments.map((p) => ({

        id: p.id,

        dateLabel: formatDate(p.payment_date),

        note: `${p.notes || (p.is_registration_fee ? 'Registration Fee' : 'Tuition Payment')} (${p.method})`,

        amountLabel: formatCurrency(p.amount),

      })),

      footerText: footerText || undefined,

    }

  }, [

    layoutKey,

    institutionName,

    primary,

    institution?.motto,

    institution?.logo_url,

    contactLine,

    hostLabel,

    showLogo,

    showContact,

    invoiceNumber,

    invoiceDateLabel,

    student.name,

    student.student_code,

    student.email,

    student.phone,

    activeClass?.name,

    monthlyFee,

    registrationFee,

    isRegPaid,

    totalDue,

    sortedPayments,

    footerText,

    monthLabel,

  ])



  const customRenderData: CertificateRenderData | null = useMemo(() => {

    if (!useCustomLayout) return null

    return {

      layoutKey: layoutKey === 'custom_upload' ? 'custom_upload' : 'logo_builder',

      institutionName,

      primary,

      motto: institution?.motto || undefined,

      logoUrl: institution?.logo_url,

      sealUrl: institution?.seal_url,

      signatureUrl: institution?.signature_url,

      leftTitle: getSignatoryLeftTitle(institution),

      rightTitle: getSignatoryRightTitle(institution),

      leftName: getSignatoryLeftName(institution) || undefined,

      rightName: getSignatoryRightName(institution) || undefined,

      footerText: footerText || undefined,

      studentName: student.name,

      studentId: student.student_code,

      programName: activeClass?.name || 'Tuition & fees',

      className: activeClass?.name || 'No Active Class',

      certificateNumber: invoiceNumber,

      dateIssued: invoiceDateLabel,

      invoiceNumber,

      totalDue: formatCurrency(totalDue),

      amountPaid: formatCurrency(amountPaid),

      balance: formatCurrency(balance),

      lineItemsSummary,

      logoBuilderDesign: customDesign?.logoBuilderDesign || null,

      customBackgroundUrl: customDesign?.customBackgroundUrl || null,

      customAspectRatio: customDesign?.customAspectRatio ?? null,

      customFieldLayout: customDesign?.customFieldLayout || null,
      customPaperLayers: customDesign?.customPaperLayers || null,

    }

  }, [

    useCustomLayout,

    layoutKey,

    institutionName,

    primary,

    institution,

    footerText,

    student.name,

    student.student_code,

    activeClass?.name,

    invoiceNumber,

    invoiceDateLabel,

    totalDue,

    amountPaid,

    balance,

    lineItemsSummary,

    customDesign,

  ])



  const handleDownloadPDF = async () => {

    setIsDownloading(true)

    try {

      if (useCustomLayout && customRenderData) {

        await downloadDesignPDF(customRenderData, `Invoice_${invoiceNumber}.pdf`, institution)

        return

      }

      const element = document.getElementById('printable-invoice')

      if (!element) return

      await downloadDomPagesPdf([element], `Invoice_${invoiceNumber}.pdf`)

    } catch (err) {

      console.error('PDF generation failed', err)

    } finally {

      setIsDownloading(false)

    }

  }



  const handlePrint = async () => {

    try {

      if (useCustomLayout && customRenderData) {

        setIsDownloading(true)

        await printDesignPDF(customRenderData, institution)

        return

      }

      window.print()

    } catch (err) {

      console.error('Print failed', err)

      window.print()

    } finally {

      setIsDownloading(false)

    }

  }



  return (

    <div className="max-h-[80vh] overflow-y-auto p-1">

      <Card className="bg-transparent border-0 shadow-none max-w-[800px] mx-auto overflow-hidden">

        {useCustomLayout && customRenderData ? (

          <div id="printable-invoice" className="bg-white shadow-lg rounded-lg overflow-hidden">

            <CertificateDesignRenderer

              data={customRenderData}

              design={customRenderData.logoBuilderDesign}

              backgroundUrl={customRenderData.customBackgroundUrl}

              composeUpload={layoutKey === 'custom_upload'}

            />

          </div>

        ) : (

          <InvoiceCanvas id="printable-invoice" data={renderData} className="shadow-lg" />

        )}

      </Card>



      {onEditPayment && sortedPayments.length > 0 ? (

        <div className="max-w-[800px] mx-auto mt-4 print:hidden rounded-lg border border-slate-800 bg-slate-950/60 p-3">

          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">

            Edit payments

          </h4>

          <div className="space-y-1">

            {sortedPayments.map((p) => (

              <div

                key={p.id}

                className="flex items-center justify-between gap-2 text-sm text-slate-300 py-1"

              >

                <span className="truncate">

                  {formatDate(p.payment_date)} · {formatCurrency(p.amount)}

                </span>

                <Button

                  variant="ghost"

                  size="icon"

                  className="h-7 w-7 shrink-0"

                  onClick={() => onEditPayment(p)}

                  title="Edit Payment"

                >

                  <Edit className="h-3.5 w-3.5 text-sky-400" />

                </Button>

              </div>

            ))}

          </div>

        </div>

      ) : null}



      <div className="flex justify-center gap-4 mt-6 print:hidden">

        <Button variant="outline" onClick={handlePrint} disabled={isDownloading}>

          <Printer className="mr-2 h-4 w-4" /> Print Invoice

        </Button>

        <Button onClick={handleDownloadPDF} disabled={isDownloading}>

          {isDownloading ? (

            <Loader2 className="mr-2 h-4 w-4 animate-spin" />

          ) : (

            <Download className="mr-2 h-4 w-4" />

          )}

          Download PDF

        </Button>

      </div>

    </div>

  )

}



export default InvoiceView


