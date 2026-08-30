import React from 'react'
import {
  Award,
  BookOpen,
  Briefcase,
  Calculator,
  Camera,
  Code2,
  Globe,
  GraduationCap,
  Laptop,
  Languages,
  Megaphone,
  Music,
  Palette,
  Stethoscope,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import {
  LANDING_PROGRAM_ICON_IDS,
  type LandingProgramIconId,
} from '@/lib/landingContent'

export const LANDING_PROGRAM_ICONS: Record<LandingProgramIconId, LucideIcon> = {
  graduation: GraduationCap,
  book: BookOpen,
  code: Code2,
  palette: Palette,
  briefcase: Briefcase,
  laptop: Laptop,
  camera: Camera,
  globe: Globe,
  languages: Languages,
  calculator: Calculator,
  music: Music,
  stethoscope: Stethoscope,
  wrench: Wrench,
  megaphone: Megaphone,
  award: Award,
  users: Users,
}

export function landingProgramIcon(id?: string | null): LucideIcon {
  if (id && id in LANDING_PROGRAM_ICONS) return LANDING_PROGRAM_ICONS[id as LandingProgramIconId]
  return GraduationCap
}

export const LANDING_PROGRAM_ICON_OPTIONS = LANDING_PROGRAM_ICON_IDS.map((id) => ({
  id,
  Icon: LANDING_PROGRAM_ICONS[id],
}))
