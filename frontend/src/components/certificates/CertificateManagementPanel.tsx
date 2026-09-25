import React from 'react'
import { useSearchParams } from 'react-router-dom'
import DocumentDesignPanel from '@/components/admin/DocumentDesignPanel'
import CertificateTemplateLibrary from '@/components/certificates/CertificateTemplateLibrary'
import CertificateLogoPageBuilder from '@/components/certificates/CertificateLogoPageBuilder'
import CertificateImportPanel from '@/components/certificates/import/CertificateImportPanel'

const CertificateManagementPanel = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const tab =
    tabParam === 'upload' || tabParam === 'builder' || tabParam === 'templates'
      ? tabParam
      : 'templates'

  const setTab = (next: string) => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.set('group', 'documents')
        p.set('tab', next)
        return p
      },
      { replace: true },
    )
  }

  return (
    <DocumentDesignPanel
      hint="Three independent paths: pick a library template, design in Page Builder, or upload a sample certificate (PDF/DOCX) to rebuild as editable blocks with your institution branding."
      value={tab}
      onValueChange={setTab}
      templates={<CertificateTemplateLibrary />}
      builder={<CertificateLogoPageBuilder variant="page-builder" />}
      upload={<CertificateImportPanel />}
    />
  )
}

export default CertificateManagementPanel
