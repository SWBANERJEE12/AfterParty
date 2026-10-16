import type { Session, User } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import type { Profile } from './types'
import { usernameToAuthEmail, validatePassword, validateUsername } from './username'

type AuthContextValue = {
  loading: boolean
  session: Session | null
  user: User | null
  profile: Profile | null
  profileLoadIssue: 'missing_table' | 'not_found' | null
  authConfigured: boolean
  signUp: (input: {
    username: string
    password: string
    displayName: string
  }) => Promise<{ ok: true } | { ok: false; error: string }>
  signIn: (username: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  updateProfile: (patch: {
    display_name?: string
    avatar_url?: string | null
    preferences?: Record<string, unknown>
  }) => Promise<{ ok: true } | { ok: false; error: string }>
  updatePassword: (password: string) => Promise<{ ok: true } | { ok: false; error: string }>
}

const AuthContext = createContext<AuthContextValue | null>(null)

type ProfileFetchResult =
  | { profile: Profile; issue: null }
  | { profile: null; issue: 'missing_table' | 'not_found' | null }

async function fetchProfile(userId: string): Promise<ProfileFetchResult> {
  const supabase = getSupabase()
  if (!supabase) return { profile: null, issue: null }
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('does not exist') || (msg.includes('schema cache') && msg.includes('profiles'))) {
      return { profile: null, issue: 'missing_table' }
    }
    return { profile: null, issue: null }
  }
  if (!data) return { profile: null, issue: 'not_found' }
  return { profile: data as Profile, issue: null }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoadIssue, setProfileLoadIssue] = useState<'missing_table' | 'not_found' | null>(null)

  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) {
      setProfile(null)
      setProfileLoadIssue(null)
      return
    }
    const res = await fetchProfile(session.user.id)
    setProfile(res.profile)
    setProfileLoadIssue(res.issue)
  }, [session?.user?.id])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    const supabase = getSupabase()
    if (!supabase) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    void refreshProfile()
  }, [refreshProfile])

  const signUp = useCallback(
    async ({ username, password, displayName }: { username: string; password: string; displayName: string }) => {
      const uErr = validateUsername(username)
      if (uErr) return { ok: false as const, error: uErr }
      const pErr = validatePassword(password)
      if (pErr) return { ok: false as const, error: pErr }
      const supabase = getSupabase()
      if (!supabase) return { ok: false as const, error: 'Supabase is not configured.' }

      const email = usernameToAuthEmail(username)
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username.trim(),
            display_name: displayName.trim() || username.trim(),
          },
        },
      })
      if (error) return { ok: false as const, error: error.message }
      return { ok: true as const }
    },
    [],
  )

  const signIn = useCallback(async (username: string, password: string) => {
    const uErr = validateUsername(username)
    if (uErr) return { ok: false as const, error: uErr }
    const supabase = getSupabase()
    if (!supabase) return { ok: false as const, error: 'Supabase is not configured.' }

    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToAuthEmail(username),
      password,
    })
    if (error) return { ok: false as const, error: error.message }
    return { ok: true as const }
  }, [])

  const signOut = useCallback(async () => {
    const supabase = getSupabase()
    if (supabase) await supabase.auth.signOut()
    setProfile(null)
    setProfileLoadIssue(null)
  }, [])

  const updateProfile = useCallback(
    async (patch: {
      display_name?: string
      avatar_url?: string | null
      preferences?: Record<string, unknown>
    }) => {
      if (!session?.user?.id) return { ok: false as const, error: 'Not signed in.' }
      const supabase = getSupabase()
      if (!supabase) return { ok: false as const, error: 'Supabase unavailable.' }
      const { error } = await supabase.from('profiles').update(patch).eq('id', session.user.id)
      if (error) return { ok: false as const, error: error.message }
      await refreshProfile()
      return { ok: true as const }
    },
    [session?.user?.id, refreshProfile],
  )

  const updatePassword = useCallback(async (password: string) => {
    const pErr = validatePassword(password)
    if (pErr) return { ok: false as const, error: pErr }
    const supabase = getSupabase()
    if (!supabase) return { ok: false as const, error: 'Supabase unavailable.' }
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return { ok: false as const, error: error.message }
    return { ok: true as const }
  }, [])

  const value = useMemo(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      profile,
      profileLoadIssue,
      authConfigured: isSupabaseConfigured,
      signUp,
      signIn,
      signOut,
      refreshProfile,
      updateProfile,
      updatePassword,
    }),
    [
      loading,
      session,
      profile,
      profileLoadIssue,
      signUp,
      signIn,
      signOut,
      refreshProfile,
      updateProfile,
      updatePassword,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
