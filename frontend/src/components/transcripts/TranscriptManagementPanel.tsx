import React from 'react'
import DocumentDesignPanel from '@/components/admin/DocumentDesignPanel'
import TranscriptTemplateLibrary from '@/components/transcripts/TranscriptTemplateLibrary'
import TranscriptClassNarrativePanel from '@/components/transcripts/TranscriptClassNarrativePanel'
import CertificateUploadOwn from '@/components/certificates/CertificateUploadOwn'
import { useAuth } from '@/contexts/AuthContext'
import { canManageTranscriptClassParagraph } from '@/lib/institution'

const TranscriptManagementPanel = () => {
  const { user, institution } = useAuth()
  const showClassParagraph = canManageTranscriptClassParagraph(institution, user?.role)

  return (
    <div className="space-y-4">
      {showClassParagraph ? <TranscriptClassNarrativePanel /> : null}
      <DocumentDesignPanel
        hint="Pick a design or upload a sample."
        templates={<TranscriptTemplateLibrary />}
        upload={<CertificateUploadOwn documentType="transcript" />}
      />
    </div>
  )
}

export default TranscriptManagementPanel
