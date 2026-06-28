import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import type { Profile } from '../lib/database.types'

export interface SignUpResult {
  needsConfirmation: boolean
  alreadyExists: boolean
  error: string | null
}

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  authLoading: boolean // initial session resolution
  profileLoading: boolean
  profileFetched: boolean // first profile lookup has completed (row found OR confirmed absent)
  isActive: boolean
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, fullName?: string) => Promise<SignUpResult>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileFetched, setProfileFetched] = useState(false)

  const user = session?.user ?? null
  const userId = user?.id ?? null

  const fetchProfile = useCallback(async (uid: string | null) => {
    if (!uid) {
      setProfile(null)
      setProfileFetched(true)
      return
    }
    setProfileLoading(true)
    // RLS scopes this to the caller's own row. maybeSingle() returns null (not an error)
    // if the signup trigger hasn't created the row yet.
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, active, rep_code, created_at')
      .eq('id', uid)
      .maybeSingle()
    if (!error) setProfile(data)
    setProfileLoading(false)
    setProfileFetched(true)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })
    // Do NOT await DB calls inside this callback (it holds the auth lock → deadlock).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Fetch profile whenever the signed-in user changes.
  useEffect(() => {
    setProfileFetched(false)
    void fetchProfile(userId)
  }, [userId, fetchProfile])

  // Cheap freshness: refetch profile (the activation gate) on focus + tab visibility.
  useEffect(() => {
    if (!userId) return
    const onFocus = () => void fetchProfile(userId)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void fetchProfile(userId)
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [userId, fetchProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }, [])

  const signUp = useCallback(
    async (email: string, password: string, fullName?: string): Promise<SignUpResult> => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: fullName ? { full_name: fullName } : undefined,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) return { needsConfirmation: false, alreadyExists: false, error: error.message }
      // No session + a user → email confirmation required. Empty identities → already registered.
      const needsConfirmation = !!data.user && !data.session
      const alreadyExists = !!data.user && (data.user.identities?.length ?? 0) === 0
      return { needsConfirmation, alreadyExists, error: null }
    },
    [],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const refreshProfile = useCallback(() => fetchProfile(userId), [fetchProfile, userId])

  const value = useMemo<AuthState>(
    () => ({
      session,
      user,
      profile,
      authLoading,
      profileLoading,
      profileFetched,
      isActive: !!profile?.active,
      isAdmin: profile?.role === 'admin',
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [
      session,
      user,
      profile,
      authLoading,
      profileLoading,
      profileFetched,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
