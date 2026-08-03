import { useState, useEffect, useCallback } from 'react'
import { parsePath, buildPath, DEFAULT_LANG } from '../routes.js'
import { getLang } from '../i18n/translations.js'

/**
 * Langue à employer pour fabriquer les liens : même précédence que
 * i18n/translations.js — un préfixe explicite dans l'URL l'emporte, sinon on suit
 * la langue affichée (une URL française sans préfixe reste consultable en
 * allemand par qui a choisi l'allemand).
 */
function effectiveLang(pathname) {
  const { lang } = parsePath(pathname)
  return lang !== DEFAULT_LANG ? lang : getLang()
}

/**
 * Route courante, dérivée de l'URL — source unique de vérité pour les écrans qui
 * ont une adresse (docs publiques, administration).
 *
 * Remplace les tests dispersés sur `window.location.pathname` et, surtout, ajoute
 * l'écoute de `popstate` qui manquait : le bouton Retour poussait une entrée
 * d'historique sans que rien ne réagisse, laissant l'URL et l'écran désaccordés.
 */
export function useRoute() {
  const [path, setPath] = useState(() => window.location.pathname)

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const go = useCallback((route, { param = null, replace = false } = {}) => {
    const next = buildPath(route, { lang: effectiveLang(window.location.pathname), param })
    if (next !== window.location.pathname) {
      const url = next + window.location.search
      if (replace) window.history.replaceState({}, '', url)
      else         window.history.pushState({}, '', url)
    }
    setPath(next)
  }, [])

  const navigate = useCallback((route, opts) => go(route, opts), [go])
  const replace  = useCallback((route, opts) => go(route, { ...opts, replace: true }), [go])

  return { ...parsePath(path), lang: effectiveLang(path), path, navigate, replace }
}

export default useRoute
