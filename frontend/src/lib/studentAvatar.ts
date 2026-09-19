/** Solid avatar palette — design-system.pen Students / Latest Results. */
export const STUDENT_AVATAR_COLORS = [
  { bg: '#0F6B4C', text: '#FFFFFF' },
  { bg: '#2563EB', text: '#FFFFFF' },
  { bg: '#7C3AED', text: '#FFFFFF' },
  { bg: '#C2410C', text: '#FFFFFF' },
  { bg: '#475569', text: '#FFFFFF' },
  { bg: '#0F766E', text: '#FFFFFF' },
] as const

export type StudentAvatarColor = (typeof STUDENT_AVATAR_COLORS)[number]

/** First + last name initials (e.g. "Muscab Abdiwali" → "MA"). */
export function getPersonInitials(name?: string | null, fallback = 'ST'): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return fallback
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase() || fallback
}

/** Stable color from id / code / name so the same student keeps the same hue. */
export function getStudentAvatarColor(seed?: string | null): StudentAvatarColor {
  const raw = String(seed || '')
  let hash = 0
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0
  }
  return STUDENT_AVATAR_COLORS[hash % STUDENT_AVATAR_COLORS.length]
}
