export function normalizeSecret(raw: string | undefined | null): string {
  let key = String(raw || '').trim()
  if (/^bearer\s+/i.test(key)) key = key.replace(/^bearer\s+/i, '').trim()
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim()
  }
  return key
}

export function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Build Resend `from` with an optional display name (e.g. institution). */
export function buildResendFrom(displayName?: string | null): string {
  const from = normalizeSecret(Deno.env.get('RESEND_FROM_EMAIL'))
  const name = String(displayName || '').trim()
  if (!from || !name) return from

  const angle = from.match(/<([^>]+)>/)
  const email = (angle ? angle[1] : from).trim()
  if (!email.includes('@')) return from

  const safe = name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `"${safe}" <${email}>`
}

export async function sendResendEmail(opts: {
  to: string
  subject: string
  /** Inline HTML — ignored when `template` is set (Resend forbids both). */
  html?: string
  /** Published Resend dashboard template. */
  template?: {
    id: string
    variables?: Record<string, string | number>
  }
  bcc?: string[]
  replyTo?: string
  fromName?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = normalizeSecret(Deno.env.get('RESEND_API_KEY'))
  const fromRaw = normalizeSecret(Deno.env.get('RESEND_FROM_EMAIL'))
  if (!apiKey || !fromRaw) {
    return { ok: false, error: 'RESEND_NOT_CONFIGURED' }
  }

  const from = buildResendFrom(opts.fromName) || fromRaw

  const to = String(opts.to || '').trim().toLowerCase()
  if (!to || !to.includes('@')) return { ok: false, error: 'INVALID_TO' }

  const templateId = String(opts.template?.id || '').trim()
  const html = String(opts.html || '').trim()
  if (!templateId && !html) return { ok: false, error: 'HTML_OR_TEMPLATE_REQUIRED' }

  const bcc = (opts.bcc || [])
    .map((e) => String(e || '').trim().toLowerCase())
    .filter((e) => e.includes('@') && e !== to)

  const replyTo = String(opts.replyTo || '').trim()

  const payload: Record<string, unknown> = {
    from,
    to: [to],
    subject: opts.subject,
  }

  if (templateId) {
    payload.template = {
      id: templateId,
      variables: opts.template?.variables || {},
    }
  } else {
    payload.html = html
  }

  if (bcc.length) payload.bcc = [...new Set(bcc)]
  if (replyTo.includes('@')) payload.reply_to = replyTo

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return { ok: false, error: text.slice(0, 300) || `RESEND_${res.status}` }
  }
  return { ok: true }
}
