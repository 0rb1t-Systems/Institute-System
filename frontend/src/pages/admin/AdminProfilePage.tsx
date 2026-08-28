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
import { useAuth } from '@/contexts/AuthContext'
import { getInstitutionDisplayName } from '@/lib/institution'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Award, Building2, Receipt, ScrollText, User } from 'lucide-react'

const AdminProfilePage = () => {
  const { user, institution, refreshUser } = useAuth()
  const institutionName = getInstitutionDisplayName(institution)

  return (
    <AnimatedPage>
      <Helmet>
        <title>Settings — {institutionName}</title>
      </Helmet>

      <PageHeader title="Settings" subtitle="Institution, documents, and your account.">
        <Button asChild variant="outline" size="sm" className="border-slate-700">
          <Link to="/admin/landing">Landing page</Link>
        </Button>
      </PageHeader>

      <div className="max-w-5xl mx-auto">
        <Tabs defaultValue="institution" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800 mb-4 w-full justify-start h-auto gap-0.5 p-1 overflow-x-auto">
            <TabsTrigger value="institution" className="gap-1.5 text-xs sm:text-sm">
              <Building2 className="h-3.5 w-3.5" />
              Institution
            </TabsTrigger>
            <TabsTrigger value="certificates" className="gap-1.5 text-xs sm:text-sm">
              <Award className="h-3.5 w-3.5" />
              Certificates
            </TabsTrigger>
            <TabsTrigger value="transcripts" className="gap-1.5 text-xs sm:text-sm">
              <ScrollText className="h-3.5 w-3.5" />
              Transcripts
            </TabsTrigger>
            <TabsTrigger value="invoices" className="gap-1.5 text-xs sm:text-sm">
              <Receipt className="h-3.5 w-3.5" />
              Invoices
            </TabsTrigger>
            <TabsTrigger value="account" className="gap-1.5 text-xs sm:text-sm">
              <User className="h-3.5 w-3.5" />
              Account
            </TabsTrigger>
          </TabsList>
          <TabsContent value="institution">
            <InstitutionSettingsForm onUpdated={() => refreshUser?.()} />
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
