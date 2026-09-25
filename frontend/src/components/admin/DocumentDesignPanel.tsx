import React from 'react'
import { Award, LayoutTemplate, Upload } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { settingsSubListClass, settingsSubTriggerClass } from '@/components/admin/settingsNav'

type Props = {
  hint?: string
  templates: React.ReactNode
  builder?: React.ReactNode
  upload: React.ReactNode
  /** Controlled tab (e.g. templates | builder | upload) for deep links. */
  value?: string
  onValueChange?: (value: string) => void
  defaultValue?: string
}

/** Shared layout for certificate / transcript / invoice design tools. */
const DocumentDesignPanel = ({
  hint,
  templates,
  builder,
  upload,
  value,
  onValueChange,
  defaultValue = 'templates',
}: Props) => {
  const tabsProps =
    value != null && onValueChange
      ? { value, onValueChange }
      : { defaultValue: value || defaultValue }

  return (
    <Tabs {...tabsProps} className="w-full">
      <div className="space-y-2 px-2 sm:px-3">
        {hint ? (
          <p className="text-xs text-[var(--ds-text-tertiary,#8A978E)]">{hint}</p>
        ) : null}
        <TabsList className={settingsSubListClass}>
          <TabsTrigger value="templates" className={settingsSubTriggerClass}>
            <Award className="h-3.5 w-3.5" />
            Templates
          </TabsTrigger>
          {builder ? (
            <TabsTrigger value="builder" className={settingsSubTriggerClass}>
              <LayoutTemplate className="h-3.5 w-3.5" />
              Page Builder
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="upload" className={settingsSubTriggerClass}>
            <Upload className="h-3.5 w-3.5" />
            Upload
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="templates" className="mt-0 p-4 sm:p-5">
        {templates}
      </TabsContent>
      {builder ? (
        <TabsContent value="builder" className="mt-0 p-0">
          {builder}
        </TabsContent>
      ) : null}
      <TabsContent value="upload" className="mt-0 p-4 sm:p-5">
        {upload}
      </TabsContent>
    </Tabs>
  )
}

export default DocumentDesignPanel
