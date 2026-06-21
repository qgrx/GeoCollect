/**
 * Validation de réponse de quiz côté client — utilisée par le mode démo (sans
 * compte), qui valide les réponses dans le navigateur. Logique miroir du backend
 * (geocards-api/src/utils/answer.js) : si l'un change, mettre l'autre à jour.
 */

// Normalise une chaîne pour comparaison tolérante (accents, casse, ponctuation).
export const normalize = s =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// Toutes les réponses acceptées : principale, alternatives, et traductions.
export function expectedAnswers(question) {
  const list = [question?.answer, ...(question?.alt_answers || [])]
  const translations = question?.translations || {}
  for (const tr of Object.values(translations)) {
    if (tr?.answer) list.push(tr.answer)
  }
  return list.filter(Boolean)
}

// Vrai si `userAnswer` correspond (après normalisation) à une réponse attendue.
export function isCorrectAnswer(question, userAnswer) {
  const userN = normalize(userAnswer)
  if (!userN) return false
  return expectedAnswers(question).some(a => normalize(a) === userN)
}
