import React from 'react'
import { Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { normalizeHexColor } from '@/lib/logoBrandColors'

type Props = {
  primary: string
  accent: string
  swatches?: string[]
  detecting?: boolean
  onPrimaryChange: (hex: string) => void
  onAccentChange: (hex: string) => void
  className?: string
  primaryId?: string
  accentId?: string
}

const LogoBrandColorPicker = ({
  primary,
  accent,
  swatches = [],
  detecting = false,
  onPrimaryChange,
  onAccentChange,
  className,
  primaryId = 'theme_primary',
  accentId = 'theme_accent',
}: Props) => {
  const safePrimary = normalizeHexColor(primary)
  const safeAccent = normalizeHexColor(accent, '#D32F2F')

  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={primaryId}>Primary color</Label>
          <div className="flex gap-2">
            <Input
              id={primaryId}
              type="color"
              value={safePrimary}
              onChange={(e) => onPrimaryChange(e.target.value)}
              className="h-10 w-14 cursor-pointer p-1 bg-slate-950 border-slate-800"
            />
            <Input
              value={primary}
              onChange={(e) => onPrimaryChange(e.target.value)}
              className="bg-slate-950 border-slate-800 font-mono"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor={accentId}>Secondary color</Label>
          <div className="flex gap-2">
            <Input
              id={accentId}
              type="color"
              value={safeAccent}
              onChange={(e) => onAccentChange(e.target.value)}
              className="h-10 w-14 cursor-pointer p-1 bg-slate-950 border-slate-800"
            />
            <Input
              value={accent}
              onChange={(e) => onAccentChange(e.target.value)}
              className="bg-slate-950 border-slate-800 font-mono"
            />
          </div>
        </div>
      </div>

      {detecting ? (
        <p className="flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Detecting colors from your logo…
        </p>
      ) : null}

      {swatches.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs text-slate-400">
            Detected from logo — click a color to use it as the primary brand color. Secondary can still be edited above.
          </p>
          <div className="flex flex-wrap gap-2">
            {swatches.map((hex) => {
              const selected = hex.toUpperCase() === safePrimary
              return (
                <button
                  key={hex}
                  type="button"
                  title={`Use ${hex} as primary`}
                  onClick={() => onPrimaryChange(hex)}
                  className={cn(
                    'h-8 w-8 rounded-md border-2 transition',
                    selected ? 'border-white ring-2 ring-white/40' : 'border-slate-700 hover:border-slate-400',
                  )}
                  style={{ backgroundColor: hex }}
                />
              )
            })}
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          Upload a logo to auto-fill these colors from the image. You can override them anytime.
        </p>
      )}
    </div>
  )
}

export default LogoBrandColorPicker
