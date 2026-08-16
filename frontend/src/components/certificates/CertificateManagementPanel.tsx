import React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import CertificateTemplateLibrary from '@/components/certificates/CertificateTemplateLibrary'
import CertificateLogoPageBuilder from '@/components/certificates/CertificateLogoPageBuilder'
import CertificateUploadOwn from '@/components/certificates/CertificateUploadOwn'

/**
 * Institution Settings → Certificate Management
 * Library templates, Certificate Page Builder, and Upload Own Certificate.
 */
const CertificateManagementPanel = () => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Certificate Management</h2>
        <p className="text-sm text-slate-400 mt-1">
          Choose a library template, design your own certificate layout, or upload an institution
          template.
        </p>
      </div>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="bg-slate-950 border border-slate-800 mb-3 flex-wrap h-auto gap-1">
          <TabsTrigger value="templates">Certificate Templates</TabsTrigger>
          <TabsTrigger value="builder">Certificate Page Builder</TabsTrigger>
          <TabsTrigger value="upload">Upload Own Certificate</TabsTrigger>
        </TabsList>
        <TabsContent value="templates">
          <CertificateTemplateLibrary />
        </TabsContent>
        <TabsContent value="builder">
          <CertificateLogoPageBuilder />
        </TabsContent>
        <TabsContent value="upload">
          <CertificateUploadOwn />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default CertificateManagementPanel
