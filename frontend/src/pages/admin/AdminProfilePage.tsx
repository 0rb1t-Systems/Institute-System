import React from 'react'
import { Helmet } from 'react-helmet'
import { Link } from 'react-router-dom'
import AnimatedPage from '@/components/AnimatedPage'
import PageHeader from '@/components/PageHeader'
import UserProfileSettings from '@/components/UserProfileSettings'
import InstitutionSettingsForm from '@/components/admin/InstitutionSettingsForm'
import CertificateManagementPanel from '@/components/certificates/CertificateManagementPanel'
import TranscriptManagementPanel from '@/components/transcripts/TranscriptManagementPanel'
import InvoiceManagementPanel from '@/components/finance/InvoiceManagementPanel'
import {
  settingsPrimaryListClass,
  settingsPrimaryTriggerClass,
  settingsShellClass,
} from '@/components/admin/settingsNav'
import { useAuth } from '@/contexts/AuthContext'
import { getInstitutionDisplayName } from '@/lib/institution'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Award, Building2, Receipt, ScrollText, User } from 'lucide-react'

const SECTIONS = [
  {
    value: 'institution',
    icon: Building2,
    title: 'Institution',
    hint: 'Details & preferences',
  },
  {
    value: 'account',
    icon: User,
    title: 'Account',
    hint: 'Manage your account',
  },
  {
    value: 'certificates',
    icon: Award,
    title: 'Certificates',
    hint: 'Templates and settings',
  },
  {
    value: 'transcripts',
    icon: ScrollText,
    title: 'Transcripts',
    hint: 'Templates and settings',
  },
  {
    value: 'invoices',
    icon: Receipt,
    title: 'Invoices',
    hint: 'Templates and settings',
  },
] as const

const AdminProfilePage = () => {
  const { user, institution, refreshUser } = useAuth()
  const institutionName = getInstitutionDisplayName(institution)

  return (
    <AnimatedPage>
      <Helmet>
        <title>Settings — {institutionName}</title>
      </Helmet>

      <div className="max-w-6xl mx-auto">
        <PageHeader title="Settings" subtitle="Institution, documents, and your account.">
          <Button asChild variant="outline" size="sm" className="h-9 border-slate-700">
            <Link to="/admin/landing">Landing page</Link>
          </Button>
        </PageHeader>

        <div className={settingsShellClass}>
          <Tabs defaultValue="institution" className="w-full">
            <div className="p-1.5 sm:p-2">
              <TabsList className={settingsPrimaryListClass}>
                {SECTIONS.map(({ value, icon: Icon, title, hint }) => (
                  <TabsTrigger key={value} value={value} className={settingsPrimaryTriggerClass}>
                    <Icon className="h-5 w-5 shrink-0 text-slate-300 group-data-[state=active]:text-white" />
                    <span className="min-w-0 text-left">
                      <span className="block truncate text-sm font-semibold leading-tight text-white">
                        {title}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] font-normal leading-snug text-slate-400 group-data-[state=active]:text-indigo-100">
                        {hint}
                      </span>
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <TabsContent value="institution" className="mt-0 border-t border-slate-800">
              <InstitutionSettingsForm onUpdated={() => refreshUser?.()} />
            </TabsContent>
            <TabsContent value="account" className="mt-0 border-t border-slate-800 p-4 sm:p-5">
              <div className="max-w-3xl">
                <UserProfileSettings user={user} onUpdate={refreshUser} />
              </div>
            </TabsContent>
            <TabsContent value="certificates" className="mt-0 border-t border-slate-800">
              <CertificateManagementPanel />
            </TabsContent>
            <TabsContent value="transcripts" className="mt-0 border-t border-slate-800">
              <TranscriptManagementPanel />
            </TabsContent>
            <TabsContent value="invoices" className="mt-0 border-t border-slate-800">
              <InvoiceManagementPanel />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AnimatedPage>
  )
}

export default AdminProfilePage
