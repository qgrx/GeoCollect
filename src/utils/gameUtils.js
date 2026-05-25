import { RARITY_CONFIG } from '../data/cards.js';

export const normA = (s) =>
  s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').trim();

export const wordCount = (s) => s.trim().split(/\s+/).filter(Boolean).length;

export const DEFAULT_SHINY_SCORE_RULES = { commun: 2, rare: 6, épique: 14, légendaire: 40 }

export function collScore(col, pool, shinyCol = {}, rules = { commun: 1, rare: 3, épique: 7, légendaire: 20 }, shinyRules = DEFAULT_SHINY_SCORE_RULES) {
  const normal = Object.entries(col).reduce((sum, [id, n]) => {
    if (!n) return sum
    const c = pool.find(x => x.id === +id)
    return sum + (rules[c?.rarity] || 1)
  }, 0)
  const shiny = Object.entries(shinyCol).reduce((sum, [id, n]) => {
    if (!n) return sum
    const c = pool.find(x => x.id === +id)
    return sum + (shinyRules[c?.rarity] ?? (rules[c?.rarity] || 1) * 2)
  }, 0)
  return normal + shiny
}

// Fonctions utilitaires partagées entre les packs
function _byRarity(cardPool, r) { return cardPool.filter(c => c.rarity === r && c.type !== 'Achievement') }
function _pick(arr, fallback) { return arr.length ? arr[Math.floor(Math.random() * arr.length)] : fallback }

// ─── Petit soutien : 2 communs, 2 rares, 1 épique ou rare (50/50) ─────────────
export function drawPackSmall(cardPool) {
  const comm = _byRarity(cardPool, 'commun')
  const rare = _byRarity(cardPool, 'rare')
  const epic = _byRarity(cardPool, 'épique')
  const cards = []
  for (let i = 0; i < 2; i++) cards.push(_pick(comm, _pick(cardPool)))
  for (let i = 0; i < 2; i++) cards.push(_pick(rare, _pick(cardPool)))
  cards.push(Math.random() < 0.5 ? _pick(epic, _pick(rare)) : _pick(rare, _pick(cardPool)))
  return cards
}

// ─── Soutien : 6 communs, 2 rares, 1 épique ou rare (50/50), 1 légen. ou épi. (50/50) ──
export function drawPackMedium(cardPool) {
  const comm = _byRarity(cardPool, 'commun')
  const rare = _byRarity(cardPool, 'rare')
  const epic = _byRarity(cardPool, 'épique')
  const leg  = _byRarity(cardPool, 'légendaire')
  const cards = []
  for (let i = 0; i < 6; i++) cards.push(_pick(comm, _pick(cardPool)))
  for (let i = 0; i < 2; i++) cards.push(_pick(rare, _pick(cardPool)))
  cards.push(Math.random() < 0.5 ? _pick(epic, _pick(rare)) : _pick(rare, _pick(cardPool)))
  cards.push(Math.random() < 0.5 ? _pick(leg, _pick(epic)) : _pick(epic, _pick(rare)))
  return cards
}

// ─── Gros soutien : 6 communs, 2 rares, 1 épique garantie, 1 légendaire garantie ──
export function drawPackLarge(cardPool) {
  const comm = _byRarity(cardPool, 'commun')
  const rare = _byRarity(cardPool, 'rare')
  const epic = _byRarity(cardPool, 'épique')
  const leg  = _byRarity(cardPool, 'légendaire')
  const cards = []
  for (let i = 0; i < 6; i++) cards.push(_pick(comm, _pick(cardPool)))
  for (let i = 0; i < 2; i++) cards.push(_pick(rare, _pick(cardPool)))
  cards.push(_pick(epic, _pick(rare)))
  cards.push(_pick(leg, _pick(epic)))
  return cards
}

// Rétrocompatibilité
export function drawPackCards(cardPool) { return drawPackMedium(cardPool) }

// ─── Tirage depuis une config de slots ───────────────────────────────────────
// slot: { rarity, qty?, alt?, chance? }
//   rarity  : rareté principale (garantie si pas de alt)
//   qty     : nombre de cartes de ce type (défaut 1)
//   alt     : rareté de repli (si défini → chance % d'obtenir rarity, sinon alt)
//   chance  : probabilité en % d'obtenir rarity (défaut 50)
export function drawPackFromConfig(cardPool, slots) {
  const eligible = cardPool.filter(c => !c.forgeable && !c.type?.toLowerCase().startsWith('achievement'))
  const by   = r   => eligible.filter(c => c.rarity === r)
  const pick = arr => arr.length ? arr[Math.floor(Math.random() * arr.length)] : eligible[Math.floor(Math.random() * eligible.length)]
  const cards = []
  for (const s of (slots || [])) {
    for (let i = 0; i < (s.qty || 1); i++) {
      const rarity = s.alt
        ? (Math.random() * 100 < (s.chance ?? 50) ? s.rarity : s.alt)
        : s.rarity
      cards.push(pick(by(rarity)))
    }
  }
  return cards
}

const R_ICON  = { légendaire: '🟠', épique: '🟣', rare: '🔵', commun: '⚪' }
const R_LABEL = { légendaire: 'Légendaire', épique: 'Épique', rare: 'Rare', commun: 'Commun' }

// Convertit une liste de slots en libellés affichables
// t est optionnel : si fourni, utilise les clés i18n pack_guaranteed / pack_or_higher / pack_chance_note
export function slotsToContents(slots, t) {
  return (slots || []).map(s => {
    const qty = s.qty || 1
    const rKey   = r => 'rarity_' + r.replace(/[éèêëàâùûîïôœæç]/g, c => ({ é:'e',è:'e',ê:'e',ë:'e',à:'a',â:'a',ù:'u',û:'u',î:'i',ï:'i',ô:'o',œ:'oe',æ:'ae',ç:'c' })[c] || c)
    const rLabel = r => (t ? t(rKey(r)) : null) || R_LABEL[r] || r
    if (s.alt) {
      const label = t
        ? t('pack_or_higher').replace('{qty}', qty).replace('{rarity}', rLabel(s.alt))
        : `${qty} ${R_LABEL[s.alt] || s.alt} ou supérieure`
      const note = t
        ? t('pack_chance_note').replace('{pct}', s.chance ?? 50).replace('{rarity}', rLabel(s.rarity))
        : `${s.chance ?? 50}% ${R_LABEL[s.rarity] || s.rarity}`
      return { icon: R_ICON[s.alt] || '⚪', label, note }
    }
    const label = t
      ? t('pack_guaranteed').replace('{qty}', qty).replace('{rarity}', rLabel(s.rarity))
      : `${qty} ${R_LABEL[s.rarity] || s.rarity}${qty > 1 ? 's' : ''} garanti${qty > 1 ? 's' : 'e'}`
    return { icon: R_ICON[s.rarity] || '⚪', label }
  })
}

// Génère une miniature parfaite (100x140) centrée sur le haut de l'image (cover 25%)
export function createCardThumbnail(file, targetWidth = 100, targetHeight = 140) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');

      // Cadrage "cover" avec centrage
      const imgRatio = img.width / img.height;
      const targetRatio = targetWidth / targetHeight;
      if (imgRatio > targetRatio) {
        const drawWidth = img.height * targetRatio;
        const offsetX = (img.width - drawWidth) / 2;
        ctx.drawImage(img, offsetX, 0, drawWidth, img.height, 0, 0, targetWidth, targetHeight);
      } else {
        const drawHeight = img.width / targetRatio;
        const offsetY = (img.height - drawHeight) * 0.25; // Focus sur le haut (comme le CSS 25%)
        ctx.drawImage(img, 0, offsetY, img.width, drawHeight, 0, 0, targetWidth, targetHeight);
      }

      canvas.toBlob(blob => {
        // Remplace l'extension d'origine par _thumb.webp
        const newName = file.name.replace(/\.[^/.]+$/, "") + "_thumb.webp";
        const newFile = new File([blob], newName, { type: 'image/webp' });
        resolve(newFile);
      }, 'image/webp', 0.85); // WebP à 85% = qualité parfaite et poids minuscule (< 5ko)
    };
    img.onerror = error => reject(error);
  });
}
