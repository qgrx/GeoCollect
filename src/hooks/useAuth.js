/**
 * useAuth — gestion de session.
 *
 * Si VITE_SUPABASE_URL est défini → Supabase réel.
 * Sinon → mode local (state React, pas de persistance).
 *
 * Les deux chemins exposent la même interface :
 *   { user, profile, loading, signInWithGoogle, signInWithEmail,
 *     signUpWithEmail, signOut, updatePseudo }
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { apiDeleteAccount } from '../services/api.js'

// ─── Hook unique — branch au runtime, pas au niveau hook ──────────────────────
export function useAuth() {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  const loadProfile = useCallback(async (supaUser) => {
    if (!supabase || !supaUser) return
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', supaUser.id)
      .single()

    const makeFallback = () => ({
      id: supaUser.id,
      pseudo: supaUser.user_metadata?.full_name?.split(' ')[0]
        || supaUser.email?.split('@')[0]
        || 'Joueur',
      email: supaUser.email,
      role: 'user', gold: 300, pseudo_history: [], pseudo_changed_at: null,
    })
    if (error && (error.code === 'PGRST116' || error.code === '406')) {
      await new Promise(r => setTimeout(r, 800))
      const { data: created } = await supabase
        .from('profiles').select('*').eq('id', supaUser.id).single()
      if (mounted.current) setProfile(created ?? makeFallback())
    } else if (error) {
      console.warn('[Auth] profile error, creating fallback:', error.message)
      if (mounted.current) setProfile(makeFallback())
    } else {
      if (mounted.current) setProfile(data ?? null)
    }
  }, [])

  useEffect(() => {
    if (!supabase) return

    let cancelled = false

    // Session existante au démarrage
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user).finally(() => {
          if (!cancelled) setLoading(false)
        })
      } else {
        setLoading(false)
      }
    })

    // Écouter login / logout / token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      setUser(session?.user ?? null)
      loadProfile(session?.user ?? null)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [loadProfile])

  // ── Actions ────────────────────────────────────────────────────────────────

  const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin

  const signInWithGoogle = useCallback(async () => {
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: APP_URL,
        queryParams: { prompt: 'select_account' },
      },
    })
  }, [])

  const signInWithFacebook = useCallback(async () => {
    return supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: { redirectTo: APP_URL },
    })
  }, [])

  const signInWithEmail = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }, [])

  const signUpWithEmail = useCallback(async (email, password, pseudo) => {
    // Vérifier unicité du pseudo
    const { data: existing } = await supabase
      .from('profiles').select('id').ilike('pseudo', pseudo).maybeSingle()
    if (existing) return { error: { message: 'pseudo_taken' } }

    // Vérifier la liste blanche de domaines
    const { data: wlData } = await supabase
      .from('config').select('value').eq('key', 'registration_whitelist').maybeSingle()
    const whitelist = wlData?.value
    if (whitelist?.enabled && Array.isArray(whitelist?.domains) && whitelist.domains.length > 0) {
      const domain = email.split('@')[1]?.toLowerCase().trim()
      if (!domain || !whitelist.domains.includes(domain)) {
        return { error: { message: 'domain_not_allowed' } }
      }
    }

    const locale = (() => { try { return localStorage.getItem('geocards_lang') || 'fr' } catch { return 'fr' } })()

    return supabase.auth.signUp({
      email, password,
      options: {
        data: { pseudo, locale },
        emailRedirectTo: APP_URL,
      },
    })
  }, [])

  const resetPassword = useCallback(async (email) => {
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${APP_URL}?reset=1`,
    })
  }, [])

  const updatePassword = useCallback(async (newPassword) => {
    return supabase.auth.updateUser({ password: newPassword })
  }, [])

  const deactivateAccount = useCallback(async () => {
    if (!user) return { error: { message: 'not_authenticated' } }
    // Utilise l'API backend pour le soft-delete (deleted_at + status)
    const { error } = await apiDeleteAccount()
    if (!error) {
      await supabase.auth.signOut()
      setUser(null); setProfile(null)
    }
    return { error }
  }, [user])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (!error) { setUser(null); setProfile(null) }
    return { error }
  }, [])

  const updatePseudo = useCallback(async (newPseudo) => {
    if (!user) return { error: { message: 'not_authenticated' } }

    // Vérifier unicité
    const { data: existing } = await supabase
      .from('profiles').select('id').ilike('pseudo', newPseudo).neq('id', user.id).maybeSingle()
    if (existing) return { error: { message: 'pseudo_taken' } }

    const newHistory = [
      ...(profile?.pseudo_history || []),
      { pseudo: newPseudo, date: new Date().toLocaleDateString('fr-FR') },
    ]
    const { data, error } = await supabase
      .from('profiles')
      .update({ pseudo: newPseudo, pseudo_changed_at: new Date().toISOString(), pseudo_history: newHistory })
      .eq('id', user.id)
      .select().single()

    if (!error && mounted.current) setProfile(data)
    return { error }
  }, [user, profile])

  return { user, profile, setProfile, loading, signInWithGoogle, signInWithFacebook, signInWithEmail, signUpWithEmail, signOut, updatePseudo, resetPassword, updatePassword, deactivateAccount }
}
