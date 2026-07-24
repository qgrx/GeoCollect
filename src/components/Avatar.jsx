/**
 * Avatar — pastille ronde du joueur.
 *  - Si le profil geocaching est vérifié ET a une photo → affiche la photo,
 *    entourée d'un liseré vert + petit badge geocaching « vérifié ».
 *  - Sinon → initiale du pseudo sur dégradé (repli si la photo ne charge pas).
 *  - onAddPhoto (avatar du joueur uniquement) : petite icône 📷 invitant à
 *    importer sa photo de profil geocaching. Masquée dès que le compte est
 *    vérifié, SAUF si forcePhoto est vrai (popup « Mon compte », pour
 *    ré-importer une photo).
 */
import { useState } from 'react'
import GeocachingBadge from './GeocachingBadge.jsx'

// Anneau lumineux animé du halo « mécénat » — glow coloré qui respire et dérive
// légèrement (effet stylé), pensé pour ressortir sur fond foncé. Une seule keyframe
// pour toutes les couleurs (couleur passée via la variable CSS --h).
const AVATAR_HALO_KEYFRAMES = `@keyframes gcAvatarHalo{
  0%,100%{box-shadow:0 0 3px 1px var(--h),0 0 8px 2px var(--h);transform:translate(.5px,-.5px) scale(1);opacity:.85}
  50%    {box-shadow:0 0 6px 2px var(--h),0 0 14px 5px var(--h);transform:translate(-.5px,.5px) scale(1.03);opacity:1}
}`

export default function Avatar({
  pseudo, avatarUrl = null, verified = false, size = 48,
  gradient = 'linear-gradient(135deg,#6c5ce7,#a29bfe)', glow = null, halo = null,
  onAddPhoto = null, addPhotoTitle = '', forcePhoto = false, style = {},
}) {
  const [imgError, setImgError] = useState(false)
  const letter = (pseudo || '?')[0]?.toUpperCase() || '?'
  const showImg = Boolean(avatarUrl) && !imgError
  const badge = Math.max(13, Math.round(size * 0.34))

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0, ...style }}>
      {halo && (
        <>
          <style>{AVATAR_HALO_KEYFRAMES}</style>
          <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: '50%', pointerEvents: 'none',
            '--h': halo, animation: 'gcAvatarHalo 2.6s ease-in-out infinite' }}/>
        </>
      )}
      <div style={{
        position: 'relative',
        width: size, height: size, borderRadius: '50%', overflow: 'hidden',
        background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(size * 0.42), fontWeight: 900, color: '#fff',
        border: verified ? '2px solid #17a86a' : (halo ? `2px solid ${halo}` : '2px solid #ffffff33'),
        boxShadow: glow ? `0 0 ${Math.round(size * 0.3)}px ${glow}88, 0 4px 12px #0008` : 'none',
      }}>
        {showImg
          ? <img src={avatarUrl} alt="" loading="lazy"
              onError={() => setImgError(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : letter}
      </div>

      {verified && (
        <span style={{ position: 'absolute', right: -3, top: -3, lineHeight: 0 }}>
          <GeocachingBadge size={badge} />
        </span>
      )}

      {/* Icône photo : masquée dès que le compte est vérifié, sauf forcePhoto
          (popup « Mon compte », pour ré-importer une photo). */}
      {onAddPhoto && (forcePhoto || !verified) && (
        <button onClick={(e) => { e.stopPropagation(); onAddPhoto(e) }} title={addPhotoTitle} aria-label={addPhotoTitle}
          style={{
            position: 'absolute', right: -4, bottom: -4, width: badge + 8, height: badge + 8,
            borderRadius: '50%', background: 'linear-gradient(135deg,#02874D,#17a86a)',
            border: '2px solid #fff', color: '#fff', cursor: 'pointer', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: Math.round(badge * 0.62), lineHeight: 1, boxShadow: '0 2px 6px #0006',
          }}>📷</button>
      )}
    </div>
  )
}
