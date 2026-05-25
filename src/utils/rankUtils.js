export function getRank(score, ranks) {
  if (!ranks?.length) return null
  return [...ranks].sort((a, b) => b.min - a.min).find(r => score >= r.min) || ranks[0]
}

export function isTopRank(score, ranks) {
  if (!ranks?.length) return false
  const top = [...ranks].sort((a, b) => b.min - a.min)[0]
  return score >= top.min
}

export function getRankLabel(rank, lang = 'fr') {
  return rank?.labels?.[lang] || rank?.label || ''
}

// Dérive une paire de couleurs (c1, c2) depuis la couleur d'un rang
export function rankCC(rank) {
  const c1 = rank?.color || '#78909c'
  const num = parseInt(c1.replace('#', ''), 16)
  const r = Math.min(255, (num >> 16) + 55)
  const g = Math.min(255, ((num >> 8) & 0xff) + 55)
  const b = Math.min(255, (num & 0xff) + 55)
  const c2 = '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')
  return { c1, c2 }
}
