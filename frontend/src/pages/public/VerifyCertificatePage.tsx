import { Navigate, useParams } from 'react-router-dom'

/**
 * Certificate QR links use /verify-certificate/:id.
 * Same RPC as /verify/:id — redirect to the shared VerificationPage (no duplicate UI).
 */
const VerifyCertificatePage = () => {
  const { id } = useParams()
  const code = String(id || '').trim()
  if (!code) return <Navigate to="/verify-credential" replace />
  return <Navigate to={`/verify/${encodeURIComponent(code)}`} replace />
}

export default VerifyCertificatePage
