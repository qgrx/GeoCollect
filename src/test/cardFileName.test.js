import { describe, it, expect } from 'vitest';
import { cardNameFromFile, MAX_CARD_NAME } from '../utils/cardFileName.js';

describe('cardNameFromFile', () => {
  it('retire l’extension', () => {
    expect(cardNameFromFile('frostpike.png')).toBe('Frostpike');
    expect(cardNameFromFile('photo.final.webp')).toBe('Photo.final');
  });

  it('remplace les underscores par des espaces', () => {
    expect(cardNameFromFile('ile_de_re.png')).toBe('Ile de re');
  });

  it('met une majuscule à la première lettre seulement', () => {
    expect(cardNameFromFile('mont saint michel.png')).toBe('Mont saint michel');
    expect(cardNameFromFile('ÎLE_DE_RÉ.png')).toBe('ÎLE DE RÉ');
  });

  it('nettoie les espaces superflus', () => {
    expect(cardNameFromFile('  _ tour  eiffel _ .png')).toBe('Tour eiffel');
  });

  it('respecte la longueur maximale de la colonne', () => {
    const long = cardNameFromFile(`${'a'.repeat(80)}.png`);
    expect(long).toHaveLength(MAX_CARD_NAME);
  });

  it('ne casse pas sur un nom vide ou sans extension', () => {
    expect(cardNameFromFile('')).toBe('');
    expect(cardNameFromFile('.png')).toBe('');
    expect(cardNameFromFile()).toBe('');
    expect(cardNameFromFile('image')).toBe('Image');
  });
});
