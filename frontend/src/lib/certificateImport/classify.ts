/**
 * Map scanned certificate text onto TvetFlow dynamic fields.
 * Identity lines become bindings. Another institution's name is not kept as static copy.
 */
import type { ClassifiedText, FieldRole, PageGeometry, TextBlock } from '@/lib/certificateImport/types'

const UNIQUE_ROLES: FieldRole[] = [
  'institutionName',
  'motto',
  'institutionAddress',
  'institutionEmail',
  'institutionPhone',
  'institutionWebsite',
  'studentName',
  'studentId',
  'programName',
  'className',
  'certificateNumber',
  'dateIssued',
  'completionMonth',
  'gpa',
  'leftTitle',
  'rightTitle',
  'leftName',
  'rightName',
]

function norm(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function isTitleLine(text: string) {
  if (/\b(diploma|degree|program|programme|course|certificate)\s+(in|of)\b/i.test(text) && !/certificate\s+of\s+(completion|achievement|attendance|participation|excellence|merit|appreciation)/i.test(text)) {
    return false
  }
  return /certificate\s+of|award\s+of|\bcertificate\b|\baward\b|\bdiploma\b/i.test(text) && text.length < 80
}

function looksLikePersonName(text: string) {
  const t = norm(text)
  if (t.length < 3 || t.length > 48) return false
  if (/\d/.test(t)) return false
  if (/certificate|university|college|institute|academy|school|registrar|principal|director/i.test(t)) {
    return false
  }
  const words = t.split(' ').filter(Boolean)
  if (words.length < 2 || words.length > 4) return false
  return words.every((w) => /^[A-Z][\p{L}'’.-]+$/u.test(w) || /^[A-Z]{2,}$/.test(w))
}

function side(block: TextBlock, page: PageGeometry): 'left' | 'right' {
  const mid = block.x + block.width / 2
  return mid < page.width * 0.5 ? 'left' : 'right'
}

function guess(block: TextBlock, page: PageGeometry): { role: FieldRole; score: number } {
  const text = norm(block.text)
  const y = block.y / Math.max(1, page.height)
  const lower = text.toLowerCase()

  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) {
    return { role: 'institutionEmail', score: 90 }
  }
  if (/(https?:\/\/|www\.)\S+/i.test(text) && text.length < 80) {
    return { role: 'institutionWebsite', score: 80 }
  }
  if (/\b(cert(ificate)?\s*(no|number|#)|serial\s*no|credential\s*no)\b/i.test(text) || /^[A-Z]{2,10}[-/]\d{2,}$/.test(text)) {
    return { role: 'certificateNumber', score: 88 }
  }
  if (/\b(student|registration|reg\.?|index)\s*(id|no|number)\b/i.test(text) || /^[A-Z]{1,6}\d{4,}$/.test(text)) {
    return { role: 'studentId', score: 86 }
  }
  if (/\b(gpa|cgpa|grade)\b/i.test(text)) return { role: 'gpa', score: 70 }
  if (/\b(phone|tel|mobile)\b/i.test(text) || /^\+?\d[\d\s().-]{7,}$/.test(text)) {
    return { role: 'institutionPhone', score: 75 }
  }
  if (/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i.test(text) || /\b\d{1,2}[/.\\-]\d{1,2}[/.\\-]\d{2,4}\b/.test(text)) {
    if (/complet|finish|end/i.test(text)) return { role: 'completionMonth', score: 72 }
    return { role: 'dateIssued', score: 74 }
  }
  if (
    /registrar|principal|director|dean|president|chairperson|head of|academic registrar/i.test(text) &&
    text.length < 48 &&
    !/cert\.?\s*no|this is to certify|having completed/i.test(text) &&
    !(/principal/i.test(text) && /registrar/i.test(text))
  ) {
    return { role: side(block, page) === 'left' ? 'leftTitle' : 'rightTitle', score: 78 }
  }
  if (/\b(diploma|degree|program|programme|course)\s+(in|of)\b/i.test(text) || /\bcertificate\s+in\b/i.test(text)) {
    return { role: 'programName', score: 84 }
  }
  if (isTitleLine(text) && block.fontSize >= 16) return { role: 'title', score: 60 + block.fontSize }
  if (/this is to certify|has successfully|is (hereby )?awarded|in recognition|has completed|completed the/i.test(text)) {
    return { role: 'body', score: 50 }
  }
  if (/\bclass\b/i.test(text) && text.length < 60) return { role: 'className', score: 55 }
  if (/\b(po box|p\.o\.|street|road|avenue|city|campus)\b/i.test(lower) || (/\d/.test(text) && /,/.test(text) && text.length < 90)) {
    return { role: 'institutionAddress', score: 64 }
  }
  if (y < 0.22 && text.length <= 64 && !isTitleLine(text) && block.fontSize >= 12) {
    if (block.fontStyle === 'italic' && text.length < 48) return { role: 'motto', score: 58 }
    return { role: 'institutionName', score: 40 + block.fontSize + (block.fontWeight === 'bold' ? 8 : 0) }
  }
  if (y > 0.72 && y < 0.92 && looksLikePersonName(text)) {
    return { role: side(block, page) === 'left' ? 'leftName' : 'rightName', score: 66 }
  }
  if (y > 0.28 && y < 0.72 && looksLikePersonName(text)) {
    return { role: 'studentName', score: 50 + block.fontSize }
  }
  if (/^_+$/.test(text.replace(/\s/g, '')) || /^[_.\-\s]{6,}$/.test(text)) {
    return { role: 'studentName', score: 30 }
  }
  if (y > 0.9) return { role: 'footer', score: 20 }
  if (text.length > 70) return { role: 'body', score: 15 }
  return { role: 'body', score: 10 }
}

export function classifyCertificateTexts(texts: TextBlock[], page: PageGeometry): ClassifiedText[] {
  const ranked = texts
    .map((block) => {
      const text = norm(block.text)
      const guessResult = text ? guess({ ...block, text }, page) : { role: 'body' as FieldRole, score: 0 }
      return { ...block, text, role: guessResult.role, score: guessResult.score }
    })
    .filter((block) => block.text.length > 0)

  const bestUnique = new Map<FieldRole, number>()
  ranked.forEach((block, index) => {
    if (!UNIQUE_ROLES.includes(block.role)) return
    const prev = bestUnique.get(block.role)
    if (prev == null || block.score > ranked[prev].score) bestUnique.set(block.role, index)
  })

  return ranked.map((block, index) => {
    if (!UNIQUE_ROLES.includes(block.role)) {
      return { ...block, role: block.role }
    }
    if (bestUnique.get(block.role) !== index) {
      return { ...block, role: block.text.length > 70 ? 'body' : 'body' }
    }
    return block
  })
}
