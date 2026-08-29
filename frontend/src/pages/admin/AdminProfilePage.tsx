import React from 'react'
import { Helmet } from 'react-helmet'
import { Navigate, useSearchParams } from 'react-router-dom'
import AnimatedPage from '@/components/AnimatedPage'
import PageHeader from '@/components/PageHeader'
import UserProfileSettings from '@/components/UserProfileSettings'
import InstitutionSettingsForm from '@/components/admin/InstitutionSettingsForm'
import CertificateManagementPanel from '@/components/certificates/CertificateManagementPanel'
import TranscriptManagementPanel from '@/components/transcripts/TranscriptManagementPanel'
import InvoiceManagementPanel from '@/components/finance/InvoiceManagementPanel'
import { AdminSettingsShell, resolveSettingsGroup } from '@/components/admin/AdminSettingsShell'
import { settingsSubListClass, settingsSubTriggerClass } from '@/components/admin/settingsNav'
import { useAuth } from '@/contexts/AuthContext'
import { getInstitutionDisplayName } from '@/lib/institution'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Award,
  Building2,
  GraduationCap,
  Hash,
  Palette,
  Receipt,
  ScrollText,
  User,
  Wallet,
  FileText,
} from 'lucide-react'

const GROUP_TABS = {
  institution: [
    { value: 'profile', label: 'Profile', icon: Building2 },
    { value: 'brand', label: 'Branding', icon: Palette },
    { value: 'ids', label: 'IDs', icon: Hash },
    { value: 'account', label: 'Account', icon: User },
  ],
  academic: [
    { value: 'grading', label: 'Grading', icon: GraduationCap },
    { value: 'transcripts', label: 'Transcripts', icon: ScrollText },
  ],
  documents: [
    { value: 'certificates', label: 'Certificates', icon: Award },
    { value: 'finance', label: 'Finance', icon: Wallet },
    { value: 'invoices', label: 'Invoices', icon: Receipt },
    { value: 'documents', label: 'Signatories & footers', icon: FileText },
  ],
} as const

const SUBTITLES = {
  institution: 'Institution information first: profile, branding, and ID numbers.',
  academic: 'Grading scale and transcript templates.',
  documents: 'Certificates, finance defaults, invoices, and document signatories.',
}

const AdminProfilePage = () => {
  const { user, institution, refreshUser } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const group = resolveSettingsGroup('/admin/profile', searchParams.get('group'))
  const institutionName = getInstitutionDisplayName(institution)

  if (group === 'landing') {
    return <Navigate to="/admin/landing" replace />
  }

  const tabs = GROUP_TABS[group]
  const tabParam = searchParams.get('tab')
  const tab = tabs.some((item) => item.value === tabParam) ? tabParam : tabs[0].value

  const setTab = (next: string) => {
    setSearchParams({ group, tab: next }, { replace: true })
  }

  const goFormSection = (next: string) => {
    if (next === 'profile' || next === 'brand' || next === 'ids') {
      setSearchParams({ group: 'institution', tab: next }, { replace: true })
      return
    }
    if (next === 'finance' || next === 'documents') {
      setSearchParams({ group: 'documents', tab: next }, { replace: true })
    }
  }

  return (
    <AnimatedPage>
      <Helmet>
        <title>Settings — {institutionName}</title>
      </Helmet>

      <div className="max-w-6xl mx-auto">
        <PageHeader title="Settings" subtitle={SUBTITLES[group]} />

        <AdminSettingsShell active={group}>
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <div className="px-2 sm:px-3">
              <TabsList className={settingsSubListClass}>
                {tabs.map(({ value, label, icon: Icon }) => (
                  <TabsTrigger key={value} value={value} className={settingsSubTriggerClass}>
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </Tabs>

          {group === 'institution' && tab === 'account' ? (
            <div className="p-4 sm:p-5">
              <div className="max-w-3xl">
                <UserProfileSettings user={user} onUpdate={refreshUser} />
              </div>
            </div>
          ) : null}

          {group === 'institution' && tab !== 'account' ? (
            <InstitutionSettingsForm
              section={tab}
              onUpdated={() => refreshUser?.()}
              onNeedSection={goFormSection}
            />
          ) : null}

          {group === 'academic' && tab === 'grading' ? (
            <InstitutionSettingsForm
              section="grading"
              onUpdated={() => refreshUser?.()}
              onNeedSection={goFormSection}
            />
          ) : null}

          {group === 'academic' && tab === 'transcripts' ? <TranscriptManagementPanel /> : null}

          {group === 'documents' && tab === 'certificates' ? <CertificateManagementPanel /> : null}

          {group === 'documents' && (tab === 'finance' || tab === 'documents') ? (
            <InstitutionSettingsForm
              section={tab}
              onUpdated={() => refreshUser?.()}
              onNeedSection={goFormSection}
            />
          ) : null}

          {group === 'documents' && tab === 'invoices' ? <InvoiceManagementPanel /> : null}
        </AdminSettingsShell>
      </div>
    </AnimatedPage>
  )
}

export default AdminProfilePage
