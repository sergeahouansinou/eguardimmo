export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(random: () => number, items: readonly T[]): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) throw new RangeError('Liste vide');
  return item;
}

export const FIRST_NAMES = [
  'Camille', 'Julien', 'Léa', 'Hugo', 'Inès', 'Nadia', 'Thomas', 'Sarah', 'Mathieu', 'Claire', 'Antoine', 'Manon',
  'Nicolas', 'Élodie', 'Maxime', 'Amélie', 'Romain', 'Lucie', 'Pierre', 'Chloé', 'Sébastien', 'Laura', 'Adrien',
  'Pauline', 'Vincent', 'Marion', 'Baptiste', 'Océane', 'Fabien', 'Justine', 'Yann', 'Aurélie', 'Kévin', 'Sandrine',
  'Mamadou', 'Fatou', 'Ibrahim', 'Aïcha', 'Jean', 'Marie',
] as const;

export const LAST_NAMES = [
  'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon',
  'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier', 'Morel', 'Girard',
  'André', 'Mercier', 'Dupont', 'Lambert', 'Bonnet', 'François', 'Martinez', 'Legrand', 'Garnier', 'Faure', 'Rousseau',
  'Blanc', 'Guérin', 'Muller', 'Henry', 'Roussel', 'Nicolas', 'Perrin', 'Morin', 'Mathieu', 'Clément', 'Gauthier',
  'Dumont', 'Lopez', 'Fontaine', 'Chevalier', 'Robin', 'Masson',
] as const;
