/**
 * Client Supabase — singleton partagé dans toute l'app.
 *
 * Variables d'environnement requises dans .env.local :
 *   VITE_SUPABASE_URL=https://xxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY=eyJ...
 *
 * Ces valeurs sont publiques (restreintes par Row Level Security).
 * Ne jamais mettre la SERVICE_KEY côté frontend.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    '[Geocoins] Variables Supabase manquantes.\n' +
    'Crée src/.env.local avec VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.\n' +
    'L\'app tourne en mode local (pas de persistance).'
  )
}

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,          // stocke la session dans localStorage
        autoRefreshToken: true,        // refresh automatique avant expiration
        detectSessionInUrl: true,      // gère le callback OAuth (URL fragment)
      },
    })
  : null  // mode dégradé sans Supabase (prototype local)
