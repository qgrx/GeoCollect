import { RARITY_CONFIG } from '../data/cards.js';

export const normA = (s) =>
  s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').trim();

export const wordCount = (s) => s.trim().split(/\s+/).filter(Boolean).length;

export function collScore(col, pool) {
  return Object.entries(col).reduce((sum, [id, n]) => {
    if (!n) return sum;
    const c = pool.find(x => x.id === +id);
    if (!c) return sum;
    return sum + ({ commun: 1, rare: 3, épique: 7, légendaire: 20 }[c.rarity] || 1);
  }, 0);
}

export function drawPackCards(cardPool) {
  const byRarity = (r) => cardPool.filter(c => c.rarity === r && c.type !== 'Achievement');
  const pick     = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const cards    = [];
  const comm = byRarity('commun');
  const rare = byRarity('rare');
  for (let i = 0; i < 6; i++) cards.push(pick(comm) || pick(cardPool));
  for (let i = 0; i < 2; i++) cards.push(pick(rare) || pick(cardPool));
  cards.push(Math.random() < 0.5 ? (pick(byRarity('épique')) || pick(rare)) : pick(rare));
  cards.push(Math.random() < 0.2 ? (pick(byRarity('légendaire')) || pick(rare)) : pick(rare));
  return cards;
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
      let drawWidth = targetWidth;
      let drawHeight = targetHeight;
      let offsetX = 0;
      let offsetY = 0;

      if (imgRatio > targetRatio) {
        drawWidth = img.height * targetRatio;
        offsetX = (img.width - drawWidth) / 2;
        ctx.drawImage(img, offsetX, 0, drawWidth, img.height, 0, 0, targetWidth, targetHeight);
      } else {
        drawHeight = img.width / targetRatio;
        offsetY = (img.height - drawHeight) * 0.25; // Focus sur le haut (comme le CSS 25%)
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
