import React from 'react'
import { Navigate } from 'react-router-dom'

/** Legacy route — Certificate Import now lives in Institution Settings → Certificates → Upload. */
const CertificateImportPage = () => (
  <Navigate to="/admin/settings?group=documents&tab=upload" replace />
)

export default CertificateImportPage
