import React from 'react'
import { Award, LayoutTemplate, Upload } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type Props = {
  hint: string
  templates: React.ReactNode
  builder: React.ReactNode
  upload: React.ReactNode
}

/** Shared layout for certificate / transcript / invoice design tools. */
const DocumentDesignPanel = ({ hint, templates, builder, upload }: Props) => {
  return (
    <Tabs defaultValue="templates" className="w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
        <p className="text-sm text-slate-400">{hint}</p>
        <TabsList className="bg-slate-900 border border-slate-800 h-auto p-1 w-full sm:w-auto justify-start">
          <TabsTrigger value="templates" className="gap-1.5 text-xs sm:text-sm">
            <Award className="h-3.5 w-3.5" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="builder" className="gap-1.5 text-xs sm:text-sm">
            <LayoutTemplate className="h-3.5 w-3.5" />
            Builder
          </TabsTrigger>
          <TabsTrigger value="upload" className="gap-1.5 text-xs sm:text-sm">
            <Upload className="h-3.5 w-3.5" />
            Upload
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="templates" className="mt-0">
        {templates}
      </TabsContent>
      <TabsContent value="builder" className="mt-0">
        {builder}
      </TabsContent>
      <TabsContent value="upload" className="mt-0">
        {upload}
      </TabsContent>
    </Tabs>
  )
}

export default DocumentDesignPanel
