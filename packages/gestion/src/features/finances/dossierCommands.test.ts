import { describe, expect, it } from 'vitest';
import type { FinancesCommand } from './commands';
import { dossierTotals } from './derive';
import { creanceOptions } from './recouvrement/creances';
import { buildPieces } from './recouvrement/pieces';
import { transmissionStatut } from './recouvrement/transmissions';
import type { FinancesData } from './schemas';
import { createDemoFinancesSource, parseFinances } from './source';
import type { FinancesSource } from './source';
import { demoWithOverdueInvoice, IBRAHIM_ECHEANCE, IBRAHIM_FACTURE } from './testing/data';

type Draft = FinancesCommand extends infer C ? (C extends { requestKey: string } ? Omit<C, 'requestKey'> : never) : never;

let counter = 0;
const send = (source: FinancesSource, draft: Draft) => source.dispatch({ ...draft, requestKey: `cle-dossier-${String((counter += 1))}` });
const read = async (source: FinancesSource): Promise<FinancesData> => parseFinances(await source.snapshot());
const IBRAHIM_BAIL = 'bl-2025-0002';
const BOTH = [
  { kind: 'echeance', refId: IBRAHIM_ECHEANCE },
  { kind: 'facture', refId: IBRAHIM_FACTURE },
] as const;
const COMMISSAIRE = { destinataireId: 'scp-agbodjo', destinataire: 'SCP Agbodjo', email: 'etude@scp-agbodjo.example', dureeJours: 7, message: '' } as const;

async function openWithTwo() {
  const source = createDemoFinancesSource({ seed: demoWithOverdueInvoice() });
  const opened = await send(source, { type: 'openDossier', bailId: IBRAHIM_BAIL, creances: [...BOTH] });
  return { source, dossierId: opened.id ?? '' };
}

describe('dossier de recouvrement par locataire', () => {
  it('regroupe une échéance et une facture impayées dans un seul dossier numéroté', async () => {
    const { source, dossierId } = await openWithTwo();
    const data = await read(source);
    const dossier = data.dossiers.find((item) => item.id === dossierId);
    expect(dossier).toMatchObject({ numero: 'RC-2026-0012', bailId: IBRAHIM_BAIL });
    expect(dossier?.creances.map((creance) => [creance.kind, creance.montantInitial, creance.retireLe])).toEqual([
      ['echeance', 6000, null],
      ['facture', 9600, null],
    ]);
    expect(dossier && dossierTotals(data, dossier).dette).toBe(15600);
    expect(creanceOptions(data, IBRAHIM_BAIL)).toEqual([]);
  });

  it('liste les créances en retard d’un bail avec leur reste dû', () => {
    const options = creanceOptions(demoWithOverdueInvoice(), IBRAHIM_BAIL);
    expect(options.map((option) => [option.kind, option.reste])).toEqual([
      ['echeance', 6000],
      ['facture', 9600],
    ]);
  });

  it('refuse une sélection vide, une créance d’un autre bail et un second dossier ouvert pour le bail', async () => {
    const source = createDemoFinancesSource({ seed: demoWithOverdueInvoice() });
    await expect(send(source, { type: 'openDossier', bailId: IBRAHIM_BAIL, creances: [] })).rejects.toThrow('au moins une créance');
    const clarisse = (await read(source)).echeances.find((item) => item.id === 'ech-2026-11-clarisse-hounkpatin')?.bailId ?? '';
    await expect(send(source, { type: 'openDossier', bailId: clarisse, creances: [{ kind: 'echeance', refId: IBRAHIM_ECHEANCE }] })).rejects.toThrow('autre bail');
    await send(source, { type: 'openDossier', bailId: IBRAHIM_BAIL, creances: [BOTH[0]] });
    await expect(send(source, { type: 'openDossier', bailId: IBRAHIM_BAIL, creances: [BOTH[1]] })).rejects.toThrow('déjà ouvert');
    expect((await read(source)).dossiers).toHaveLength(2);
  });

  it('refuse une créance déjà dans un dossier ouvert, avec le numéro du dossier', async () => {
    const { source, dossierId } = await openWithTwo();
    await expect(send(source, { type: 'addCreances', dossierId, creances: [BOTH[0]] })).rejects.toThrow('est déjà dans le dossier RC-2026-0012');
    await expect(send(source, { type: 'addCreances', dossierId: 'dos-rc-2026-0011', creances: [BOTH[0]] })).rejects.toThrow('autre bail');
  });

  it('ajoute une créance après ouverture, puis la retire en gardant l’historique', async () => {
    const source = createDemoFinancesSource({ seed: demoWithOverdueInvoice() });
    const opened = await send(source, { type: 'openDossier', bailId: IBRAHIM_BAIL, creances: [BOTH[0]] });
    const dossierId = opened.id ?? '';
    await send(source, { type: 'addCreances', dossierId, creances: [BOTH[1]] });
    let dossier = (await read(source)).dossiers.find((item) => item.id === dossierId);
    expect(dossier?.creances).toHaveLength(2);
    const facture = dossier?.creances.find((creance) => creance.kind === 'facture');
    await send(source, { type: 'removeCreance', dossierId, creanceId: facture?.id ?? '' });
    dossier = (await read(source)).dossiers.find((item) => item.id === dossierId);
    expect(dossier?.creances).toHaveLength(2);
    expect(dossier?.creances.find((creance) => creance.id === facture?.id)?.retireLe).toBe('2026-11-13');
    await expect(send(source, { type: 'removeCreance', dossierId, creanceId: facture?.id ?? '' })).rejects.toThrow('déjà retirée');
    const reste = dossier?.creances.find((creance) => creance.retireLe === null);
    await expect(send(source, { type: 'removeCreance', dossierId, creanceId: reste?.id ?? '' })).rejects.toThrow('au moins une créance');
    await send(source, { type: 'addCreances', dossierId, creances: [BOTH[1]] });
    expect((await read(source)).dossiers.find((item) => item.id === dossierId)?.creances).toHaveLength(3);
  });
});

describe('pièces et envoi', () => {
  it('liste les pièces du dossier et fige l’envoi généré', async () => {
    const { source, dossierId } = await openWithTwo();
    const before = await read(source);
    const dossier = before.dossiers.find((item) => item.id === dossierId);
    const pieces = dossier ? buildPieces(before, dossier) : [];
    expect(pieces.map((piece) => piece.kind)).toEqual(['decompte', 'avis_echeance', 'facture', 'bail', 'grand_livre']);
    await expect(send(source, { type: 'generateLiasse', dossierId, exclues: ['decompte'] })).rejects.toThrow('obligatoire');
    await expect(send(source, { type: 'generateLiasse', dossierId, exclues: ['inconnue'] })).rejects.toThrow('introuvable');
    await send(source, { type: 'generateLiasse', dossierId, exclues: ['grand-livre'] });
    const after = (await read(source)).dossiers.find((item) => item.id === dossierId);
    const liasse = after?.liasses[0];
    expect(liasse?.pieces).toHaveLength(4);
    expect(liasse?.genereLe).toBe('2026-11-13');
    expect(liasse?.octets).toBe(liasse?.pieces.reduce((total, piece) => total + piece.octets, 0));
    expect(liasse?.empreinte).toMatch(/^[0-9a-f]{64}$/);
    await send(source, { type: 'addDiligence', dossierId, date: '2026-11-13', kind: 'relance', libelle: 'Relance par courrier', intervenant: 'Gestion', cout: 0 });
    const frozen = (await read(source)).dossiers.find((item) => item.id === dossierId);
    expect(frozen?.liasses[0]?.pieces).toHaveLength(4);
  });
});

describe('transmission au commissaire de justice', () => {
  it('refuse de transmettre tant qu’aucun envoi n’est généré', async () => {
    const { source, dossierId } = await openWithTwo();
    await expect(send(source, { type: 'transmitLiasse', dossierId, liasseId: 'lia-absente', ...COMMISSAIRE })).rejects.toThrow('Générez l’envoi');
    expect((await read(source)).dossiers.find((item) => item.id === dossierId)?.transmissions).toEqual([]);
  });

  it('refuse un contact sans adresse e-mail ou une durée hors limites', async () => {
    const { source, dossierId } = await openWithTwo();
    const generated = await send(source, { type: 'generateLiasse', dossierId, exclues: [] });
    const liasseId = generated.id ?? '';
    await expect(send(source, { type: 'transmitLiasse', dossierId, liasseId, ...COMMISSAIRE, email: '' })).rejects.toThrow('adresse e-mail');
    await expect(send(source, { type: 'transmitLiasse', dossierId, liasseId, ...COMMISSAIRE, email: 'pas-un-email' })).rejects.toThrow('e-mail');
    await expect(send(source, { type: 'transmitLiasse', dossierId, liasseId, ...COMMISSAIRE, dureeJours: 45 })).rejects.toThrow('Données invalides');
    const dossier = (await read(source)).dossiers.find((item) => item.id === dossierId);
    expect(dossier?.transmissions).toEqual([]);
    expect(dossier?.actes).toEqual([]);
  });

  it('transmet, trace l’acte au carnet, révoque, puis renvoie un lien', async () => {
    const { source, dossierId } = await openWithTwo();
    const generated = await send(source, { type: 'generateLiasse', dossierId, exclues: [] });
    const sent = await send(source, { type: 'transmitLiasse', dossierId, liasseId: generated.id ?? '', ...COMMISSAIRE, message: 'Pièces du dossier.' });
    let dossier = (await read(source)).dossiers.find((item) => item.id === dossierId);
    const transmission = dossier?.transmissions[0];
    expect(transmission).toMatchObject({ id: sent.id, destinataire: 'SCP Agbodjo', envoyeLe: '2026-11-13', expireLe: '2026-11-20', revoqueLe: null, telechargements: 0, message: 'Pièces du dossier.' });
    expect(dossier?.actes).toHaveLength(1);
    expect(dossier?.actes[0]).toMatchObject({ kind: 'transmission', intervenant: 'SCP Agbodjo', cout: 0, factureId: null, date: '2026-11-13' });
    expect(dossier?.actes[0]?.libelle).toContain('5 pièces');
    expect(transmission && transmissionStatut(transmission, '2026-11-13')).toBe('actif');

    await send(source, { type: 'revokeTransmission', dossierId, transmissionId: sent.id ?? '' });
    dossier = (await read(source)).dossiers.find((item) => item.id === dossierId);
    expect(dossier?.transmissions[0]?.revoqueLe).toBe('2026-11-13');
    expect(dossier?.actes.map((acte) => acte.kind)).toEqual(['transmission', 'revocation']);
    expect(dossier?.actes[1]).toMatchObject({ intervenant: 'SCP Agbodjo', cout: 0 });
    await expect(send(source, { type: 'revokeTransmission', dossierId, transmissionId: sent.id ?? '' })).rejects.toThrow('déjà révoqué');

    await send(source, { type: 'resendTransmission', dossierId, transmissionId: sent.id ?? '' });
    dossier = (await read(source)).dossiers.find((item) => item.id === dossierId);
    expect(dossier?.transmissions).toHaveLength(2);
    expect(dossier?.transmissions[1]).toMatchObject({ liasseId: generated.id, destinataire: 'SCP Agbodjo', revoqueLe: null });
    expect(dossier?.actes.map((acte) => acte.kind)).toEqual(['transmission', 'revocation', 'transmission']);
  });

  it('renvoyer un lien encore actif révoque l’ancien et consigne les deux actes', async () => {
    const { source, dossierId } = await openWithTwo();
    const generated = await send(source, { type: 'generateLiasse', dossierId, exclues: [] });
    const sent = await send(source, { type: 'transmitLiasse', dossierId, liasseId: generated.id ?? '', ...COMMISSAIRE });
    await send(source, { type: 'resendTransmission', dossierId, transmissionId: sent.id ?? '' });
    const dossier = (await read(source)).dossiers.find((item) => item.id === dossierId);
    expect(dossier?.transmissions.map((item) => item.revoqueLe)).toEqual(['2026-11-13', null]);
    expect(dossier?.actes.map((acte) => acte.kind)).toEqual(['transmission', 'revocation', 'transmission']);
  });

  it('calcule le statut d’un lien : actif jusqu’au jour d’expiration inclus, puis expiré', () => {
    const lien = { revoqueLe: null, expireLe: '2026-11-20' };
    expect(transmissionStatut(lien, '2026-11-20')).toBe('actif');
    expect(transmissionStatut(lien, '2026-11-21')).toBe('expire');
    expect(transmissionStatut({ ...lien, revoqueLe: '2026-11-14' }, '2026-11-15')).toBe('revoque');
  });
});
