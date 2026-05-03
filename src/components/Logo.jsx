/**
 * Logo Geocoins — pin de géolocalisation avec rose des vents.
 * Utilisé dans le header et l'écran de chargement.
 *
 * Props:
 *   iconSize  — hauteur du pin SVG en px (défaut 34)
 *   textSize  — taille de la police du texte en px (défaut 22)
 *   showText  — afficher "geocoins" à côté du logo (défaut true)
 *   dim       — réduire l'opacité pour l'écran de chargement (défaut false)
 */
export default function Logo({ iconSize = 34, textSize = 22, showText = true, dim = false }) {
  // IDs uniques pour éviter les conflits si le logo est monté plusieurs fois
  const uid = dim ? 'logo-dim' : 'logo-main'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0,
      opacity: dim ? 0.22 : 1,
    }}>
      {/* ── Icône SVG ── */}
      <svg
        width={iconSize * 0.82}
        height={iconSize}
        viewBox="0 0 32 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Dégradé du pin : vert geocaching */}
          <linearGradient id={`${uid}-pin`} x1="16" y1="0" x2="16" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#33c97a"/>
            <stop offset="100%" stopColor="#005C35"/>
          </linearGradient>

          {/* Brillance sur la gauche du pin */}
          <radialGradient id={`${uid}-shine`} cx="35%" cy="30%" r="55%">
            <stop offset="0%"   stopColor="#fff" stopOpacity="0.18"/>
            <stop offset="100%" stopColor="#fff" stopOpacity="0"/>
          </radialGradient>

          {/* Dégradé de la gemme centrale */}
          <radialGradient id={`${uid}-gem`} cx="40%" cy="35%" r="60%">
            <stop offset="0%"   stopColor="#fff9c4"/>
            <stop offset="60%"  stopColor="#f9ca24"/>
            <stop offset="100%" stopColor="#e17055"/>
          </radialGradient>

          {/* Ombre portée du pin */}
          <filter id={`${uid}-shadow`} x="-20%" y="-10%" width="140%" height="130%">
            <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#005C35" floodOpacity="0.45"/>
          </filter>
        </defs>

        {/* Ombre sous la pointe */}
        <ellipse cx="16" cy="39" rx="5.5" ry="1.2" fill="#000" opacity="0.18"/>

        {/* Corps du pin */}
        <path
          d="M16 1C8.27 1 2 7.27 2 15C2 24.4 16 39 16 39C16 39 30 24.4 30 15C30 7.27 23.73 1 16 1Z"
          fill={`url(#${uid}-pin)`}
          filter={`url(#${uid}-shadow)`}
        />

        {/* Brillance du pin */}
        <path
          d="M16 1C8.27 1 2 7.27 2 15C2 24.4 16 39 16 39C16 39 30 24.4 30 15C30 7.27 23.73 1 16 1Z"
          fill={`url(#${uid}-shine)`}
        />

        {/* Cercle intérieur sombre */}
        <circle cx="16" cy="15" r="10.5" fill="#12001a"/>
        <circle cx="16" cy="15" r="9.5"  fill="#1a1a2e"/>

        {/* Anneau de cadran */}
        <circle cx="16" cy="15" r="9" stroke="#f9ca2430" strokeWidth="0.6" fill="none"/>

        {/* Croix du cadran (lignes fines) */}
        <line x1="16" y1="7"  x2="16" y2="23" stroke="#f9ca2418" strokeWidth="0.7"/>
        <line x1="8"  y1="15" x2="24" y2="15" stroke="#f9ca2418" strokeWidth="0.7"/>

        {/* ── Rose des vents ── */}
        {/* Nord — flèche dorée (la plus grande) */}
        <polygon points="16,6.5 17.8,14 16,12 14.2,14" fill="#f9ca24"/>
        {/* Sud — flèche or atténuée */}
        <polygon points="16,23.5 17.8,16 16,18 14.2,16" fill="#f9ca24" opacity="0.45"/>
        {/* Est */}
        <polygon points="24.5,15 17,13.2 19,15 17,16.8" fill="#f9ca24" opacity="0.45"/>
        {/* Ouest */}
        <polygon points="7.5,15 15,13.2 13,15 15,16.8" fill="#f9ca24" opacity="0.45"/>

        {/* Points cardinaux intermédiaires */}
        <circle cx="22.4" cy="7.6"  r="0.7" fill="#f9ca24" opacity="0.3"/>
        <circle cx="9.6"  cy="7.6"  r="0.7" fill="#f9ca24" opacity="0.3"/>
        <circle cx="22.4" cy="22.4" r="0.7" fill="#f9ca24" opacity="0.3"/>
        <circle cx="9.6"  cy="22.4" r="0.7" fill="#f9ca24" opacity="0.3"/>

        {/* Gemme centrale */}
        <circle cx="16" cy="15" r="2.8" fill={`url(#${uid}-gem)`}/>
        <circle cx="15.1" cy="14.1" r="0.9" fill="#fff" opacity="0.55"/>
      </svg>

      {/* ── Texte ── */}
      {showText && (
        <span style={{
          fontFamily: "'Fredoka One', sans-serif",
          fontSize: textSize,
          fontWeight: 400,
          letterSpacing: 0.5,
          background: 'linear-gradient(135deg, #f9ca24 0%, #ffed8a 45%, #e17055 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          filter: dim ? 'none' : 'drop-shadow(0 1px 8px #f9ca2466)',
          lineHeight: 1,
          paddingBottom: 3,
          userSelect: 'none',
        }}>
          geocoins
        </span>
      )}
    </div>
  )
}
