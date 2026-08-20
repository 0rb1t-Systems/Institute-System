import React from 'react'
import {
  getInvoiceLayoutChrome,
  type InvoiceRenderData,
} from '@/lib/invoiceTemplates'

type Props = {
  data: InvoiceRenderData
  compact?: boolean
  className?: string
  id?: string
}

/**
 * Shared invoice layout renderer for live invoices + template library previews.
 */
const InvoiceCanvas = ({ data, compact = false, className = '', id }: Props) => {
  const chrome = getInvoiceLayoutChrome(data.layoutKey)
  const primary = data.primary || '#111827'
  const showLogo = data.showLogo !== false
  const showContact = data.showContact !== false
  const scale = compact ? 'text-[5px] leading-tight' : 'text-sm'
  const titleSize = compact ? 'text-[8px]' : 'text-3xl'
  const nameSize = compact ? 'text-[7px]' : 'text-2xl'
  const hasLogo = showLogo && Boolean(String(data.logoUrl || '').trim())
  const brandName = hasLogo ? '' : data.institutionName || ''

  const logo = hasLogo ? (
    <img
      src={data.logoUrl!}
      alt=""
      className={`${compact ? 'h-5' : 'h-12'} w-auto object-contain`}
    />
  ) : null

  const motto = data.motto ? (
    <div className={`${compact ? 'text-[4px]' : 'text-sm'} text-slate-500 italic`}>{data.motto}</div>
  ) : null

  const contact = showContact && data.contactLine ? (
    <div className={`${compact ? 'text-[4px] mt-0.5' : 'text-sm mt-2'} text-slate-500`}>{data.contactLine}</div>
  ) : null

  const headerStandard = (
    <div className={`flex justify-between items-start ${compact ? 'mb-2' : 'mb-8'} ${chrome.headerBorder}`}>
      <div>
        <div className={`flex items-start ${compact ? 'gap-1 mb-0.5' : 'gap-3 mb-1'}`}>
          {logo}
          {brandName || motto ? (
            <div>
              {brandName ? (
                <div className={`${nameSize} font-bold uppercase`} style={{ color: primary }}>
                  {brandName}
                </div>
              ) : null}
              {motto}
            </div>
          ) : null}
        </div>
        {contact}
      </div>
      <div className="text-right">
        <h2 className={`${titleSize} font-bold text-slate-200 ${compact ? 'mb-0.5' : 'mb-2'}`}>INVOICE</h2>
        <div className={`${compact ? 'text-[4px]' : 'text-sm'} font-medium text-slate-600`}>
          Invoice #: {data.invoiceNumber}
        </div>
        <div className={`${compact ? 'text-[4px]' : 'text-sm'} text-slate-500`}>Date: {data.invoiceDate}</div>
      </div>
    </div>
  )

  const headerBand = (
    <div className={compact ? 'mb-2' : 'mb-8'}>
      <div
        className={`flex justify-between items-start text-white ${compact ? 'px-2 py-1.5' : 'px-5 py-4'} rounded-t`}
        style={{ backgroundColor: primary }}
      >
        <div className="flex items-start gap-2 min-w-0">
          {logo}
          {brandName || data.motto ? (
            <div className="min-w-0">
              {brandName ? (
                <div className={`${nameSize} font-bold uppercase truncate`}>{brandName}</div>
              ) : null}
              {data.motto ? (
                <div className={`${compact ? 'text-[4px]' : 'text-sm'} text-white/80 italic`}>{data.motto}</div>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="text-right shrink-0">
          <div className={`${titleSize} font-bold leading-none`}>INVOICE</div>
        </div>
      </div>
      <div
        className={`flex justify-between ${compact ? 'px-2 py-1 text-[4px]' : 'px-5 py-2 text-sm'} bg-slate-50 border-b border-slate-200`}
      >
        <span className="text-slate-600">{showContact ? data.contactLine : ''}</span>
        <span className="text-slate-700 font-medium">
          #{data.invoiceNumber} · {data.invoiceDate}
        </span>
      </div>
    </div>
  )

  const headerBranded = (
    <div className={compact ? 'mb-2' : 'mb-8'}>
      <div className="text-white" style={{ backgroundColor: primary }}>
        <div className={`flex justify-between items-center ${compact ? 'px-2 py-2' : 'px-6 py-5'}`}>
          <div className="flex items-center gap-3 min-w-0">
            {logo}
            {brandName || (showContact && data.contactLine) ? (
              <div className="min-w-0">
                {brandName ? (
                  <div className={`${nameSize} font-black uppercase truncate`}>{brandName}</div>
                ) : null}
                {contact ? <div className="text-white/80">{data.contactLine}</div> : null}
              </div>
            ) : null}
          </div>
          <div className={`${titleSize} font-black tracking-wide`}>INVOICE</div>
        </div>
        <div
          className={`flex justify-between bg-black/15 ${compact ? 'px-2 py-1 text-[4px]' : 'px-6 py-2 text-sm'}`}
        >
          <span>Invoice #: {data.invoiceNumber}</span>
          <span>{data.invoiceDate}</span>
        </div>
      </div>
    </div>
  )

  const headerStripe = (
    <div className={`relative ${compact ? 'mb-2' : 'mb-8'}`}>
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 rounded-full"
        style={{ backgroundColor: primary }}
      />
      <div className={`flex justify-between items-start ${chrome.headerBorder} ${compact ? 'pl-2 pb-1' : 'pl-4 pb-4'}`}>
        <div>
          <div className={`flex items-start ${compact ? 'gap-1' : 'gap-3'}`}>
            {logo}
            {brandName || motto || contact ? (
              <div>
                {brandName ? (
                  <div className={`${nameSize} font-bold uppercase`} style={{ color: primary }}>
                    {brandName}
                  </div>
                ) : null}
                {motto}
                {contact}
              </div>
            ) : null}
          </div>
        </div>
        <div className="text-right">
          <div
            className={`${compact ? 'text-[6px] px-1.5 py-0.5' : 'text-lg px-3 py-1'} font-bold text-white inline-block rounded`}
            style={{ backgroundColor: primary }}
          >
            INVOICE
          </div>
          <div className={`${compact ? 'text-[4px] mt-0.5' : 'text-sm mt-2'} text-slate-600`}>
            #{data.invoiceNumber}
          </div>
          <div className={`${compact ? 'text-[4px]' : 'text-sm'} text-slate-500`}>{data.invoiceDate}</div>
        </div>
      </div>
    </div>
  )

  let header = headerStandard
  if (chrome.headerMode === 'band') header = headerBand
  else if (chrome.headerMode === 'branded') header = headerBranded
  else if (chrome.headerMode === 'stripe') header = headerStripe

  const totalColor =
    chrome.totalColorUsesPrimary
      ? primary
      : data.layoutKey === 'statement'
        ? '#065F46'
        : '#0F172A'

  const cornerMarks =
    data.layoutKey === 'bordered' && !compact ? (
      <>
        <span className="absolute top-2 left-2 h-3 w-3 border-t-2 border-l-2 border-black" />
        <span className="absolute top-2 right-2 h-3 w-3 border-t-2 border-r-2 border-black" />
        <span className="absolute bottom-2 left-2 h-3 w-3 border-b-2 border-l-2 border-black" />
        <span className="absolute bottom-2 right-2 h-3 w-3 border-b-2 border-r-2 border-black" />
      </>
    ) : null

  return (
    <div
      id={id}
      className={`relative bg-white text-slate-900 overflow-hidden ${chrome.outerFrame} ${chrome.pageExtra} ${scale} ${className}`}
      style={compact ? { aspectRatio: '210 / 297' } : undefined}
    >
      {cornerMarks}
      <div className={compact ? 'p-2' : 'p-8'}>
        {header}

        <div className={`grid grid-cols-2 ${compact ? 'gap-2 mb-2' : 'gap-8 mb-8'}`}>
          <div>
            <h3 className={`${chrome.sectionLabel} ${compact ? 'mb-0.5' : 'mb-2'}`}>Bill To</h3>
            <div className={`font-bold ${compact ? 'text-[6px]' : 'text-lg'}`}>{data.studentName}</div>
            <div className="text-slate-600">{data.studentCode}</div>
            {data.studentEmail ? <div className="text-slate-600">{data.studentEmail}</div> : null}
            {data.studentPhone ? <div className="text-slate-600">{data.studentPhone}</div> : null}
          </div>
          <div className="text-right">
            <h3 className={`${chrome.sectionLabel} ${compact ? 'mb-0.5' : 'mb-2'}`}>Course Details</h3>
            <div className={`font-bold ${compact ? 'text-[6px]' : ''}`}>{data.className}</div>
            <div className="text-slate-600">Monthly Fee: {data.monthlyFeeLabel}</div>
          </div>
        </div>

        <table className={`w-full ${compact ? 'mb-2' : 'mb-8'}`}>
          <thead>
            <tr className={chrome.tableHead}>
              <th className={`text-left ${compact ? 'py-0.5' : 'py-3'} font-bold text-slate-500`}>Description</th>
              <th className={`text-right ${compact ? 'py-0.5' : 'py-3'} font-bold text-slate-500`}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.lineItems.map((item, i) => (
              <tr key={`${item.description}-${i}`} className={chrome.tableRow}>
                <td className={`${compact ? 'py-0.5' : 'py-3'} text-slate-700`}>{item.description}</td>
                <td className={`${compact ? 'py-0.5' : 'py-3'} text-right font-medium`}>{item.amountLabel}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className={`${compact ? 'pt-1' : 'pt-4'} text-right font-bold text-slate-900 pr-2`}>
                Total Due:
              </td>
              <td
                className={`${compact ? 'pt-1 text-[7px]' : 'pt-4 text-xl'} text-right font-bold`}
                style={{ color: totalColor }}
              >
                {data.totalDueLabel}
              </td>
            </tr>
          </tfoot>
        </table>

        <div className={`${chrome.historyBox} ${compact ? 'p-1.5 mb-2' : 'p-4 mb-8'}`}>
          <h4 className={`font-bold text-slate-700 ${compact ? 'mb-1 text-[5px]' : 'mb-3 text-sm'}`}>
            Payment History
          </h4>
          {data.payments.length > 0 ? (
            <div className={compact ? 'space-y-0.5' : 'space-y-2'}>
              {data.payments.map((p, i) => (
                <div
                  key={p.id || `${p.dateLabel}-${i}`}
                  className="flex justify-between items-start gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-slate-700 font-medium">{p.dateLabel}</div>
                    <div className={`text-slate-500 ${compact ? 'text-[4px]' : 'text-xs'} truncate`}>
                      {p.note}
                    </div>
                  </div>
                  <span className="font-bold text-green-600 shrink-0">-{p.amountLabel}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className={`text-slate-400 italic ${compact ? 'text-[4px]' : 'text-sm'}`}>
              No payments recorded yet.
            </div>
          )}
        </div>

        {data.footerText ? (
          <div className={`text-center text-slate-400 ${compact ? 'text-[4px] mt-2' : 'text-xs mt-8'}`}>
            {data.footerText}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default InvoiceCanvas
