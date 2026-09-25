import {
  extractCertStoragePath,
  normalizeLogoBuilderDesign,
  type LogoBuilderDesign,
} from '@/lib/certificateBuilder'
import type { DocumentTemplateType } from '@/lib/api'
import { supabase } from '@/lib/supabaseClient'

export type SavedLogoBuilderDesign = {
  id: string
  institutionId: string
  documentType: DocumentTemplateType
  name: string
  design: LogoBuilderDesign
  classId: string | null
  className: string | null
  createdAt: string
  updatedAt: string
}

/** Persist image srcs as storage paths or stable https URLs (never blob/signed). */
export function persistLogoBuilderDesignImages(design: LogoBuilderDesign): LogoBuilderDesign {
  const next = normalizeLogoBuilderDesign(design)
  return {
    ...next,
    elements: (next.elements || []).map((el) => {
      if (el.type !== 'image' || !el.src) return el
      const src = String(el.src).trim()
      const path = extractCertStoragePath(src)
      if (path) return { ...el, src: path }
      if (/^https?:\/\//i.test(src) && src.length <= 2500) return { ...el, src }
      if (/^(blob:|data:)/i.test(src)) return { ...el, src: undefined }
      return el
    }),
  }
}

function mapRow(row: Record<string, unknown>): SavedLogoBuilderDesign {
  const meta =
    row.meta && typeof row.meta === 'object' ? (row.meta as Record<string, unknown>) : {}
  const docType = String(row.document_type || 'certificate') as DocumentTemplateType
  return {
    id: String(row.id || ''),
    institutionId: String(row.institution_id || ''),
    documentType: ['certificate', 'transcript', 'invoice'].includes(docType)
      ? docType
      : 'certificate',
    name: String(row.name || 'Page Builder design'),
    design: normalizeLogoBuilderDesign(row.design),
    classId: row.class_id ? String(row.class_id) : null,
    className:
      (row.class_name ? String(row.class_name) : null) ||
      (meta.className ? String(meta.className) : null),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  }
}

export async function listSavedLogoBuilderDesigns(
  documentType: DocumentTemplateType = 'certificate',
): Promise<SavedLogoBuilderDesign[]> {
  const type = String(documentType || 'certificate')
  const withClass = await supabase
    .from('saved_logo_builder_designs')
    .select(
      'id, institution_id, document_type, name, design, class_id, meta, created_at, updated_at, class:classes(id, name)',
    )
    .eq('document_type', type)
    .order('created_at', { ascending: false })
    .limit(40)

  const { data, error } =
    withClass.error && /relationship|embed|classes/i.test(String(withClass.error.message || ''))
      ? await supabase
          .from('saved_logo_builder_designs')
          .select(
            'id, institution_id, document_type, name, design, class_id, meta, created_at, updated_at',
          )
          .eq('document_type', type)
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

export async function saveLogoBuilderDesign(input: {
  documentType: DocumentTemplateType
  name: string
  design: LogoBuilderDesign
  classId?: string | null
  activate?: boolean
}): Promise<SavedLogoBuilderDesign> {
  const design = persistLogoBuilderDesignImages(input.design)
  const { data, error } = await supabase.rpc('save_logo_builder_design', {
    p_document_type: input.documentType,
    p_name: input.name.slice(0, 120),
    p_design: design,
    p_class_id: input.classId || null,
    p_activate: input.activate !== false,
  })
  if (error) throw error
  return mapRow((data || {}) as Record<string, unknown>)
}

export async function updateLogoBuilderDesign(input: {
  id: string
  name: string
  design: LogoBuilderDesign
  classId?: string | null
  activate?: boolean
}): Promise<SavedLogoBuilderDesign> {
  const design = persistLogoBuilderDesignImages(input.design)
  const { data, error } = await supabase.rpc('update_logo_builder_design', {
    p_id: input.id,
    p_name: input.name.slice(0, 120),
    p_design: design,
    p_class_id: input.classId || null,
    p_activate: input.activate !== false,
  })
  if (error) throw error
  return mapRow((data || {}) as Record<string, unknown>)
}

export async function activateLogoBuilderDesign(
  item: SavedLogoBuilderDesign,
): Promise<SavedLogoBuilderDesign> {
  return updateLogoBuilderDesign({
    id: item.id,
    name: item.name,
    design: item.design,
    classId: item.classId,
    activate: true,
  })
}

export async function deleteLogoBuilderDesign(id: string) {
  const { error } = await supabase.from('saved_logo_builder_designs').delete().eq('id', id)
  if (error) throw error
}

export function logoBuilderLibraryErrorMessage(err: unknown) {
  const message =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message?: string }).message)
      : ''
  if (/saved_logo_builder_designs|schema cache|PGRST205|42P01/i.test(message)) {
    return 'Page Builder library is not available yet. Apply migration 0115 and try again.'
  }
  if (/BUILDER_LIBRARY_LIMIT/i.test(message)) {
    return 'This institution already has 40 saved Page Builder designs. Delete one first.'
  }
  if (/CLASS_NOT_FOUND/i.test(message)) return 'That class was not found for this institution.'
  if (/FORBIDDEN/i.test(message)) return 'Only an institution admin can save Page Builder designs.'
  if (/INVALID_DESIGN|DESIGN_TOO_LARGE/i.test(message)) {
    return 'This design could not be saved. Add content, or simplify large images.'
  }
  return 'The design could not be saved.'
}
