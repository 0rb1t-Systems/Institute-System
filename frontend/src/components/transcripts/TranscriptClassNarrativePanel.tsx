import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/components/ui/use-toast'
import { getUserMessage } from '@/lib/mapError'
import { MESSAGES } from '@/lib/messages'
import { DEFAULT_TRANSCRIPT_NARRATIVE } from '@/lib/transcriptTemplates'

/**
 * Optional per-class transcript paragraph. Hidden unless an institution
 * chooses a class and saves text. Not part of class create/edit.
 */
const TranscriptClassNarrativePanel = () => {
  const { classes, updateClassData } = useData()
  const { toast } = useToast()
  const [classId, setClassId] = useState('')
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  const selected = useMemo(
    () => classes.find((c) => c.id === classId) || null,
    [classes, classId],
  )

  useEffect(() => {
    setText(String(selected?.transcript_narrative_text || ''))
  }, [selected?.id, selected?.transcript_narrative_text])

  const handleSave = async () => {
    if (!classId) {
      toast({
        title: 'Select a class',
        description: 'Choose the class whose transcript should include this paragraph.',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      await updateClassData(classId, {
        transcript_narrative_text: text.trim() || null,
      })
      toast({
        title: text.trim() ? 'Paragraph saved' : 'Paragraph removed',
        description: text.trim()
          ? `This text appears on transcripts for ${selected?.name || 'the class'}.`
          : 'Transcripts for this class no longer show a completion paragraph.',
      })
    } catch (err) {
      toast({
        title: 'Error',
        description: getUserMessage(err, { fallback: MESSAGES.SAVE_FAILED }),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-white">Optional class paragraph</p>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
          Leave this empty unless you need extra completion text (for example a research-publication
          statement). It is not required. Pick a class, add the paragraph, and only that class&apos;s
          transcripts will show it.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label className="text-slate-300">Class</Label>
        <Select value={classId} onValueChange={setClassId}>
          <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
            <SelectValue placeholder="Select a class (optional)" />
          </SelectTrigger>
          <SelectContent>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
                {c.transcript_narrative_text ? ' · has paragraph' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="class-transcript-narrative" className="text-slate-300">
          Paragraph
        </Label>
        <Textarea
          id="class-transcript-narrative"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!classId}
          rows={6}
          className="bg-slate-950 border-slate-700 text-slate-100 min-h-[120px] disabled:opacity-50"
          placeholder="Empty = not shown on transcripts."
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-slate-700"
          disabled={!classId}
          onClick={() => setText(DEFAULT_TRANSCRIPT_NARRATIVE)}
        >
          Insert sample paragraph
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-slate-400"
          disabled={!classId || !text}
          onClick={() => setText('')}
        >
          Clear
        </Button>
        <Button type="button" size="sm" className="ml-auto" disabled={!classId || saving} onClick={handleSave}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save for this class
        </Button>
      </div>
    </div>
  )
}

export default TranscriptClassNarrativePanel
