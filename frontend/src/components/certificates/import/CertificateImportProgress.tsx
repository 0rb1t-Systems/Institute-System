import React from 'react'
import { Check, Loader2 } from 'lucide-react'
import { IMPORT_STAGES, type ImportStageId } from '@/lib/certificateImport/types'

type Props = {
  active: ImportStageId | null
  detail?: string | null
  done: ImportStageId[]
}

const CertificateImportProgress = ({ active, detail, done }: Props) => {
  return (
    <ol className="space-y-2">
      {IMPORT_STAGES.map((stage) => {
        const finished = done.includes(stage.id)
        const current = active === stage.id
        return (
          <li
            key={stage.id}
            className="flex items-center gap-3 rounded-lg border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface,#fff)] px-3 py-2 text-sm"
          >
            {finished ? (
              <Check className="h-4 w-4 text-[var(--ds-accent,#1F8A5B)]" />
            ) : current ? (
              <Loader2 className="h-4 w-4 animate-spin text-[var(--ds-accent,#1F8A5B)]" />
            ) : (
              <span className="h-4 w-4 rounded-full border border-[var(--ds-border,#DDE5DF)]" />
            )}
            <span className={current || finished ? 'text-[var(--ds-text-primary,#122018)]' : 'text-[var(--ds-text-tertiary,#8A978E)]'}>
              {current && detail ? detail : stage.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export default CertificateImportProgress
