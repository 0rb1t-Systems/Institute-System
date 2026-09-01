import React from 'react'
import DocumentDesignPanel from '@/components/admin/DocumentDesignPanel'
import InvoiceTemplateLibrary from '@/components/finance/InvoiceTemplateLibrary'
import CertificateUploadOwn from '@/components/certificates/CertificateUploadOwn'

const InvoiceManagementPanel = () => (
  <DocumentDesignPanel
    hint="Pick a design or upload a sample."
    templates={<InvoiceTemplateLibrary />}
    upload={<CertificateUploadOwn documentType="invoice" />}
  />
)

export default InvoiceManagementPanel
