import React from 'react'
import DocumentDesignPanel from '@/components/admin/DocumentDesignPanel'
import TranscriptTemplateLibrary from '@/components/transcripts/TranscriptTemplateLibrary'
import CertificateLogoPageBuilder from '@/components/certificates/CertificateLogoPageBuilder'
import CertificateUploadOwn from '@/components/certificates/CertificateUploadOwn'

const TranscriptManagementPanel = () => (
  <DocumentDesignPanel
    hint="Pick a design, build your own, or upload a sample."
    templates={<TranscriptTemplateLibrary />}
    builder={<CertificateLogoPageBuilder documentType="transcript" />}
    upload={<CertificateUploadOwn documentType="transcript" />}
  />
)

export default TranscriptManagementPanel
