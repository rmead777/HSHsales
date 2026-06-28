import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LoadingScreen } from './LoadingScreen'

/** Signed-in only (profile state irrelevant). */
export function RequireAuth() {
  const { session, authLoading } = useAuth()
  if (authLoading) return <LoadingScreen />
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}

/** Signed-in AND activated by an admin. Inactive reps are routed to the pending screen.
 *  (This is UX only — the real gate is RLS, which returns zero rows to inactive reps.) */
export function RequireActive() {
  const { session, authLoading, profile, profileFetched } = useAuth()
  if (authLoading) return <LoadingScreen />
  if (!session) return <Navigate to="/login" replace />
  if (!profileFetched) return <LoadingScreen label="Checking your access" />
  if (!profile?.active) return <Navigate to="/pending" replace />
  return <Outlet />
}

/** Admins only. */
export function RequireAdmin() {
  const { session, authLoading, profile, profileFetched } = useAuth()
  if (authLoading) return <LoadingScreen />
  if (!session) return <Navigate to="/login" replace />
  if (!profileFetched) return <LoadingScreen label="Checking your access" />
  if (profile?.role !== 'admin') return <Navigate to="/" replace />
  return <Outlet />
}
