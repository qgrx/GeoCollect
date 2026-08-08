/**
 * Nom d'un geocoin déduit du nom de son image, au dépôt dans l'admin.
 *
 *   « ile_de_re.png » → « Ile de re »
 *
 * Les fichiers arrivent nommés comme des fichiers (extension, underscores en
 * guise d'espaces, minuscule initiale) : on les remet en forme de titre plutôt
 * que de faire retaper le nom à la main.
 *
 * Utilisé par la création unitaire (AdminCards) et par la création par lot
 * (AdminCardBatch), qui doivent nommer pareil deux images identiques.
 */

export const MAX_CARD_NAME = 50;  // contrainte de la colonne cards.name

export function cardNameFromFile(filename = '') {
  const base = String(filename)
    .replace(/\.[^.]+$/, '')   // extension
    .replace(/_/g, ' ')        // underscores = séparateurs de mots
    .replace(/\s+/g, ' ')
    .trim();
  if (!base) return '';
  return (base[0].toUpperCase() + base.slice(1)).slice(0, MAX_CARD_NAME);
}
