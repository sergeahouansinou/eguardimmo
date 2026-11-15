import type { Facture, FinancesData, Liasse, Recu } from './schemas';

export const canonicalFacture = (facture: Facture): string =>
  JSON.stringify([facture.numero, facture.type, facture.date, facture.destinataire, facture.objet, facture.montantHt, facture.tvaPct, facture.montantTtc, facture.lignes]);

export const canonicalRecu = (recu: Recu): string =>
  JSON.stringify([recu.numero, recu.date, recu.bailId, recu.nature, recu.montant, recu.mode, recu.reference, recu.appele, recu.recuSurEcheance, recu.resteDu]);

export const canonicalLiasse = (liasse: Liasse): string => JSON.stringify([liasse.genereLe, liasse.pieces.map((piece) => [piece.id, piece.libelle, piece.octets])]);

export async function sha256Hex(text: string): Promise<string> {
  const subtle = globalThis.crypto.subtle as SubtleCrypto | undefined;
  if (!subtle) throw new Error('Le scellement des documents est indisponible dans ce navigateur.');
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function sealMissing(data: FinancesData): Promise<void> {
  for (const facture of data.factures) if (facture.empreinte === '') facture.empreinte = await sha256Hex(canonicalFacture(facture));
  for (const recu of data.recus) if (recu.empreinte === '') recu.empreinte = await sha256Hex(canonicalRecu(recu));
  for (const dossier of data.dossiers) for (const liasse of dossier.liasses) if (liasse.empreinte === '') liasse.empreinte = await sha256Hex(canonicalLiasse(liasse));
}

export async function verifySeal(data: FinancesData, kind: 'facture' | 'recu', id: string): Promise<boolean> {
  if (kind === 'facture') {
    const facture = data.factures.find((item) => item.id === id);
    return facture ? (await sha256Hex(canonicalFacture(facture))) === facture.empreinte : false;
  }
  const recu = data.recus.find((item) => item.id === id);
  return recu ? (await sha256Hex(canonicalRecu(recu))) === recu.empreinte : false;
}

export const shortHash = (hash: string): string => (hash.length > 8 ? `${hash.slice(0, 4)}…${hash.slice(-4)}` : hash);
