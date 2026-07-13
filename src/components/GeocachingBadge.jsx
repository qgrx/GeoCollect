/**
 * GeocachingBadge — petit logo affiché à côté du pseudo d'un joueur dont le
 * profil geocaching.com a été vérifié (lien de parrainage retrouvé sur son
 * profil). Vert « geocaching » + pastille de vérification.
 */
import { useT } from '../i18n/translations.js'

export default function GeocachingBadge({ size = 15, style = {} }) {
  const { t } = useT()
  const title = t('gc_verified_badge')
  return (
    <span
      title={title}
      aria-label={title}
      style={{ display: 'inline-flex', verticalAlign: 'middle', lineHeight: 0, ...style }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
        xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
        {/* Pastille verte geocaching */}
        <circle cx="12" cy="12" r="11" fill="#02874D" stroke="#ffffff40" strokeWidth="1" />
        {/* Repère / point de cache stylisé */}
        <path d="M12 5.2c-2.6 0-4.7 2.1-4.7 4.7 0 3.3 4.7 8.4 4.7 8.4s4.7-5.1 4.7-8.4c0-2.6-2.1-4.7-4.7-4.7z"
          fill="#ffffff" />
        <circle cx="12" cy="9.9" r="1.9" fill="#02874D" />
      </svg>
    </span>
  )
}
