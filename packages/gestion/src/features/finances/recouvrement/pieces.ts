import { formatDate } from '../dates';
import { bailOf, creancesActives } from '../derive';
import type { Dossier, FinancesData, Piece } from '../schemas';

const OCTETS: Record<Piece['kind'], number> = {
  decompte: 48_000,
  avis_echeance: 62_000,
  facture: 75_000,
  relance: 54_000,
  mise_en_demeure: 58_000,
  bail: 410_000,
  grand_livre: 96_000,
};

export function buildPieces(data: FinancesData, dossier: Dossier): Piece[] {
  const bail = bailOf(data, dossier.bailId);
  const pieces: Piece[] = [{ id: 'decompte', kind: 'decompte', libelle: 'Décompte des sommes dues', octets: OCTETS.decompte, facultative: false }];
  for (const creance of creancesActives(dossier)) {
    if (creance.kind === 'echeance') pieces.push({ id: `avis-${creance.refId}`, kind: 'avis_echeance', libelle: `Avis d’échéance, ${creance.libelle}`, octets: OCTETS.avis_echeance, facultative: false });
    else pieces.push({ id: `facture-${creance.refId}`, kind: 'facture', libelle: creance.libelle, octets: OCTETS.facture, facultative: false });
  }
  for (const acte of dossier.actes) {
    if (acte.kind !== 'relance' && acte.kind !== 'mise_en_demeure') continue;
    pieces.push({ id: `acte-${acte.id}`, kind: acte.kind, libelle: `${acte.libelle}, ${formatDate(acte.date)}`, octets: OCTETS[acte.kind], facultative: true });
  }
  pieces.push({ id: 'bail', kind: 'bail', libelle: bail ? `Bail ${bail.numero}` : 'Bail', octets: OCTETS.bail, facultative: false });
  pieces.push({ id: 'grand-livre', kind: 'grand_livre', libelle: `Extrait du grand livre${bail ? `, ${bail.locataire}` : ''}`, octets: OCTETS.grand_livre, facultative: true });
  return pieces;
}

export function formatOctets(octets: number): string {
  if (octets < 1_000_000) return `${String(Math.max(1, Math.round(octets / 1000)))} Ko`;
  return `${(octets / 1_000_000).toFixed(1).replace('.', ',')} Mo`;
}
