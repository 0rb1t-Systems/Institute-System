/**
 * Built-in Invoice Template Library (catalog only).
 * Active selection is stored per institution on document_templates.layout_key
 * for document_type = 'invoice'. Branding always comes from Institution Settings.
 */

export const INVOICE_LAYOUT_KEYS = [
  'classic',
  'modern',
  'stripe',
  'formal',
  'minimal',
  'statement',
  'branded',
  'bordered',
] as const

export const INVOICE_ALL_LAYOUT_KEYS = [
  ...INVOICE_LAYOUT_KEYS,
  'custom_upload',
  'logo_builder',
] as const

export type InvoiceLayoutKey = (typeof INVOICE_ALL_LAYOUT_KEYS)[number]

export type InvoiceTemplateMeta = {
  key: (typeof INVOICE_LAYOUT_KEYS)[number]
  name: string
  category: string
  description: string
  accentHint: string
}

export function isCustomInvoiceLayout(raw?: string | null): boolean {
  const key = String(raw || '')
    .trim()
    .toLowerCase()
  return key === 'logo_builder' || key === 'custom_upload'
}

export function normalizeInvoiceLayoutKey(raw?: string | null): InvoiceLayoutKey {
  const key = String(raw || '')
    .trim()
    .toLowerCase()
  if (key === 'default' || !key) return 'classic'
  if ((INVOICE_ALL_LAYOUT_KEYS as readonly string[]).includes(key)) {
    return key as InvoiceLayoutKey
  }
  return 'classic'
}

export function libraryInvoiceLayoutKey(raw?: string | null): (typeof INVOICE_LAYOUT_KEYS)[number] {
  const key = normalizeInvoiceLayoutKey(raw)
  if (isCustomInvoiceLayout(key)) return 'classic'
  return key as (typeof INVOICE_LAYOUT_KEYS)[number]
}

export function isValidInvoiceLayoutKey(raw?: string | null): boolean {
  const key = String(raw || '')
    .trim()
    .toLowerCase()
  return key === 'default' || (INVOICE_ALL_LAYOUT_KEYS as readonly string[]).includes(key)
}

export const INVOICE_TEMPLATE_LIBRARY: InvoiceTemplateMeta[] = [
  {
    key: 'classic',
    name: 'Classic',
    category: 'Classic',
    description: 'Traditional invoice with clear bill-to block and clean fee table.',
    accentHint: '#111827',
  },
  {
    key: 'modern',
    name: 'Modern',
    category: 'Modern',
    description: 'Colored header band using your institution primary color.',
    accentHint: '#0EA5E9',
  },
  {
    key: 'stripe',
    name: 'Stripe',
    category: 'Modern',
    description: 'Left accent rail with focused totals and soft section cards.',
    accentHint: '#4F46E5',
  },
  {
    key: 'formal',
    name: 'Formal',
    category: 'Formal',
    description: 'Double-frame margins for official billing documents.',
    accentHint: '#0F172A',
  },
  {
    key: 'minimal',
    name: 'Minimal',
    category: 'Minimal',
    description: 'Quiet typography and light rules for a simple statement.',
    accentHint: '#64748B',
  },
  {
    key: 'statement',
    name: 'Statement',
    category: 'Finance',
    description: 'Dense statement-style layout with strong totals emphasis.',
    accentHint: '#059669',
  },
  {
    key: 'branded',
    name: 'Branded',
    category: 'Brand',
    description: 'Full-width brand header with white invoice title block.',
    accentHint: '#0066CC',
  },
  {
    key: 'bordered',
    name: 'Bordered',
    category: 'Formal',
    description: 'Outer border with accent corner marks for print-ready invoices.',
    accentHint: '#9F1239',
  },
]

export type InvoiceLineItem = {
  description: string
  amountLabel: string
}

export type InvoicePaymentRow = {
  id?: string
  dateLabel: string
  note: string
  amountLabel: string
}

export type InvoiceRenderData = {
  layoutKey: InvoiceLayoutKey
  institutionName: string
  primary: string
  motto?: string | null
  contactLine?: string
  logoUrl?: string | null
  showLogo?: boolean
  showContact?: boolean
  invoiceNumber: string
  invoiceDate: string
  studentName: string
  studentCode: string
  studentEmail?: string
  studentPhone?: string
  className: string
  monthlyFeeLabel: string
  lineItems: InvoiceLineItem[]
  totalDueLabel: string
  payments: InvoicePaymentRow[]
  footerText?: string
}

export type InvoiceLayoutChrome = {
  pageExtra: string
  outerFrame: string
  headerMode: 'standard' | 'band' | 'branded' | 'stripe'
  headerBorder: string
  sectionLabel: string
  tableHead: string
  tableRow: string
  historyBox: string
  totalColorUsesPrimary: boolean
}

/** Shared layout chrome for live invoice + library preview. */
export function getInvoiceLayoutChrome(layoutKey: InvoiceLayoutKey): InvoiceLayoutChrome {
  switch (layoutKey) {
    case 'modern':
      return {
        pageExtra: '',
        outerFrame: '',
        headerMode: 'band',
        headerBorder: '',
        sectionLabel: 'text-[10px] font-bold uppercase tracking-wider text-slate-500',
        tableHead: 'border-b-2 border-slate-200',
        tableRow: 'border-b border-slate-100',
        historyBox: 'bg-slate-50 rounded-lg border border-slate-100',
        totalColorUsesPrimary: true,
      }
    case 'stripe':
      return {
        pageExtra: 'pl-3',
        outerFrame: '',
        headerMode: 'stripe',
        headerBorder: 'border-b border-slate-200',
        sectionLabel: 'text-[10px] font-bold uppercase tracking-wider text-slate-500',
        tableHead: 'border-b border-slate-200',
        tableRow: 'border-b border-slate-50',
        historyBox: 'bg-indigo-50/40 rounded-md border border-indigo-100',
        totalColorUsesPrimary: true,
      }
    case 'formal':
      return {
        pageExtra: 'p-3',
        outerFrame: 'outline outline-2 outline-black outline-offset-[-10px]',
        headerMode: 'standard',
        headerBorder: 'border-b-2 border-double border-black',
        sectionLabel: 'text-[10px] font-bold uppercase tracking-wider text-black',
        tableHead: 'border-b-2 border-black',
        tableRow: 'border-b border-black/20',
        historyBox: 'border-2 border-black bg-white',
        totalColorUsesPrimary: false,
      }
    case 'minimal':
      return {
        pageExtra: '',
        outerFrame: '',
        headerMode: 'standard',
        headerBorder: 'border-b border-slate-200',
        sectionLabel: 'text-[10px] font-medium uppercase tracking-widest text-slate-400',
        tableHead: 'border-b border-slate-200',
        tableRow: 'border-b border-slate-100',
        historyBox: 'bg-transparent border-t border-slate-200 pt-3',
        totalColorUsesPrimary: true,
      }
    case 'statement':
      return {
        pageExtra: '',
        outerFrame: '',
        headerMode: 'standard',
        headerBorder: 'border-b-2 border-emerald-800',
        sectionLabel: 'text-[10px] font-bold uppercase tracking-wider text-emerald-800',
        tableHead: 'border-b-2 border-emerald-800 bg-emerald-50/50',
        tableRow: 'border-b border-emerald-100',
        historyBox: 'border border-emerald-200 bg-emerald-50/30',
        totalColorUsesPrimary: false,
      }
    case 'branded':
      return {
        pageExtra: '',
        outerFrame: '',
        headerMode: 'branded',
        headerBorder: '',
        sectionLabel: 'text-[10px] font-bold uppercase tracking-wider text-slate-500',
        tableHead: 'border-b-2 border-slate-200',
        tableRow: 'border-b border-slate-100',
        historyBox: 'bg-slate-50 rounded-lg',
        totalColorUsesPrimary: true,
      }
    case 'bordered':
      return {
        pageExtra: 'p-4',
        outerFrame: 'ring-2 ring-black ring-inset',
        headerMode: 'standard',
        headerBorder: 'border-b-4 border-black',
        sectionLabel: 'text-[10px] font-bold uppercase tracking-wider text-black',
        tableHead: 'border-b-2 border-black',
        tableRow: 'border-b border-slate-300',
        historyBox: 'border border-black bg-slate-50',
        totalColorUsesPrimary: false,
      }
    case 'classic':
    default:
      return {
        pageExtra: '',
        outerFrame: '',
        headerMode: 'standard',
        headerBorder: 'border-b border-slate-200',
        sectionLabel: 'text-[10px] font-bold uppercase tracking-wider text-slate-400',
        tableHead: 'border-b-2 border-slate-100',
        tableRow: 'border-b border-slate-50',
        historyBox: 'bg-slate-50 rounded-lg',
        totalColorUsesPrimary: true,
      }
  }
}
