import React from 'react'
import DocumentDesignPanel from '@/components/admin/DocumentDesignPanel'
import CertificateTemplateLibrary from '@/components/certificates/CertificateTemplateLibrary'
import CertificateLogoPageBuilder from '@/components/certificates/CertificateLogoPageBuilder'
import CertificateUploadOwn from '@/components/certificates/CertificateUploadOwn'

const CertificateManagementPanel = () => (
  <DocumentDesignPanel
    hint="Pick a design, build your own, or upload a sample."
    templates={<CertificateTemplateLibrary />}
    builder={<CertificateLogoPageBuilder variant="page-builder" />}
    upload={<CertificateUploadOwn />}
  />
)

export default CertificateManagementPanel
