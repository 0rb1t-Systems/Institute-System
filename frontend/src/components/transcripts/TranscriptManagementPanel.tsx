import React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import TranscriptTemplateLibrary from '@/components/transcripts/TranscriptTemplateLibrary'
import CertificateLogoPageBuilder from '@/components/certificates/CertificateLogoPageBuilder'
import CertificateUploadOwn from '@/components/certificates/CertificateUploadOwn'

/**
 * Institution Settings → Transcript Management
 * Same 3 stages as certificates: Templates / Page Builder / Upload Own.
 * Live transcript grades, finalize, verify, and print flows stay unchanged.
 */
const TranscriptManagementPanel = () => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Transcript Management</h2>
        <p className="text-sm text-slate-400 mt-1">
          Choose a library template, design a real transcript page, or upload an institution
          transcript. Active designs apply to Report Center and student portal transcripts.
        </p>
      </div>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="bg-slate-950 border border-slate-800 mb-3 flex-wrap h-auto gap-1">
          <TabsTrigger value="templates">Transcript Templates</TabsTrigger>
          <TabsTrigger value="builder">Transcript Page Builder</TabsTrigger>
          <TabsTrigger value="upload">Upload Own Transcript</TabsTrigger>
        </TabsList>
        <TabsContent value="templates">
          <TranscriptTemplateLibrary />
        </TabsContent>
        <TabsContent value="builder">
          <CertificateLogoPageBuilder documentType="transcript" />
        </TabsContent>
        <TabsContent value="upload">
          <CertificateUploadOwn documentType="transcript" />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default TranscriptManagementPanel
