import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, Receipt } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getDocumentTemplate, setActiveInvoiceTemplate } from '@/lib/api'
import {
  INVOICE_TEMPLATE_LIBRARY,
  normalizeInvoiceLayoutKey,
  isCustomInvoiceLayout,
  libraryInvoiceLayoutKey,
  type InvoiceLayoutKey,
  type InvoiceRenderData,
} from '@/lib/invoiceTemplates'
import {
  getInstitutionDisplayName,
  getInstitutionPrimary,
  getInstitutionContactLine,
  getInvoiceFooterText,
} from '@/lib/institution'
import InvoiceCanvas from '@/components/finance/InvoiceCanvas'
import { useToast } from '@/components/ui/use-toast'
import { getUserMessage } from '@/lib/mapError'
import { MESSAGES } from '@/lib/messages'
import { formatCurrency, formatDate } from '@/lib/utils'

/**
 * Invoice Template Library — embedded in Institution Settings.
 * Selects active layout only; branding always from Institution Settings.
 */
const InvoiceTemplateLibrary = () => {
  const { institution } = useAuth()
  const { toast } = useToast()
  const [activeKey, setActiveKey] = useState<InvoiceLayoutKey>('classic')
  const [previewKey, setPreviewKey] = useState<InvoiceLayoutKey>('classic')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const tpl = await getDocumentTemplate('invoice')
        const key = normalizeInvoiceLayoutKey(tpl?.layout_key)
        if (!cancelled) {
          setActiveKey(key)
          setPreviewKey(libraryInvoiceLayoutKey(key))
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

  const sampleData: InvoiceRenderData = useMemo(() => {
    const today = new Date()
    return {
      layoutKey: libraryInvoiceLayoutKey(previewKey),
      institutionName: getInstitutionDisplayName(institution),
      primary: getInstitutionPrimary(institution),
      motto: institution?.motto || 'Excellence in Professional Education',
      contactLine: getInstitutionContactLine(institution) || undefined,
      logoUrl: institution?.logo_url,
      showLogo: true,
      showContact: true,
      invoiceNumber: 'INV-STU-2026-001',
      invoiceDate: formatDate(today),
      studentName: 'Amina Hassan',
      studentCode: 'STU-2026-001',
      studentEmail: 'amina@example.com',
      studentPhone: '+252 61 0000000',
      className: 'Diploma in Professional Studies',
      monthlyFeeLabel: formatCurrency(150),
      lineItems: [
        { description: 'Registration Fee (One-Time)', amountLabel: formatCurrency(25) },
        {
          description: `Tuition Fee - ${today.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
          amountLabel: formatCurrency(150),
        },
      ],
      totalDueLabel: formatCurrency(175),
      payments: [
        {
          id: 'sample-1',
          dateLabel: formatDate(new Date(today.getTime() - 86400000 * 14)),
          note: 'Tuition Payment (mobile_money)',
          amountLabel: formatCurrency(150),
        },
      ],
      footerText: getInvoiceFooterText(institution) || undefined,
    }
  }, [institution, previewKey])

  const handleActivate = async (key: InvoiceLayoutKey) => {
    setSaving(true)
    try {
      const row = await setActiveInvoiceTemplate(key)
      const next = normalizeInvoiceLayoutKey(row?.layout_key || key)
      setActiveKey(next)
      setPreviewKey(libraryInvoiceLayoutKey(next))
      toast({
        title: 'Template activated',
        description: `${INVOICE_TEMPLATE_LIBRARY.find((t) => t.key === libraryInvoiceLayoutKey(next))?.name || next} is now your active invoice design.`,
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
          <Receipt className="h-5 w-5 text-emerald-400" />
          <div>
            <CardTitle className="text-white text-base">Invoice Template Library</CardTitle>
            <CardDescription>
              Preview professional invoice designs and choose one active template. Your institution branding is applied
              automatically.
              {isCustomInvoiceLayout(activeKey) ? (
                <span className="block mt-1 text-amber-300/90">
                  Active mode: {activeKey === 'logo_builder' ? 'Page Builder' : 'Upload Own'} — select a library
                  template below to switch back.
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
              {INVOICE_TEMPLATE_LIBRARY.map((tpl) => {
                const isActive = tpl.key === activeKey
                const isPreview = tpl.key === previewKey
                return (
                  <button
                    key={tpl.key}
                    type="button"
                    onClick={() => setPreviewKey(tpl.key)}
                    className={`text-left rounded-lg border p-3 transition ${
                      isPreview
                        ? 'border-emerald-500 bg-slate-950 ring-1 ring-emerald-500/40'
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
                      <InvoiceCanvas compact data={{ ...sampleData, layoutKey: tpl.key }} />
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
                    {INVOICE_TEMPLATE_LIBRARY.find((t) => t.key === previewKey)?.name}
                  </span>
                </p>
                <Button
                  type="button"
                  size="sm"
                  disabled={saving || previewKey === activeKey}
                  onClick={() => handleActivate(previewKey)}
                  className="bg-emerald-600 hover:bg-emerald-500"
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
              <div className="max-w-md mx-auto bg-white rounded overflow-hidden shadow-sm">
                <InvoiceCanvas data={sampleData} />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default InvoiceTemplateLibrary
