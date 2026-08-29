import React from 'react'
import { Award, LayoutTemplate, Upload } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { settingsSubListClass, settingsSubTriggerClass } from '@/components/admin/settingsNav'

type Props = {
  hint?: string
  templates: React.ReactNode
  builder: React.ReactNode
  upload: React.ReactNode
}

/** Shared layout for certificate / transcript / invoice design tools. */
const DocumentDesignPanel = ({ templates, builder, upload }: Props) => {
  return (
    <Tabs defaultValue="templates" className="w-full">
      <div className="px-2 sm:px-3">
        <TabsList className={settingsSubListClass}>
          <TabsTrigger value="templates" className={settingsSubTriggerClass}>
            <Award className="h-3.5 w-3.5" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="builder" className={settingsSubTriggerClass}>
            <LayoutTemplate className="h-3.5 w-3.5" />
            Builder
          </TabsTrigger>
          <TabsTrigger value="upload" className={settingsSubTriggerClass}>
            <Upload className="h-3.5 w-3.5" />
            Upload
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="templates" className="mt-0 p-4 sm:p-5">
        {templates}
      </TabsContent>
      <TabsContent value="builder" className="mt-0 p-0">
        {builder}
      </TabsContent>
      <TabsContent value="upload" className="mt-0 p-4 sm:p-5">
        {upload}
      </TabsContent>
    </Tabs>
  )
}

export default DocumentDesignPanel
