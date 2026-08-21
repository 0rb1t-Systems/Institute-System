import React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import CertificateTemplateLibrary from '@/components/certificates/CertificateTemplateLibrary'
import CertificateLogoPageBuilder from '@/components/certificates/CertificateLogoPageBuilder'
import CertificateUploadOwn from '@/components/certificates/CertificateUploadOwn'

/**
 * Institution Settings → Certificate Management
 * Library · Page Builder · Upload Own.
 */
const CertificateManagementPanel = () => {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-white">Certificate Management</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Templates · Page Builder · Upload Own
        </p>
      </div>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="bg-slate-950 border border-slate-800 mb-2 flex-wrap h-auto gap-1">
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="builder">Page Builder</TabsTrigger>
          <TabsTrigger value="upload">Upload Own</TabsTrigger>
        </TabsList>
        <TabsContent value="templates">
          <CertificateTemplateLibrary />
        </TabsContent>
        <TabsContent value="builder">
          <CertificateLogoPageBuilder variant="page-builder" />
        </TabsContent>
        <TabsContent value="upload">
          <CertificateUploadOwn />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default CertificateManagementPanel
