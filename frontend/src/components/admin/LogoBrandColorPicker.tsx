import React from 'react'
import { Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { normalizeHexColor } from '@/lib/logoBrandColors'

type Props = {
  primary: string
  accent: string
  tertiary?: string | null
  swatches?: string[]
  detecting?: boolean
  onPrimaryChange: (hex: string) => void
  onAccentChange: (hex: string) => void
  onTertiaryChange: (hex: string) => void
  className?: string
  primaryId?: string
  accentId?: string
  tertiaryId?: string
}

const LogoBrandColorPicker = ({
  primary,
  accent,
  tertiary = '',
  swatches = [],
  detecting = false,
  onPrimaryChange,
  onAccentChange,
  onTertiaryChange,
  className,
  primaryId = 'theme_primary',
  accentId = 'theme_accent',
  tertiaryId = 'theme_tertiary',
}: Props) => {
  const safePrimary = normalizeHexColor(primary)
  const safeAccent = normalizeHexColor(accent, '#D32F2F')
  const hasTertiary = Boolean(String(tertiary || '').trim())
  const safeTertiary = hasTertiary ? normalizeHexColor(tertiary, '#0EA5E9') : '#0EA5E9'

  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid gap-3 sm:grid-cols-3">
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
        <div className="space-y-2">
          <Label htmlFor={tertiaryId}>Third color</Label>
          <div className="flex gap-2">
            <Input
              id={tertiaryId}
              type="color"
              value={safeTertiary}
              onChange={(e) => onTertiaryChange(e.target.value)}
              className="h-10 w-14 cursor-pointer p-1 bg-slate-950 border-slate-800"
            />
            <Input
              value={tertiary || ''}
              onChange={(e) => onTertiaryChange(e.target.value)}
              placeholder="optional"
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
            Colors from the logo are applied automatically: 1st = primary, 2nd = secondary, 3rd = third color.
            Click a swatch if you want to override primary.
          </p>
          <div className="flex flex-wrap gap-2">
            {swatches.map((hex) => {
              const role =
                hex.toUpperCase() === safePrimary
                  ? '1'
                  : hex.toUpperCase() === safeAccent
                    ? '2'
                    : hasTertiary && hex.toUpperCase() === safeTertiary
                      ? '3'
                      : null
              return (
                <button
                  key={hex}
                  type="button"
                  title={hex}
                  onClick={() => onPrimaryChange(hex)}
                  className={cn(
                    'relative h-8 w-8 rounded-md border-2 transition',
                    role ? 'border-white ring-2 ring-white/40' : 'border-slate-700 hover:border-slate-400',
                  )}
                  style={{ backgroundColor: hex }}
                >
                  {role ? (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-bold text-slate-900">
                      {role}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          Upload a logo to auto-fill primary, secondary, and a third color when the logo has them.
        </p>
      )}
    </div>
  )
}

export default LogoBrandColorPicker
