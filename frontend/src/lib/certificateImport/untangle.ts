/**
 * Untangle OCR / PDF text that got jammed, duplicated, or glued across fields.
 * Keeps certificate phrases as separate clean lines for editable template blocks.
 */

const CERTIFY_PHRASE = 'This is to certify that'

const BODY_STARTERS = [
  /^having completed/i,
  /^has successfully/i,
  /^is hereby awarded/i,
  /^in recognition/i,
  /^who has completed/i,
  /^for successfully/i,
]

const SIGNATORY_TITLES = [
  'Academic Registrar',
  'Registrar',
  'Principal',
  'Director',
  'Dean',
  'President',
  'Chairperson',
  'Head of School',
  'Vice Chancellor',
  'Chancellor',
]

export function normalizeSpaces(text: string) {
  return String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Collapse a letter-run that is the same phrase doubled without a clear space. */
function undoubleCompactRun(text: string): string {
  const t = normalizeSpaces(text)
  if (t.length < 12) return t

  const compact = t.replace(/\s+/g, '')
  const half = Math.floor(compact.length / 2)
  if (half >= 6 && compact.slice(0, half) === compact.slice(half, half * 2)) {
    let count = 0
    let i = 0
    for (; i < t.length && count < half; i++) {
      if (/[A-Za-z0-9]/i.test(t[i])) count += 1
    }
    return normalizeSpaces(t.slice(0, i))
  }

  // Glued token in an ALL-CAPS name line: "… MOHAMEDNARURO OMAR …"
  // Keep the second copy of the name when the line looks doubled.
  if (/^[A-Z\s]+$/.test(t) && compact.length >= 18) {
    const words = t.split(/\s+/).filter(Boolean)
    const glueIdx = words.findIndex((w) => w.length >= 10)
    if (glueIdx >= 0 && words.length >= 4) {
      const glued = words[glueIdx]
      // MOHAMEDNARURO → try split before the second name start (last 4–8 caps as new word)
      const split = glued.match(/^([A-Z]{4,8})([A-Z]{4,8})$/)
      if (split) {
        const second = [split[2], ...words.slice(glueIdx + 1)].join(' ')
        if (second.split(' ').length >= 2 && second.split(' ').length <= 5) {
          return normalizeSpaces(second)
        }
      }
    }

    for (let n = Math.floor(compact.length / 2); n >= 8; n--) {
      const a = compact.slice(0, n)
      const b = compact.slice(n, n * 2)
      if (b.length < 8) continue
      const matches = [...a].filter((ch, i) => ch === b[i]).length
      if (matches / Math.max(a.length, b.length) < 0.75) continue
      const keep = b.length >= a.length ? b : a
      // Re-apply spaces from the trailing half of the original string when possible
      const trailing = words.slice(Math.floor(words.length / 2)).join(' ')
      if (trailing.replace(/\s+/g, '').length >= keep.length - 2 && trailing.split(' ').length >= 2) {
        return normalizeSpaces(trailing.replace(/^[A-Z]{4,8}(?=[A-Z]{4,})/, ''))
      }
      return keep
    }
  }
  return t
}

/** Insert spaces where camelCase or TitleCase words were glued. */
export function unglueCamel(text: string) {
  return normalizeSpaces(
    text
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Za-z])(\d)/g, '$1 $2')
      .replace(/(\d)([A-Za-z])/g, '$1 $2')
      .replace(/\binApplied\b/gi, 'in Applied')
      .replace(/\bDiploma in\s*Diploma in\b/gi, 'Diploma in')
      .replace(/([A-Z]{2,})(This|Having|Who|Cert)/g, '$1 $2')
      .replace(/([A-Za-z])(This is to certify)/gi, '$1 $2')
      .replace(/([A-Za-z])(having completed)/gi, '$1 $2')
      .replace(/([A-Za-z])(Academic Registrar)/gi, '$1 $2')
      .replace(/([A-Za-z])(Principal)\b/gi, '$1 $2')
      .replace(/([A-Za-z])(Cert\.?\s*no)/gi, '$1 $2'),
  )
}

/** Remove immediate phrase duplication: "NAME NAME" or "Principal Principal". */
export function dedupeAdjacentRepeats(text: string) {
  let t = undoubleCompactRun(unglueCamel(text))
  // Whole-string doubled
  const half = Math.floor(t.length / 2)
  if (half >= 6) {
    const a = t.slice(0, half).trim()
    const b = t.slice(half).trim()
    if (a.toLowerCase() === b.toLowerCase()) return a
  }
  // Glued doubled block without space: FOOFOO (min 8 chars)
  t = t.replace(/([\p{L}]{8,})\1/giu, '$1')
  // Adjacent multi-word phrase repeated (2–5 words)
  t = t.replace(/\b((?:[\p{L}'’.-]+\s+){1,4}[\p{L}'’.-]+)\s+\1\b/giu, '$1')
  // Adjacent single word repeated
  t = t.replace(/\b([\p{L}'’.-]{3,})\s+\1\b/giu, '$1')
  // ALL-CAPS multi-word name glued twice: NARURO OMAR MOHAMEDNARURO OMAR MOHAMED
  t = t.replace(/\b((?:[A-Z]{2,}(?:\s+[A-Z]{2,}){1,4}))\1\b/g, '$1')
  t = undoubleCompactRun(t)
  return normalizeSpaces(t)
}

/**
 * Split one jammed OCR/PDF line into logical certificate phrases.
 * e.g. "NARURONARUROThis is to certify that" → ["NARURO…", "This is to certify that"]
 */
export function splitJammedCertificateLine(raw: string): string[] {
  let t = dedupeAdjacentRepeats(unglueCamel(raw))
  if (!t) return []

  t = t.replace(/([A-Za-z])(This is to certify)/gi, '$1 $2')
  t = t.replace(/([A-Za-z])(having completed)/gi, '$1 $2')
  t = t.replace(/([A-Za-z])(Cert\.?\s*no)/gi, '$1 $2')
  t = t.replace(/([A-Za-z])(Academic Registrar)/gi, '$1 $2')
  t = t.replace(/([A-Za-z])(Principal)\b/gi, '$1 $2')
  t = dedupeAdjacentRepeats(t)

  const parts: string[] = []
  const push = (s: string) => {
    const cleaned = dedupeAdjacentRepeats(unglueCamel(s))
    if (cleaned.length >= 2) parts.push(cleaned)
  }

  const boundary =
    /(This is to certify that|having completed[\s\S]*?academic board\.?|under the authority of the academic board\.?|Cert\.?\s*no\.?\s*[:#]?\s*[A-Z0-9/-]+|Academic Registrar|Principal|Diploma in\s+[A-Za-z][\sA-Za-z,&/-]{4,80})/gi

  let last = 0
  let m: RegExpExecArray | null
  const matcher = new RegExp(boundary.source, 'gi')
  while ((m = matcher.exec(t)) !== null) {
    if (m.index > last) push(t.slice(last, m.index))
    push(m[0])
    last = m.index + m[0].length
  }
  if (last < t.length) push(t.slice(last))
  if (!parts.length) push(t)

  const expanded: string[] = []
  for (const part of parts) {
    if (
      /principal|registrar|cert\.?\s*no/i.test(part) &&
      /principal.*registrar|registrar.*principal|cert\.?\s*no/i.test(part)
    ) {
      const footerBits = splitFooterMash(part)
      if (footerBits.length > 1) expanded.push(...footerBits)
      else expanded.push(part)
    } else {
      expanded.push(part)
    }
  }

  return [...new Set(expanded.map((p) => dedupeAdjacentRepeats(p)).filter(Boolean))]
}

function splitFooterMash(text: string): string[] {
  const t = dedupeAdjacentRepeats(unglueCamel(text))
  const out: string[] = []
  let rest = t

  for (const title of SIGNATORY_TITLES) {
    const re = new RegExp(title.replace(/\s+/g, '\\s+'), 'i')
    if (re.test(rest)) {
      out.push(title)
      rest = rest.replace(new RegExp(`(?:${title.replace(/\s+/g, '\\s+')}\\s*)+`, 'gi'), ' ')
    }
  }

  const cert = rest.match(/Cert\.?\s*no\.?\s*[:#]?\s*([A-Z0-9][A-Z0-9/-]*)/i)
  if (cert) {
    out.push(`Cert no. ${cert[1].replace(/\/$/, '')}`)
    rest = rest.replace(cert[0], ' ')
  }

  rest = normalizeSpaces(rest)
  if (rest.length >= 3 && !/^[_.\-\s]+$/.test(rest)) out.push(rest)
  return out
}

export function extractCertifyLine(texts: string[]): string {
  for (const raw of texts) {
    for (const piece of splitJammedCertificateLine(raw)) {
      if (/this is to certify/i.test(piece)) return CERTIFY_PHRASE
    }
  }
  return CERTIFY_PHRASE
}

export function looksLikePersonNameLine(text: string) {
  const t = normalizeSpaces(text)
  if (t.length < 3 || t.length > 56) return false
  if (/\d/.test(t)) return false
  if (/certificate|university|college|institute|diploma|registrar|principal|certify|having|authority/i.test(t)) {
    return false
  }
  const words = t.split(' ').filter(Boolean)
  if (words.length < 2 || words.length > 5) return false
  return words.every((w) => /^[A-Z][\p{L}'’.-]+$/u.test(w) || /^[A-Z]{2,}$/.test(w))
}

/** True when a line still looks like glued OCR mash and should not be shown as a block. */
export function looksLikeJammedMash(text: string) {
  const t = normalizeSpaces(text)
  if (!t) return true
  if (/([A-Z]{4,})\1/i.test(t.replace(/\s+/g, ''))) return true
  if (/principal\s+principal|registrar\s+registrar/i.test(t)) return true
  if (/this is to certify/i.test(t) && /[A-Z]{3,}\s+[A-Z]{3,}/.test(t) && t.length > 40) return true
  if (/principal/i.test(t) && /registrar/i.test(t) && /cert\.?\s*no/i.test(t)) return true
  if (/[a-z][A-Z]/.test(t) && t.length > 30 && /certify|having|principal|registrar/i.test(t)) return true

  // Doubled ALL-CAPS name glued without a clean space: MOHAMEDNARURO…
  const compact = t.replace(/\s+/g, '')
  if (/^[A-Z\s]+$/.test(t) && compact.length >= 18) {
    for (let n = Math.floor(compact.length / 2); n >= 8; n--) {
      const a = compact.slice(0, n)
      const b = compact.slice(n, n * 2)
      if (b.length < 8) continue
      const matches = [...a].filter((ch, i) => ch === b[i]).length
      if (matches / Math.max(a.length, b.length) >= 0.7) return true
    }
    // Mid-token glue of two Title/NAME runs
    if (/[A-Z]{5,}[A-Z]{5,}/.test(compact) && /\s/.test(t) && t.split(/\s+/).length >= 4) {
      const midGlue = t.split(/\s+/).some((w) => w.length >= 12 && /^[A-Z]+$/.test(w))
      if (midGlue) return true
    }
  }
  return false
}

export function extractProgramTitle(texts: string[]): string | null {
  const lines = texts.flatMap((t) => splitJammedCertificateLine(t))
  const full = lines.find(
    (t) =>
      /\b(diploma|certificate|degree)\s+in\b/i.test(t) &&
      t.length > 14 &&
      t.length < 120 &&
      !/certify|having completed|registrar|principal/i.test(t) &&
      !looksLikeJammedMash(t),
  )
  if (full) return normalizeSpaces(full).slice(0, 100)

  const headIdx = lines.findIndex((t) => /^(diploma|certificate|degree)\s+in$/i.test(t))
  if (headIdx >= 0) {
    const tail = lines.slice(headIdx + 1).find(
      (t) =>
        t.length > 4 &&
        t.length < 80 &&
        !/certify|having|awarded|registrar|principal|this is/i.test(t) &&
        !looksLikePersonNameLine(t),
    )
    if (tail) return normalizeSpaces(`${lines[headIdx]} ${tail}`).slice(0, 100)
  }
  return null
}

export function extractSignatoryTitles(texts: string[]): { left: string | null; right: string | null } {
  const pieces = texts.flatMap((t) => splitJammedCertificateLine(t))
  let left: string | null = null
  let right: string | null = null
  for (const piece of pieces) {
    const t = dedupeAdjacentRepeats(piece)
    if (t.length > 48 || looksLikeJammedMash(t)) continue
    if (/academic\s+registrar/i.test(t) || /^registrar$/i.test(t)) left = 'Academic Registrar'
    else if ((/^principal$/i.test(t) || /\bprincipal\b/i.test(t)) && t.length < 20) right = 'Principal'
    else if (/^director$/i.test(t)) right = right || 'Director'
    else if (/^dean$/i.test(t)) left = left || 'Dean'
  }
  return { left, right }
}

export function extractCertificateNumber(texts: string[]): string | null {
  for (const raw of texts) {
    for (const piece of splitJammedCertificateLine(raw)) {
      const m = piece.match(/Cert\.?\s*no\.?\s*[:#]?\s*([A-Z0-9][A-Z0-9/-]*)/i)
      if (m) return m[1].replace(/\/$/, '')
      const bare = piece.match(/^([A-Z]{2,10}[-/]\d{2,}|\d{4,})$/)
      if (bare && !/certify|diploma/i.test(piece)) return bare[1]
    }
  }
  return null
}

/**
 * Body paragraphs from the certificate, excluding names, titles, certify, program, cert no.
 */
export function extractBodyParagraphs(texts: string[], programTitle?: string | null): string[] {
  const programLower = normalizeSpaces(programTitle || '').toLowerCase()
  const pieces = texts.flatMap((t) => splitJammedCertificateLine(t))
  const bodyBits: string[] = []

  for (const piece of pieces) {
    const t = dedupeAdjacentRepeats(unglueCamel(piece))
    if (t.length < 8) continue
    if (looksLikeJammedMash(t)) continue
    if (/this is to certify/i.test(t)) continue
    if (looksLikePersonNameLine(t)) continue
    if (/^(academic\s+)?registrar$|^principal$|^director$|^dean$/i.test(t)) continue
    if (/cert\.?\s*no/i.test(t)) continue
    if (programLower && t.toLowerCase() === programLower) continue
    if (/^(diploma|certificate|degree)\s+in$/i.test(t)) continue
    if (
      /\b(diploma|certificate|degree)\s+in\b/i.test(t) &&
      t.length < 100 &&
      !BODY_STARTERS.some((r) => r.test(t))
    ) {
      continue
    }
    if (/principal|registrar/i.test(t) && /cert\.?\s*no/i.test(t)) continue
    if (/^(principal|academic registrar)(\s+(principal|academic registrar))+$/i.test(t)) continue

    const isBody =
      BODY_STARTERS.some((r) => r.test(t)) ||
      /prescribed examinations|academic board|course of study|successfully completed|hereby awarded|in recognition/i.test(
        t,
      ) ||
      (t.length > 40 && /[a-z]/.test(t))

    if (!isBody) continue
    bodyBits.push(t.slice(0, 480))
  }

  const merged = mergeBodyFragments(bodyBits)
  const unique: string[] = []
  for (const line of merged) {
    const key = line.toLowerCase()
    const overlapIdx = unique.findIndex((u) => {
      const uk = u.toLowerCase()
      if (uk === key) return true
      const shorter = uk.length <= key.length ? uk : key
      const longer = uk.length > key.length ? uk : key
      return shorter.length >= 16 && longer.includes(shorter)
    })
    if (overlapIdx >= 0) {
      if (line.length > unique[overlapIdx].length) unique[overlapIdx] = line
      continue
    }
    unique.push(line)
    if (unique.length >= 4) break
  }
  return unique.map((line) => dedupeAdjacentRepeats(line))
}

function mergeBodyFragments(lines: string[]): string[] {
  if (lines.length <= 1) return lines
  // Prefer a single full paragraph when present
  const full = lines.find(
    (l) => /having completed/i.test(l) && /academic board/i.test(l) && l.length > 60,
  )
  if (full) return [dedupeAdjacentRepeats(full)]

  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    let cur = lines[i]
    while (
      i + 1 < lines.length &&
      !cur.toLowerCase().includes(lines[i + 1].toLowerCase().replace(/\.$/, '')) &&
      (/,\s*$/.test(cur) ||
        /^(study|and passed|prescribed)/i.test(lines[i + 1]) ||
        /^under the authority/i.test(lines[i + 1])) &&
      cur.length + lines[i + 1].length < 420
    ) {
      const next = lines[i + 1]
      if (/^study and passed/i.test(cur) && !/having completed/i.test(cur)) {
        cur = `having completed an approved course of ${cur}`
      }
      if (/^study and passed/i.test(next) && /having completed/i.test(cur)) {
        i += 1
        continue
      }
      cur = normalizeSpaces(`${cur} ${next}`)
      i += 1
    }
    if (/^study and passed/i.test(cur) && !/having completed/i.test(cur)) {
      cur = `having completed an approved course of ${cur}`
    }
    out.push(dedupeAdjacentRepeats(cur))
    i += 1
  }
  return out
}

/** Expand raw scan texts into clean, de-duplicated line candidates. */
export function expandCleanLines(texts: Array<{ text: string }>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const block of texts) {
    for (const piece of splitJammedCertificateLine(block.text)) {
      const cleaned = dedupeAdjacentRepeats(piece)
      if (looksLikeJammedMash(cleaned)) continue
      const key = cleaned.toLowerCase()
      if (seen.has(key)) continue
      // Drop shorter lines already contained in a kept line
      let subsumed = false
      for (const prev of seen) {
        if (prev.includes(key) && key.length >= 12) {
          subsumed = true
          break
        }
      }
      if (subsumed) continue
      seen.add(key)
      out.push(cleaned)
    }
  }
  return out
}

/** Return TextBlock copies with text split/cleaned — never keep jammed mash as one block. */
export function sanitizeScanTexts(texts: Array<{ text: string } & Record<string, unknown>>) {
  const out: typeof texts = []
  const seen = new Set<string>()
  for (const block of texts) {
    const pieces = splitJammedCertificateLine(String(block.text || ''))
    const list = pieces.length ? pieces : [dedupeAdjacentRepeats(String(block.text || ''))].filter(Boolean)
    list.forEach((phrase, i) => {
      if (looksLikeJammedMash(phrase)) return
      const key = phrase.toLowerCase()
      if (seen.has(key)) return
      seen.add(key)
      out.push({
        ...block,
        text: phrase,
        y: Number(block.y || 0) + i * 0.5,
      })
    })
  }
  return out
}
