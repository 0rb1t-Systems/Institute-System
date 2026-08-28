import React from 'react'
import DocumentDesignPanel from '@/components/admin/DocumentDesignPanel'
import InvoiceTemplateLibrary from '@/components/finance/InvoiceTemplateLibrary'
import CertificateLogoPageBuilder from '@/components/certificates/CertificateLogoPageBuilder'
import CertificateUploadOwn from '@/components/certificates/CertificateUploadOwn'

const InvoiceManagementPanel = () => (
  <DocumentDesignPanel
    hint="Pick a design, build your own, or upload a sample."
    templates={<InvoiceTemplateLibrary />}
    builder={<CertificateLogoPageBuilder documentType="invoice" />}
    upload={<CertificateUploadOwn documentType="invoice" />}
  />
)

export default InvoiceManagementPanel
