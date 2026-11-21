import { describe, expect, it } from 'vitest';
import { parseBankLines, parseSignedAmount } from './banque/parse';
import { parseCsv, toCsv } from './csv';
import { addDays, addMonths, daysBetween, formatDate, isIsoDate, parseFrenchDate } from './dates';
import { createDemoFinances } from './demo';
import { bilanView, dossierSteps, dossierTotals, echeanceEtat, estimateSchedule, impayes, instalments, nextNumber, periodKpis, pretAvancement, regularisationSolde, resteDu, tauxLabel } from './derive';
import { divRound, formatDecimal, formatMoneyInput, parseMoneyInput, percentOf, splitEvenly, sum } from './money';
import { moneyText } from './forms';
import { formatRate, parseRate, parseSchedule } from './prets/schedule';
import { norm } from './testing/render';

describe('montants en unités mineures', () => {
  it('lit une saisie sans passer par un flottant', () => {
    expect(parseMoneyInput('850')).toBe(85000);
    expect(parseMoneyInput('850,5')).toBe(85050);
    expect(parseMoneyInput('1 234,56')).toBe(123456);
    expect(parseMoneyInput('0,07')).toBe(7);
    expect(parseMoneyInput('19,99')).toBe(1999);
  });

  it('refuse les saisies ambiguës ou excessives', () => {
    for (const text of ['', 'abc', '12,345', '-5', '1e3', '12.3.4', '9999999999']) expect(parseMoneyInput(text)).toBeNull();
  });

  it('formate pour les champs et pour les documents', () => {
    expect(formatMoneyInput(85000)).toBe('850');
    expect(formatMoneyInput(85050)).toBe('850,50');
    expect(formatMoneyInput(-5)).toBe('-0,05');
    expect(norm(formatDecimal(123456))).toBe('1 234,56');
  });

  it('gère les francs CFA sans décimales', () => {
    expect(parseMoneyInput('250 000', 'XOF')).toBe(250_000);
    expect(parseMoneyInput('250 000,5', 'XOF')).toBeNull();
    expect(formatMoneyInput(250_000, 'XOF')).toBe('250000');
    expect(norm(formatDecimal(250_000, 'XOF'))).toBe('250 000');
    expect(norm(formatDecimal(-1_250_000, 'XOF'))).toBe('-1 250 000');
  });

  it('valide un montant selon la devise du champ', () => {
    expect(moneyText('Loyer', { currency: 'XOF' }).safeParse('250 000')).toMatchObject({ success: true, data: 250_000 });
    expect(moneyText('Loyer', { currency: 'XOF' }).safeParse('250 000,50').success).toBe(false);
    expect(moneyText('Loyer').safeParse('850,50')).toMatchObject({ success: true, data: 85_050 });
  });

  it('arrondit au centime par un calcul entier', () => {
    expect(divRound(5, 2)).toBe(3);
    expect(divRound(4, 3)).toBe(1);
    expect(percentOf(17700, 20)).toBe(3540);
    expect(percentOf(1, 50)).toBe(1);
    expect(percentOf(33333, 20)).toBe(6667);
  });

  it('répartit un total sans perdre un centime', () => {
    expect(splitEvenly(10000, 3)).toEqual([3333, 3333, 3334]);
    for (const [total, count] of [[98070, 7], [1, 2], [85000, 12]] as const) expect(sum(splitEvenly(total, count))).toBe(total);
  });
});

describe('dates', () => {
  it('calcule sans fuseau', () => {
    expect(daysBetween('2026-11-01', '2026-11-13')).toBe(12);
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
    expect(addDays('2026-11-28', 5)).toBe('2026-12-03');
  });

  it('valide les dates au format français et ISO', () => {
    expect(formatDate('2026-11-13')).toBe('13/11/2026');
    expect(parseFrenchDate('13/11/2026')).toBe('2026-11-13');
    expect(parseFrenchDate('31/02/2026')).toBeNull();
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-02-28')).toBe(true);
  });
});

describe('CSV', () => {
  it('neutralise les formules et protège les séparateurs', () => {
    expect(toCsv([['=SOMME(A1)', 'a;b', 'dit "oui"', 12]])).toBe('\'=SOMME(A1);"a;b";"dit ""oui""";12');
  });

  it('neutralise une formule HYPERLINK', () => {
    expect(toCsv([['=HYPERLINK("http://x";"y")']])).toBe('"\'=HYPERLINK(""http://x"";""y"")"');
  });

  it('relit un tableau séparé par des points-virgules', () => {
    expect(parseCsv('a;b\r\n\r\n"c";d ')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('lit un relevé bancaire avec en-tête, débits et dates françaises', () => {
    const parsed = parseBankLines('Date;Libellé;Montant\n12/11/2026;VIR KOFFI ADJOVI NOV;850,00\n2026-11-10;PRLV EDF;-96,00');
    expect(parsed.errors).toEqual([]);
    expect(parsed.lignes).toEqual([
      { date: '2026-11-12', libelle: 'VIR KOFFI ADJOVI NOV', montant: 85000 },
      { date: '2026-11-10', libelle: 'PRLV EDF', montant: -9600 },
    ]);
  });

  it('signale les lignes invalides avec leur numéro', () => {
    const parsed = parseBankLines('12/11/2026;VIR;850\n32/13/2026;X;1\n12/11/2026;;5\n12/11/2026;ZÉRO;0');
    expect(parsed.lignes).toHaveLength(1);
    expect(parsed.errors.map((error) => error.slice(0, 8))).toEqual(['Ligne 2 ', 'Ligne 3 ', 'Ligne 4 ']);
    expect(parseSignedAmount('−12,5')).toBe(-1250);
    expect(parseBankLines('').errors).toEqual(['Aucune opération reconnue.']);
  });

  it('lit un échéancier de prêt et refuse un tableau incomplet', () => {
    const ok = parseSchedule('Date;Mensualité;Intérêts;Capital;Restant\n15/12/2026;1012,00;160,89;851,11;131 000,00');
    expect(ok.errors).toEqual([]);
    expect(ok.lignes).toEqual([{ date: '2026-12-15', mensualite: 101200, interets: 16089, capital: 85111, restant: 13100000 }]);
    expect(parseSchedule('15/12/2026;1012').errors).toHaveLength(1);
  });

  it('convertit un taux en centièmes de point', () => {
    expect(parseRate('1,45')).toBe(145);
    expect(parseRate('3')).toBe(300);
    expect(parseRate('100')).toBeNull();
    expect(formatRate(145)).toBe('1,45');
    expect(tauxLabel(210)).toBe('2,10 %');
  });
});

describe('calculs du registre de démonstration', () => {
  const data = createDemoFinances();

  it('chiffre le mois de novembre 2026 à partir des lignes', () => {
    expect(periodKpis(data, '2026-11')).toEqual({ attendu: 889000, encaisse: 777000, depenses: 28500, reparations: 8500, resultat: 748500 });
  });

  it('classe les impayés par ancienneté puis par montant, avec leur total', () => {
    const items = impayes(data);
    expect(items.map((item) => resteDu(item))).toEqual([85000, 21000, 6000]);
    expect(sum(items.map((item) => resteDu(item)))).toBe(112000);
    const first = items[0];
    if (!first) throw new Error('impayé absent');
    expect(echeanceEtat(first, data.today)).toBe('retard');
  });

  it('retrouve les 980,70 € à recouvrer du dossier', () => {
    const dossier = data.dossiers[0];
    if (!dossier) throw new Error('dossier absent');
    const totals = dossierTotals(data, dossier);
    expect(totals).toMatchObject({ dette: 85000, frais: 14570, fraisRegles: 1500, facturesEnAttente: 13070, totalARecouvrer: 98070, nonRefactures: 0, jours: 11 });
    const steps = dossierSteps(dossier, false, formatDate);
    expect(steps.map((step) => step.state)).toEqual(['done', 'done', 'cur', 'todo', 'todo']);
    const vide = dossierSteps({ ...dossier, actes: [], delaiJusquau: null }, false, formatDate);
    expect(vide.map((step) => step.state)).toEqual(['cur', 'todo', 'todo', 'todo', 'todo']);
    expect(vide[0]?.caption).toBe('À envoyer');
  });

  it('propose la suite de numéros sans réutiliser un numéro émis', () => {
    expect(nextNumber(data, 'FA')).toBe('FA-2026-0026');
    expect(data.factures.some((facture) => facture.numero === 'FA-2026-0026')).toBe(false);
    expect(nextNumber(data, 'AV')).toBe('AV-2026-0003');
  });

  it('simule les régimes fiscaux sans flottant', () => {
    const bilan = data.bilans.find((item) => item.annee === 2026);
    if (!bilan) throw new Error('bilan absent');
    expect(bilanView(bilan, 'foncier_reel')).toMatchObject({ recettes: 8947000, charges: 421500, net: 8525500 });
    expect(bilanView(bilan, 'micro_foncier')).toMatchObject({ charges: 2684100, net: 6262900 });
    expect(bilanView(bilan, 'micro_bic')).toMatchObject({ charges: 4473500, net: 4473500 });
    expect(bilanView(bilan, 'lmnp_reel').charges).toBe(421500 + bilan.amortissementsLmnp);
  });

  it('compare provisions et charges réelles', () => {
    expect(regularisationSolde(120000, 151200)).toBe(31200);
    expect(regularisationSolde(120000, 100000)).toBe(-20000);
  });

  it('étale un échéancier et estime l’amortissement d’un prêt', () => {
    expect(instalments(98070, 3, '2026-11-20')).toEqual([
      { date: '2026-11-20', montant: 32690 },
      { date: '2026-12-20', montant: 32690 },
      { date: '2027-01-20', montant: 32690 },
    ]);
    const pret = data.prets[0];
    if (!pret) throw new Error('prêt absent');
    expect(pretAvancement(pret)).toBe(26);
    const schedule = estimateSchedule(pret, data.today, 3);
    expect(schedule).toHaveLength(3);
    for (const line of schedule) expect(line.mensualite).toBe(line.interets + line.capital);
    expect(schedule[0]?.restant).toBe(pret.restantDu - (schedule[0]?.capital ?? 0));
  });
});
