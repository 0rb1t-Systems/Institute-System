import React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import InvoiceTemplateLibrary from '@/components/finance/InvoiceTemplateLibrary'
import CertificateLogoPageBuilder from '@/components/certificates/CertificateLogoPageBuilder'
import CertificateUploadOwn from '@/components/certificates/CertificateUploadOwn'

/**
 * Institution Settings → Invoice Management
 * Same 3 stages as certificates: Templates / Page Builder / Upload Own.
 * Finance invoice generation from payments/fees stays unchanged.
 */
const InvoiceManagementPanel = () => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Invoice Management</h2>
        <p className="text-sm text-slate-400 mt-1">
          Library templates · Page Builder · Upload Own (upload → generate full editable invoice)
        </p>
      </div>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="bg-slate-950 border border-slate-800 mb-3 flex-wrap h-auto gap-1">
          <TabsTrigger value="templates">Invoice Templates</TabsTrigger>
          <TabsTrigger value="builder">Invoice Page Builder</TabsTrigger>
          <TabsTrigger value="upload">Upload Own Invoice</TabsTrigger>
        </TabsList>
        <TabsContent value="templates">
          <InvoiceTemplateLibrary />
        </TabsContent>
        <TabsContent value="builder">
          <CertificateLogoPageBuilder documentType="invoice" />
        </TabsContent>
        <TabsContent value="upload">
          <CertificateUploadOwn documentType="invoice" />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default InvoiceManagementPanel
