import React from 'react'
import { Helmet } from 'react-helmet'
import { Navigate, useSearchParams } from 'react-router-dom'
import AnimatedPage from '@/components/AnimatedPage'
import PageHeader from '@/components/PageHeader'
import InstitutionSettingsForm from '@/components/admin/InstitutionSettingsForm'
import CertificateManagementPanel from '@/components/certificates/CertificateManagementPanel'
import TranscriptManagementPanel from '@/components/transcripts/TranscriptManagementPanel'
import InvoiceManagementPanel from '@/components/finance/InvoiceManagementPanel'
import { AdminSettingsShell, resolveSettingsGroup } from '@/components/admin/AdminSettingsShell'
import { settingsSubListClass, settingsSubTriggerClass } from '@/components/admin/settingsNav'
import { useAuth } from '@/contexts/AuthContext'
import { getInstitutionDisplayName } from '@/lib/institution'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Award, GraduationCap, Receipt, ScrollText } from 'lucide-react'

const GROUP_TABS = {
  academic: [
    { value: 'grading', label: 'Grading', icon: GraduationCap },
    { value: 'transcripts', label: 'Transcripts', icon: ScrollText },
  ],
  documents: [
    { value: 'certificates', label: 'Certificates', icon: Award },
    { value: 'invoices', label: 'Invoices', icon: Receipt },
  ],
} as const

const SUBTITLES = {
  institution: 'Institution profile, branding, IDs, finance, and document signatories.',
  academic: 'Grading scale and transcript templates.',
  documents: 'Certificate and invoice templates.',
}

const InstitutionSettingsPage = () => {
  const { institution, refreshUser } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const group = resolveSettingsGroup('/admin/settings', searchParams.get('group'))
  const institutionName = getInstitutionDisplayName(institution)
  const tabParam = searchParams.get('tab')

  if (group === 'landing') {
    return <Navigate to="/admin/landing" replace />
  }

  if (group === 'documents' && (tabParam === 'finance' || tabParam === 'documents')) {
    return <Navigate to="/admin/settings?group=institution" replace />
  }

  const tabs = group === 'institution' ? null : GROUP_TABS[group]
  const tab = tabs?.some((item) => item.value === tabParam) ? tabParam : tabs?.[0].value

  const setTab = (next: string) => {
    setSearchParams({ group, tab: next }, { replace: true })
  }

  return (
    <AnimatedPage>
      <Helmet>
        <title>Institution Settings — {institutionName}</title>
      </Helmet>

      <div className="max-w-6xl mx-auto">
        <PageHeader title="Institution Settings" subtitle={SUBTITLES[group]} />

        <AdminSettingsShell active={group}>
          {tabs ? (
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
          ) : null}

          {group === 'institution' ? (
            <InstitutionSettingsForm onUpdated={() => refreshUser?.()} />
          ) : null}

          {group === 'academic' && tab === 'grading' ? (
            <InstitutionSettingsForm section="grading" onUpdated={() => refreshUser?.()} />
          ) : null}

          {group === 'academic' && tab === 'transcripts' ? <TranscriptManagementPanel /> : null}

          {group === 'documents' && tab === 'certificates' ? <CertificateManagementPanel /> : null}

          {group === 'documents' && tab === 'invoices' ? <InvoiceManagementPanel /> : null}
        </AdminSettingsShell>
      </div>
    </AnimatedPage>
  )
}

export default InstitutionSettingsPage
