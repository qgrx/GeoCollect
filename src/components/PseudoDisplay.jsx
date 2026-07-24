/**
 * PseudoDisplay — affiche un pseudo avec l'effet brillant si rang maximum.
 * Props: pseudo, score, ranks, style, className
 */
import { useMemo } from 'react'
import { getRank, isTopRank } from '../utils/rankUtils.js'

export default function PseudoDisplay({ pseudo, score, ranks, style = {}, tag = 'span', halo = null }) {
  const top = useMemo(() => isTopRank(score, ranks), [score, ranks])
  const rank = useMemo(() => getRank(score, ranks), [score, ranks])

  const Tag = tag
  // Halo « mécénat » : lueur colorée autour du pseudo (drop-shadow → fonctionne aussi
  // avec l'effet brillant du rang max, qui rend le texte transparent).
  const haloStyle = halo ? { filter: `drop-shadow(0 0 4px ${halo}) drop-shadow(0 0 9px ${halo}cc)` } : null
  return (
    <>
      {top && (
        <style>{`
          @keyframes pseudoShine {
            0%   { background-position: -200% center; }
            100% { background-position:  200% center; }
          }
          .pseudo-shine {
            background: linear-gradient(90deg, ${rank?.color||'#f9ca24'} 0%, #fff 40%, ${rank?.color||'#f9ca24'} 60%, #fff 80%, ${rank?.color||'#f9ca24'} 100%);
            background-size: 200% auto;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            animation: pseudoShine 2.5s linear infinite;
            filter: drop-shadow(0 0 6px ${rank?.color||'#f9ca24'}88);
          }
        `}</style>
      )}
      <Tag className={top ? 'pseudo-shine' : ''} style={{ ...style, ...haloStyle }}>
        {pseudo}
      </Tag>
    </>
  )
}
