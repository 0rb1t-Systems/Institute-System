import React, { useRef, useState } from 'react'
import { FileUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

const ACCEPT = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

type Props = {
  disabled?: boolean
  onFile: (file: File) => void
}

const CertificateImportDropzone = ({ disabled, onFile }: Props) => {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [over, setOver] = useState(false)

  const take = (file: File | undefined) => {
    if (!file || disabled) return
    onFile(file)
  }

  return (
    <div
      className={`rounded-[var(--ds-radius-xl,16px)] border border-dashed px-6 py-14 text-center transition-colors ${
        over
          ? 'border-[var(--ds-accent,#1F8A5B)] bg-[var(--ds-accent,#1F8A5B)]/5'
          : 'border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface,#fff)]'
      }`}
      onDragOver={(event) => {
        event.preventDefault()
        if (!disabled) setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setOver(false)
        take(event.dataTransfer.files?.[0])
      }}
    >
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--ds-accent,#1F8A5B)]/10 text-[var(--ds-accent,#1F8A5B)]">
        <FileUp className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold text-[var(--ds-text-primary,#122018)]">Upload your certificate</h2>
      <p className="mt-1 text-sm text-[var(--ds-text-secondary,#5B6B61)]">Drag and drop your file here</p>
      <Button
        type="button"
        className="mt-5"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        Choose File
      </Button>
      <p className="mt-4 text-xs tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">PDF, DOC, DOCX</p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          take(event.target.files?.[0])
          event.target.value = ''
        }}
      />
    </div>
  )
}

export default CertificateImportDropzone
