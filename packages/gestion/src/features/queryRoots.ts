export const BIENS_ROOT = ['biens'] as const;
export const BAUX_ROOT = ['gestion', 'baux'] as const;
export const LOCATAIRES_ROOT = ['gestion', 'locataires'] as const;

/**
 * L'occupation d'un lot se déduit des baux : tout ce qui crée, termine ou renouvelle un bail relit aussi les biens et les locataires.
 */
export const OCCUPANCY_ROOTS = [BIENS_ROOT, BAUX_ROOT, LOCATAIRES_ROOT] as const;
