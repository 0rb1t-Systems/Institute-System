import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDate } from '@/lib/utils'

function dash(value: unknown): string {
  const text = String(value ?? '').trim()
  return text || '—'
}

export type PendingRosterRow = {
  name: string
  phone: string
  university: string
  program: string
}

/**
 * One printable roster PDF for all pending online applicants:
 * Name | Phone | University | Program | empty Action check box
 */
export function downloadPendingRegistrationsRosterPdf({
  rows,
  institutionName,
}: {
  rows: PendingRosterRow[]
  institutionName?: string | null
}) {
  const list = Array.isArray(rows) ? rows : []
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const org = String(institutionName || '').trim() || 'Institution'
  const generated = formatDate(new Date().toISOString())

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Pending Applications Roster', 14, 16)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80)
  doc.text(org, 14, 23)
  doc.setTextColor(0)

  doc.setFontSize(9)
  doc.text(`${list.length} pending applicant(s)  ·  ${generated}`, 14, 29)

  const body = list.map((row, index) => [
    String(index + 1),
    dash(row.name),
    dash(row.phone),
    dash(row.university),
    dash(row.program),
    '',
  ])

  autoTable(doc, {
    startY: 34,
    head: [['#', 'Name', 'Phone', 'University', 'Program', 'Action']],
    body: body.length
      ? body
      : [['—', 'No pending applications', '—', '—', '—', '']],
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 2.5,
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [31, 138, 91],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 40 },
      2: { cellWidth: 30 },
      3: { cellWidth: 36 },
      4: { cellWidth: 50 },
      5: { cellWidth: 16, halign: 'center' },
    },
    didDrawCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 5) return
      if (!body.length) return
      const size = 4.2
      const x = data.cell.x + (data.cell.width - size) / 2
      const y = data.cell.y + (data.cell.height - size) / 2
      doc.setDrawColor(40)
      doc.setLineWidth(0.3)
      doc.rect(x, y, size, size)
    },
  })

  const stamp = new Date().toISOString().slice(0, 10)
  doc.save(`pending_applications_${stamp}.pdf`)
}
