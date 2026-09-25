import {
  extractCertStoragePath,
  normalizeLogoBuilderDesign,
  type LogoBuilderDesign,
} from '@/lib/certificateBuilder'
import type { ImportSummary } from '@/lib/certificateImport/types'
import { supabase } from '@/lib/supabaseClient'

/** Persist image srcs as storage paths (or stable https URLs), never blob/signed URLs.
 *  Does not rewrite element positions — what the admin dragged/resized is what generate uses.
 */
export function persistImportedDesignImages(design: LogoBuilderDesign): LogoBuilderDesign {
  const next = normalizeLogoBuilderDesign(design)
  return {
    ...next,
    elements: (next.elements || []).map((el) => {
      // Always unlock so every layer stays movable after save/reload
      const unlocked = el.locked ? { ...el, locked: false } : el
      if (unlocked.type !== 'image' || !unlocked.src) return unlocked
      const src = String(unlocked.src).trim()
      const path = extractCertStoragePath(src)
      if (path) {
        return {
          ...unlocked,
          src: path,
          ...(unlocked.text === '__certificate_patch__' || /patch|seal/i.test(String(unlocked.name || ''))
            ? {
                name: 'User certificate patch',
                text: '__certificate_patch__',
                patchKey: undefined,
              }
            : {}),
        }
      }
      if (/^https?:\/\//i.test(src) && src.length <= 2500) {
        return {
          ...unlocked,
          src,
          patchKey: undefined,
          ...(unlocked.text === '__certificate_patch__' || /patch|seal/i.test(String(unlocked.name || ''))
            ? { name: 'User certificate patch', text: '__certificate_patch__' }
            : {}),
        }
      }
      if (unlocked.text === '__certificate_patch__' && src) return { ...unlocked, patchKey: undefined }
      return { ...unlocked, src: undefined }
    }),
  }
}

export type SavedCertificateImport = {
  id: string
  institutionId: string
  name: string
  sourceFileName: string | null
  sourceKind: 'pdf' | 'docx'
  design: LogoBuilderDesign
  warnings: string[]
  createdAt: string
  classId: string | null
  className: string | null
}

function asWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 20)
}

function mapRow(row: Record<string, unknown>): SavedCertificateImport {
  const analysis =
    row.analysis && typeof row.analysis === 'object' ? (row.analysis as Record<string, unknown>) : {}
  const classId =
    (row.class_id ? String(row.class_id) : null) ||
    (analysis.classId ? String(analysis.classId) : null)
  const className =
    (row.class_name ? String(row.class_name) : null) ||
    (analysis.className ? String(analysis.className) : null)
  return {
    id: String(row.id || ''),
    institutionId: String(row.institution_id || ''),
    name: String(row.name || 'Imported certificate'),
    sourceFileName: row.source_file_name ? String(row.source_file_name) : null,
    sourceKind: row.source_kind === 'docx' ? 'docx' : 'pdf',
    design: normalizeLogoBuilderDesign(row.design),
    warnings: asWarnings(row.warnings),
    createdAt: String(row.created_at || ''),
    classId,
    className,
  }
}

export async function listImportedCertificateTemplates(): Promise<SavedCertificateImport[]> {
  const withClass = await supabase
    .from('imported_certificate_templates')
    .select(
      'id, institution_id, name, source_file_name, source_kind, design, warnings, created_at, class_id, analysis, class:classes(id, name)',
    )
    .order('created_at', { ascending: false })
    .limit(40)

  const { data, error } =
    withClass.error && /relationship|embed|classes/i.test(String(withClass.error.message || ''))
      ? await supabase
          .from('imported_certificate_templates')
          .select(
            'id, institution_id, name, source_file_name, source_kind, design, warnings, created_at, class_id, analysis',
          )
          .order('created_at', { ascending: false })
          .limit(40)
      : withClass

  if (error) throw error
  return (data || []).map((row) => {
    const mapped = mapRow(row as Record<string, unknown>)
    const cls = (row as { class?: { name?: string } | null }).class
    if (cls?.name) return { ...mapped, className: String(cls.name) }
    return mapped
  })
}

/** Republish an imported template as the live custom_upload used for student generation. */
export async function activateImportedCertificateTemplate(
  item: SavedCertificateImport,
): Promise<SavedCertificateImport> {
  return updateImportedCertificateTemplate({
    id: item.id,
    name: item.name,
    design: item.design,
    classId: item.classId,
    warnings: item.warnings,
  })
}

export async function saveImportedCertificateTemplate(input: {
  name: string
  sourceFileName: string
  sourceKind: 'pdf' | 'docx'
  design: LogoBuilderDesign
  summary: ImportSummary
  warnings: string[]
  classId?: string | null
}): Promise<SavedCertificateImport> {
  const design = persistImportedDesignImages(input.design)
  const { data, error } = await supabase.rpc('save_imported_certificate_template', {
    p_name: input.name.slice(0, 120),
    p_source_file_name: input.sourceFileName.slice(0, 180),
    p_source_kind: input.sourceKind,
    p_design: design,
    p_analysis: input.summary,
    p_warnings: input.warnings.slice(0, 20),
    p_class_id: input.classId || null,
  })
  if (error) throw error
  return mapRow((data || {}) as Record<string, unknown>)
}

export async function updateImportedCertificateTemplate(input: {
  id: string
  name: string
  design: LogoBuilderDesign
  classId?: string | null
  warnings?: string[]
}): Promise<SavedCertificateImport> {
  const design = persistImportedDesignImages(input.design)
  const { data, error } = await supabase.rpc('update_imported_certificate_template', {
    p_id: input.id,
    p_name: input.name.slice(0, 120),
    p_design: design,
    p_class_id: input.classId || null,
    p_warnings: input.warnings?.slice(0, 20) ?? null,
  })
  if (error) throw error
  return mapRow((data || {}) as Record<string, unknown>)
}

export async function deleteImportedCertificateTemplate(id: string) {
  const { error } = await supabase.from('imported_certificate_templates').delete().eq('id', id)
  if (error) throw error
}
