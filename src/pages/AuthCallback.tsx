import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LoadingScreen } from '../components/LoadingScreen'

/**
 * Email-confirmation / magic-link landing. supabase-js (detectSessionInUrl: true) exchanges
 * the token in the URL for a session automatically on load — we just wait, then route.
 */
export function AuthCallback() {
  const { session, authLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (authLoading) return
    navigate(session ? '/' : '/login', { replace: true })
  }, [session, authLoading, navigate])

  return <LoadingScreen label="Signing you in" />
}
