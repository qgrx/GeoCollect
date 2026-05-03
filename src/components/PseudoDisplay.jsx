/**
 * PseudoDisplay — affiche un pseudo avec l'effet brillant si rang maximum.
 * Props: pseudo, score, ranks, style, className
 */
import { useMemo } from 'react'

export function getRank(score, ranks) {
  if (!ranks?.length) return null
  return [...ranks].sort((a, b) => b.min - a.min).find(r => score >= r.min) || ranks[0]
}

export function isTopRank(score, ranks) {
  if (!ranks?.length) return false
  const top = [...ranks].sort((a, b) => b.min - a.min)[0]
  return score >= top.min
}

export default function PseudoDisplay({ pseudo, score, ranks, style = {}, tag = 'span' }) {
  const top = useMemo(() => isTopRank(score, ranks), [score, ranks])
  const rank = useMemo(() => getRank(score, ranks), [score, ranks])

  const Tag = tag
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
      <Tag className={top ? 'pseudo-shine' : ''} style={style}>
        {pseudo}
      </Tag>
    </>
  )
}
