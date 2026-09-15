import React from 'react'
import DocumentDesignPanel from '@/components/admin/DocumentDesignPanel'
import CertificateTemplateLibrary from '@/components/certificates/CertificateTemplateLibrary'
import CertificateLogoPageBuilder from '@/components/certificates/CertificateLogoPageBuilder'
import CertificateUploadOwn from '@/components/certificates/CertificateUploadOwn'

const CertificateManagementPanel = () => (
  <DocumentDesignPanel
    hint="Three independent paths: pick a library template, build on canvas, or upload a sample to generate a ready template. Builder and Upload never share designs."
    templates={<CertificateTemplateLibrary />}
    builder={<CertificateLogoPageBuilder variant="page-builder" />}
    upload={<CertificateUploadOwn />}
  />
)

export default CertificateManagementPanel
