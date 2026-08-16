import React from 'react'
import { Helmet } from 'react-helmet'
import AnimatedPage from '@/components/AnimatedPage'
import PageHeader from '@/components/PageHeader'
import UserProfileSettings from '@/components/UserProfileSettings'
import InstitutionSettingsForm from '@/components/admin/InstitutionSettingsForm'
import CertificateManagementPanel from '@/components/certificates/CertificateManagementPanel'
import TranscriptManagementPanel from '@/components/transcripts/TranscriptManagementPanel'
import InvoiceManagementPanel from '@/components/finance/InvoiceManagementPanel'
import { useAuth } from '@/contexts/AuthContext'
import { getInstitutionDisplayName } from '@/lib/institution'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const AdminProfilePage = () => {
  const { user, institution, refreshUser } = useAuth()
  const institutionName = getInstitutionDisplayName(institution)

  return (
    <AnimatedPage>
      <Helmet>
        <title>Settings — {institutionName}</title>
      </Helmet>

      <PageHeader
        title="Institution Settings"
        subtitle="Manage branding, certificate, transcript and invoice templates, financial settings, and your administrator account."
      />

      <div className="max-w-5xl mx-auto">
        <Tabs defaultValue="institution" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800 mb-4 flex-wrap h-auto gap-1">
            <TabsTrigger value="institution">Institution</TabsTrigger>
            <TabsTrigger value="certificates">Certificate Management</TabsTrigger>
            <TabsTrigger value="transcripts">Transcript Management</TabsTrigger>
            <TabsTrigger value="invoices">Invoice Management</TabsTrigger>
            <TabsTrigger value="account">My Account</TabsTrigger>
          </TabsList>
          <TabsContent value="institution">
            <div className="max-w-3xl">
              <InstitutionSettingsForm onUpdated={() => refreshUser?.()} />
            </div>
          </TabsContent>
          <TabsContent value="certificates">
            <CertificateManagementPanel />
          </TabsContent>
          <TabsContent value="transcripts">
            <TranscriptManagementPanel />
          </TabsContent>
          <TabsContent value="invoices">
            <InvoiceManagementPanel />
          </TabsContent>
          <TabsContent value="account">
            <div className="max-w-3xl">
              <UserProfileSettings user={user} onUpdate={refreshUser} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AnimatedPage>
  )
}

export default AdminProfilePage
