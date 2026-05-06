export function getRank(score, ranks) {
  if (!ranks?.length) return null
  return [...ranks].sort((a, b) => b.min - a.min).find(r => score >= r.min) || ranks[0]
}

export function isTopRank(score, ranks) {
  if (!ranks?.length) return false
  const top = [...ranks].sort((a, b) => b.min - a.min)[0]
  return score >= top.min
}
