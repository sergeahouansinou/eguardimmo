import { describe, expect, it } from 'vitest';
import type { FinancesCommand } from './commands';
import { createDemoFinancesSource } from './source';
import { parseFinances } from './source';
import type { FinancesSource } from './source';
import type { FinancesData } from './schemas';
import { periodKpis, resteDu } from './derive';

type Draft = FinancesCommand extends infer C ? (C extends { requestKey: string } ? Omit<C, 'requestKey'> : never) : never;

let counter = 0;
const send = (source: FinancesSource, draft: Draft, requestKey = `cle-test-${String((counter += 1))}`) => source.dispatch({ ...draft, requestKey });
const read = async (source: FinancesSource): Promise<FinancesData> => parseFinances(await source.snapshot());
const echeanceOf = (data: FinancesData, id: string) => {
  const found = data.echeances.find((item) => item.id === id);
  if (!found) throw new Error(`échéance ${id} absente`);
  return found;
};

const KOFFI = 'ech-2026-11-koffi-adjovi';
const payment = (montant: number, extra: Partial<Extract<Draft, { type: 'recordPayment' }>> = {}): Draft => ({
  type: 'recordPayment',
  bailId: 'bl-2023-0007',
  echeanceId: KOFFI,
  montant,
  date: '2026-11-13',
  mode: 'virement',
  nature: 'echeance',
  reference: '',
  note: '',
  comptabilise: true,
  mentionQuittance: true,
  envoyerRecu: false,
  ...extra,
});

describe('paiements', () => {
  it('un paiement partiel réduit le reste dû et émet un reçu numéroté', async () => {
    const source = createDemoFinancesSource();
    const result = await send(source, payment(30000));
    const data = await read(source);
    expect(resteDu(echeanceOf(data, KOFFI))).toBe(55000);
    expect(data.recus.map((recu) => recu.numero)).toContain('RC-2026-0188');
    expect(result.href).toMatch(/^\/finances\/recus\//);
    expect(data.paiements.filter((paiement) => paiement.echeanceId === KOFFI)).toHaveLength(1);
    expect(periodKpis(data, '2026-11').encaisse).toBe(418000 + 30000);
  });

  it('un règlement qui solde l’échéance n’émet pas de reçu d’acompte', async () => {
    const source = createDemoFinancesSource();
    const before = await read(source);
    const result = await send(source, payment(85000));
    const data = await read(source);
    expect(resteDu(echeanceOf(data, KOFFI))).toBe(0);
    expect(data.recus).toHaveLength(before.recus.length);
    expect(result.href).toBe('/finances');
  });

  it('est idempotent : la même clé rejouée ne crée ni second paiement ni second reçu', async () => {
    const source = createDemoFinancesSource();
    const first = await send(source, payment(30000), 'cle-identique-1');
    const second = await send(source, payment(30000), 'cle-identique-1');
    expect(second).toEqual(first);
    const data = await read(source);
    expect(data.paiements.filter((paiement) => paiement.echeanceId === KOFFI)).toHaveLength(1);
    expect(resteDu(echeanceOf(data, KOFFI))).toBe(55000);
    expect(data.sequences.RC).toBe(188);
  });

  it('refuse un paiement futur, un montant nul et un bail étranger à l’échéance', async () => {
    const source = createDemoFinancesSource();
    await expect(send(source, payment(30000, { date: '2026-11-14' }))).rejects.toThrow();
    await expect(send(source, payment(0))).rejects.toThrow(/invalides/);
    await expect(send(source, payment(30000, { bailId: 'bl-2022-0002' }))).rejects.toThrow();
    const data = await read(source);
    expect(resteDu(echeanceOf(data, KOFFI))).toBe(85000);
  });

  it('un montant non comptabilisé laisse le reste dû inchangé', async () => {
    const source = createDemoFinancesSource();
    await send(source, payment(30000, { comptabilise: false }));
    expect(resteDu(echeanceOf(await read(source), KOFFI))).toBe(85000);
  });
});

describe('factures', () => {
  const invoice = (objet: string, extra: Partial<Extract<Draft, { type: 'createInvoice' }>> = {}): Draft => ({
    type: 'createInvoice',
    locataireId: 'marc-dossou',
    date: '2026-11-13',
    objet,
    montantHt: 17700,
    tvaPct: 20,
    echeance: '2026-12-13',
    ...extra,
  });

  it('numérote en continu et recalcule la TVA côté serveur', async () => {
    const source = createDemoFinancesSource();
    await send(source, invoice('Première'));
    await send(source, invoice('Seconde', { tvaPct: 0 }));
    const data = await read(source);
    const fresh = data.factures.filter((facture) => facture.objet === 'Première' || facture.objet === 'Seconde');
    expect(fresh.map((facture) => facture.numero).sort()).toEqual(['FA-2026-0026', 'FA-2026-0027']);
    expect(fresh.find((facture) => facture.objet === 'Première')?.montantTtc).toBe(21240);
    expect(fresh.find((facture) => facture.objet === 'Seconde')?.montantTtc).toBe(17700);
    expect(data.sequences.FA).toBe(27);
  });

  it('une même clé rejouée n’émet qu’une facture', async () => {
    const source = createDemoFinancesSource();
    const before = await read(source);
    await send(source, invoice('Unique'), 'cle-facture-1');
    await send(source, invoice('Unique'), 'cle-facture-1');
    const data = await read(source);
    expect(data.factures).toHaveLength(before.factures.length + 1);
    expect(data.sequences.FA).toBe(26);
  });

  it('scelle chaque facture et détecte une altération', async () => {
    const source = createDemoFinancesSource();
    const result = await send(source, invoice('Scellée'));
    const data = await read(source);
    const created = data.factures.find((facture) => facture.id === result.id);
    expect(created?.empreinte).toMatch(/^[0-9a-f]{64}$/);
    expect(await source.verifySeal('facture', result.id ?? '')).toBe(true);
    expect(await source.verifySeal('facture', 'inconnue')).toBe(false);
  });

  it('un avoir annule la facture par un document négatif distinct, une seule fois', async () => {
    const source = createDemoFinancesSource();
    const created = await send(source, invoice('À annuler'));
    const credit = await send(source, { type: 'creditInvoice', factureId: created.id ?? '' });
    const data = await read(source);
    const avoir = data.factures.find((facture) => facture.id === credit.id);
    expect(avoir).toMatchObject({ numero: 'AV-2026-0003', type: 'avoir', montantTtc: -21240, factureOrigineId: created.id });
    expect(data.factures.find((facture) => facture.id === created.id)?.avoirId).toBe(credit.id);
    await expect(send(source, { type: 'creditInvoice', factureId: created.id ?? '' })).rejects.toThrow();
    expect((await read(source)).sequences.AV).toBe(3);
  });

  it('refuse un montant nul, un taux hors bornes et un destinataire inconnu', async () => {
    const source = createDemoFinancesSource();
    await expect(send(source, invoice('Nul', { montantHt: 0 }))).rejects.toThrow(/invalides/);
    await expect(send(source, invoice('TVA', { tvaPct: 150 }))).rejects.toThrow(/invalides/);
    await expect(send(source, invoice('Inconnu', { locataireId: 'personne' }))).rejects.toThrow();
    expect((await read(source)).sequences.FA).toBe(25);
  });

  it('marque une facture payée et la renvoie par e-mail', async () => {
    const source = createDemoFinancesSource();
    const data = await read(source);
    const pending = data.factures.find((facture) => facture.numero === 'FA-2026-0022');
    expect(pending?.statut).toBe('attente');
    await send(source, { type: 'markInvoicePaid', factureId: pending?.id ?? '', date: '2026-11-13', mode: 'virement' });
    await send(source, { type: 'sendInvoice', factureId: pending?.id ?? '' });
    const after = (await read(source)).factures.find((facture) => facture.id === pending?.id);
    expect(after).toMatchObject({ statut: 'payee', payeLe: '2026-11-13', envoyeLe: '2026-11-13' });
  });
});

describe('recouvrement', () => {
  it('trace les relances et refuse une échéance soldée', async () => {
    const source = createDemoFinancesSource();
    const before = await read(source);
    await send(source, { type: 'sendReminders', echeanceIds: [KOFFI, 'ech-2026-11-clarisse-hounkpatin'], canal: 'email' });
    const after = await read(source);
    expect(after.relances).toHaveLength(before.relances.length + 2);
    await expect(send(source, { type: 'sendReminders', echeanceIds: ['ech-2026-11-marc-dossou'], canal: 'email' })).rejects.toThrow();
  });

  it('refacture les frais non facturés par une facture adressée, une seule fois', async () => {
    const source = createDemoFinancesSource();
    const data = await read(source);
    const dossier = data.dossiers[0];
    if (!dossier) throw new Error('dossier absent');
    await expect(send(source, { type: 'billDossierFees', dossierId: dossier.id, echeance: '2026-12-01' })).rejects.toThrow(/Aucun frais/);
    await send(source, { type: 'addDiligence', dossierId: dossier.id, date: '2026-11-13', kind: 'autre', libelle: 'Signification', intervenant: 'SCP Agbodjo', cout: 4500 });
    const billed = await send(source, { type: 'billDossierFees', dossierId: dossier.id, echeance: '2026-12-01' });
    const after = await read(source);
    const facture = after.factures.find((item) => item.id === billed.id);
    expect(facture).toMatchObject({ numero: 'FA-2026-0026', montantTtc: 4500, dossierId: dossier.id });
    expect(after.dossiers[0]?.actes.every((acte) => acte.cout === 0 || acte.factureId !== null)).toBe(true);
    await expect(send(source, { type: 'billDossierFees', dossierId: dossier.id, echeance: '2026-12-01' })).rejects.toThrow(/Aucun frais/);
  });

  it('refuse une diligence datée du futur ou antérieure à l’ouverture', async () => {
    const source = createDemoFinancesSource();
    const dossier = (await read(source)).dossiers[0];
    const base = { type: 'addDiligence', dossierId: dossier?.id ?? '', kind: 'autre', libelle: 'Acte', intervenant: 'SCP', cout: 0 } as const;
    await expect(send(source, { ...base, date: '2026-11-20' })).rejects.toThrow();
    await expect(send(source, { ...base, date: '2026-10-01' })).rejects.toThrow();
  });

  it('ouvre un dossier avec une numérotation propre et propose un échéancier', async () => {
    const source = createDemoFinancesSource();
    const opened = await send(source, { type: 'openDossier', echeanceId: 'ech-2026-11-clarisse-hounkpatin' });
    const again = await send(source, { type: 'openDossier', echeanceId: 'ech-2026-11-clarisse-hounkpatin' });
    expect(again.id).toBe(opened.id);
    await send(source, { type: 'proposePlan', echeanceId: 'ech-2026-11-clarisse-hounkpatin', count: 3, premiere: '2026-11-20' });
    const data = await read(source);
    const dossier = data.dossiers.find((item) => item.id === opened.id);
    expect(dossier?.numero).toBe('RC-2026-0012');
    expect(dossier?.plan?.lignes.map((line) => line.montant)).toEqual([7000, 7000, 7000]);
    expect(data.sequences.RC).toBe(187);
  });

  it('passe une créance en irrécouvrable sans la supprimer', async () => {
    const source = createDemoFinancesSource();
    await send(source, { type: 'markUncollectible', echeanceId: 'ech-2026-11-ibrahim-yao' });
    const data = await read(source);
    expect(echeanceOf(data, 'ech-2026-11-ibrahim-yao').statut).toBe('irrecouvrable');
  });
});

describe('patrimoine et banque', () => {
  it('émet un décompte de charges : solde positif facturé, négatif à rembourser', async () => {
    const source = createDemoFinancesSource();
    const base = { type: 'saveRegularisation' as const, regularisationId: null, bailId: 'bl-2022-0002', debut: '2026-01-01', fin: '2026-12-31', justificatifs: [] as string[], emettre: true };
    const due = await send(source, { ...base, provisions: 120000, chargesReelles: 151200 });
    const after = await read(source);
    expect(after.factures.find((facture) => facture.id === due.href?.split('/').pop())?.montantTtc).toBe(31200);
    const refund = await send(source, { ...base, provisions: 120000, chargesReelles: 100000 });
    expect(refund.message).toMatch(/rembourser/);
    expect((await read(source)).sequences.FA).toBe(26);
  });

  it('rembourse par anticipation, solde le prêt et refuse un dépassement', async () => {
    const source = createDemoFinancesSource();
    await expect(send(source, { type: 'prepayPret', pretId: 'pret-les-tilleuls', montant: 20000000 })).rejects.toThrow();
    await send(source, { type: 'prepayPret', pretId: 'pret-les-tilleuls', montant: 1000000 });
    expect((await read(source)).prets.find((pret) => pret.id === 'pret-les-tilleuls')?.restantDu).toBe(13288000 - 1000000);
    await send(source, { type: 'prepayPret', pretId: 'pret-les-tilleuls', montant: 13288000 - 1000000 });
    expect((await read(source)).prets.find((pret) => pret.id === 'pret-les-tilleuls')?.statut).toBe('rembourse');
  });

  it('supprime un prêt sans l’effacer', async () => {
    const source = createDemoFinancesSource();
    await send(source, { type: 'deletePret', pretId: 'pret-les-tilleuls' });
    expect((await read(source)).prets.find((pret) => pret.id === 'pret-les-tilleuls')?.supprime).toBe(true);
  });

  it('importe un relevé sans doublon puis rapproche un encaissement', async () => {
    const source = createDemoFinancesSource();
    const lignes = [{ date: '2026-11-13', libelle: 'VIR HOUNKPATIN CLARISSE', montant: 21000 }];
    const first = await send(source, { type: 'importBankLines', compte: 'Compte principal', lignes });
    expect(first.message).toMatch(/1 opération importée/);
    const second = await send(source, { type: 'importBankLines', compte: 'Compte principal', lignes });
    expect(second.message).toMatch(/0 opération importée\. 1 doublon ignoré/);
    const data = await read(source);
    const ligne = data.lignesBancaires.find((item) => item.libelle === 'VIR HOUNKPATIN CLARISSE');
    expect(ligne?.echeanceProposeeId).toBe('ech-2026-11-clarisse-hounkpatin');
    await send(source, { type: 'matchBankLine', ligneId: ligne?.id ?? '', echeanceId: 'ech-2026-11-clarisse-hounkpatin' });
    const after = await read(source);
    expect(resteDu(echeanceOf(after, 'ech-2026-11-clarisse-hounkpatin'))).toBe(0);
    expect(after.lignesBancaires.find((item) => item.id === ligne?.id)?.statut).toBe('rapprochee');
    await expect(send(source, { type: 'matchBankLine', ligneId: ligne?.id ?? '', echeanceId: 'ech-2026-11-clarisse-hounkpatin' })).rejects.toThrow(/déjà traitée/);
  });

  it('divise, ignore et restaure une opération sans perdre de centime', async () => {
    const source = createDemoFinancesSource();
    await send(source, { type: 'splitBankLine', ligneId: 'bnk-edf', premierePart: -6000 });
    const data = await read(source);
    const parts = data.lignesBancaires.filter((ligne) => ligne.libelle.startsWith('PRLV EDF'));
    expect(parts.map((ligne) => ligne.montant).sort((a, b) => a - b)).toEqual([-6000, -3600]);
    await expect(send(source, { type: 'splitBankLine', ligneId: 'bnk-quincaillerie', premierePart: -4200 })).rejects.toThrow();
    await send(source, { type: 'ignoreBankLine', ligneId: 'bnk-quincaillerie' });
    expect((await read(source)).lignesBancaires.find((ligne) => ligne.id === 'bnk-quincaillerie')?.statut).toBe('archivee');
    await send(source, { type: 'restoreBankLine', ligneId: 'bnk-quincaillerie' });
    expect((await read(source)).lignesBancaires.find((ligne) => ligne.id === 'bnk-quincaillerie')?.statut).toBe('a_rapprocher');
  });

  it('n’autorise pas le rapprochement d’un débit', async () => {
    const source = createDemoFinancesSource();
    await expect(send(source, { type: 'matchBankLine', ligneId: 'bnk-edf', echeanceId: KOFFI })).rejects.toThrow();
  });
});

describe('état partagé', () => {
  it('une commande en échec ne modifie rien', async () => {
    const source = createDemoFinancesSource();
    const before = await read(source);
    await expect(send(source, { type: 'creditInvoice', factureId: 'absente' })).rejects.toThrow();
    expect(await read(source)).toEqual(before);
  });

  it('rejette une commande inconnue', async () => {
    const source = createDemoFinancesSource();
    await expect(source.dispatch({ type: 'supprimerTout', requestKey: 'cle-inconnue-1' })).rejects.toThrow(/invalides/);
  });

  it('chaque instantané est une copie : l’appelant ne peut pas altérer l’état', async () => {
    const source = createDemoFinancesSource();
    const first = await source.snapshot();
    const second = await source.snapshot();
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });
});

describe('relance', () => {
  const relance = (extra: Partial<Extract<Draft, { type: 'sendRelance' }>> = {}): Draft => ({
    type: 'sendRelance',
    echeanceId: 'ech-2026-11-ibrahim-yao',
    niveau: 'amiable',
    modele: 'Relance amiable de loyer',
    canal: 'email',
    joindreGrandLivre: true,
    texte: 'Sauf erreur de notre part, le loyer n’a pas été réglé.',
    ...extra,
  });

  it('ouvre le dossier, consigne l’acte et trace la relance', async () => {
    const source = createDemoFinancesSource();
    const before = await read(source);
    const result = await send(source, relance());
    const after = await read(source);
    expect(result.message).toContain('Relance amiable envoyée');
    expect(after.relances).toHaveLength(before.relances.length + 1);
    const dossier = after.dossiers.find((item) => item.echeanceId === 'ech-2026-11-ibrahim-yao');
    expect(dossier?.actes).toHaveLength(1);
    expect(dossier?.actes[0]).toMatchObject({ kind: 'relance', cout: 0, intervenant: 'Gestion Les Tilleuls' });
    expect(dossier?.actes[0]?.libelle).toContain('grand livre joint');
  });

  it('une mise en demeure en recommandé coûte 6,20 € et n’est plus amiable', async () => {
    const source = createDemoFinancesSource();
    await send(source, relance({ echeanceId: 'ech-2026-11-koffi-adjovi', niveau: 'mise_en_demeure', canal: 'recommande' }));
    const data = await read(source);
    const dossier = data.dossiers.find((item) => item.echeanceId === 'ech-2026-11-koffi-adjovi');
    expect(dossier?.actes.at(-1)).toMatchObject({ kind: 'mise_en_demeure', cout: 620 });
    expect(data.relances.at(-1)).toMatchObject({ canal: 'recommande', amiable: false });
  });

  it('refuse une mise en demeure par e-mail, une échéance soldée et un texte trop court', async () => {
    const source = createDemoFinancesSource();
    await expect(send(source, relance({ niveau: 'mise_en_demeure', canal: 'email' }))).rejects.toThrow('courrier ou en recommandé');
    await expect(send(source, relance({ echeanceId: 'ech-2026-11-nadege-sossou' }))).rejects.toThrow('impayée');
    await expect(send(source, relance({ texte: 'Court' }))).rejects.toThrow('Données invalides');
    expect((await read(source)).dossiers).toHaveLength(1);
  });

  it('rejoue la même requête sans doublon', async () => {
    const source = createDemoFinancesSource();
    await send(source, relance(), 'cle-relance-identique');
    await send(source, relance(), 'cle-relance-identique');
    expect((await read(source)).dossiers.find((item) => item.echeanceId === 'ech-2026-11-ibrahim-yao')?.actes).toHaveLength(1);
  });
});

describe('identifiants générés', () => {
  it('ne reprennent jamais un identifiant de la fixture', async () => {
    const source = createDemoFinancesSource();
    await send(source, { type: 'sendRelance', echeanceId: 'ech-2026-11-koffi-adjovi', niveau: 'seconde', modele: 'Deuxième relance de loyer', canal: 'email', joindreGrandLivre: false, texte: 'Malgré notre précédent courrier, le loyer reste impayé.' });
    const data = await read(source);
    const relances = data.relances.map((item) => item.id);
    const actes = data.dossiers.flatMap((dossier) => dossier.actes.map((acte) => acte.id));
    expect(new Set(relances).size).toBe(relances.length);
    expect(new Set(actes).size).toBe(actes.length);
  });
});
