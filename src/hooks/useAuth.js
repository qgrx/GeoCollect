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
import { apiDeleteAccount, apiDemoPromote } from '../services/api.js'

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
      // Une nouvelle connexion réinitialise les bannières masquées temporairement
      // (mais pas un simple rechargement de page, qui déclenche INITIAL_SESSION)
      if (event === 'SIGNED_IN') {
        try { localStorage.removeItem('geocoins_discord_banner_dismissed_until') } catch { /* ignore */ }
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [loadProfile])

  // ── Actions ────────────────────────────────────────────────────────────────

  const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin

  // Mode démo : compte ANONYME Supabase (is_anonymous=true). Le joueur gagne 5
  // geocoins sans compte ; converti en compte définitif via convertAnonymous.
  // On fournit un pseudo temporaire dans les métadonnées (comme signUpWithEmail) :
  // le trigger handle_new_user en a besoin pour créer le profil (pseudo NOT NULL),
  // sinon la création du user anonyme échoue (500).
  const signInAnonymously = useCallback(async () => {
    const tempPseudo = `Invité_${Math.random().toString(36).slice(2, 7)}`
    const locale = (() => { try { return localStorage.getItem('geocards_lang') || 'fr' } catch { return 'fr' } })()
    return supabase.auth.signInAnonymously({ options: { data: { pseudo: tempPseudo, locale } } })
  }, [])

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

  const signUpWithEmail = useCallback(async (email, password) => {
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
    // Pseudo temporaire — remplacé lors de l'onboarding (trigger DB requiert une valeur non nulle)
    const tempPseudo = `user_${Math.random().toString(36).slice(2, 8)}`
    // Parrainage : on attache le code au compte lui-même pour que l'attribution
    // survive même si l'email est validé depuis un autre appareil/navigateur.
    const ref = (() => { try { return localStorage.getItem('geocoins_ref') || '' } catch { return '' } })()

    return supabase.auth.signUp({
      email, password,
      options: {
        data: { pseudo: tempPseudo, locale, ...(ref ? { ref } : {}) },
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

  // Convertit le compte démo anonyme en compte définitif (même id → les geocoins
  // gagnés sont conservés) : email + mot de passe, pseudo, puis sortie du mode démo.
  const convertAnonymous = useCallback(async (email, password, newPseudo) => {
    if (!user) return { error: { message: 'not_authenticated' } }
    const { error: upErr } = await supabase.auth.updateUser({ email, password })
    if (upErr) return { error: upErr }
    if (newPseudo) {
      const { error: pErr } = await updatePseudo(newPseudo)
      if (pErr) return { error: pErr }
    }
    await apiDemoPromote().catch(() => {})
    await loadProfile(user)
    return { error: null }
  }, [user, updatePseudo, loadProfile])

  // Mode démo = utilisateur anonyme (fiable dès la connexion, avant même que le
  // backend ne pose is_demo). Sert à l'aiguillage de l'UI (démo vs jeu complet).
  const isDemo = !!user?.is_anonymous

  return { user, profile, setProfile, loading, isDemo, signInAnonymously, convertAnonymous, signInWithGoogle, signInWithFacebook, signInWithEmail, signUpWithEmail, signOut, updatePseudo, resetPassword, updatePassword, deactivateAccount }
}
