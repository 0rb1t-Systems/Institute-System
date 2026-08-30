import React from 'react'
import { Helmet } from 'react-helmet'
import { Navigate, useSearchParams } from 'react-router-dom'
import AnimatedPage from '@/components/AnimatedPage'
import PageHeader from '@/components/PageHeader'
import UserProfileSettings from '@/components/UserProfileSettings'
import { useAuth } from '@/contexts/AuthContext'

const SETTINGS_GROUPS = new Set(['institution', 'academic', 'documents', 'landing'])

const AdminProfilePage = () => {
  const { user, refreshUser } = useAuth()
  const [searchParams] = useSearchParams()
  const group = searchParams.get('group')
  const tab = searchParams.get('tab')

  if (group === 'landing') {
    return <Navigate to="/admin/landing" replace />
  }

  if (group && SETTINGS_GROUPS.has(group)) {
    const next = new URLSearchParams()
    next.set('group', group)
    if (tab) next.set('tab', tab)
    return <Navigate to={`/admin/settings?${next.toString()}`} replace />
  }

  return (
    <AnimatedPage>
      <Helmet>
        <title>Account</title>
      </Helmet>

      <div className="max-w-3xl mx-auto">
        <PageHeader title="Account" subtitle="Photo, name, email, and password." />
        <UserProfileSettings user={user} onUpdate={refreshUser} />
      </div>
    </AnimatedPage>
  )
}

export default AdminProfilePage
