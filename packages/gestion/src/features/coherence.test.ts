import { describe, expect, it } from 'vitest';
import { demoBureau, demoShell } from '../data/demo';
import { buildInstallments, demoEdls, demoLeases, demoReservations } from './baux/demo';
import type { Lease } from './baux/schemas';
import { createDemoState } from './biens/demo/state';
import { demoCourriers, demoNotices, demoReceipts } from './courriers/demo';
import { slugify } from './finances/derive';
import { createDemoFinances } from './finances/demo';
import { demoCandidates, demoLeaseTerms, demoTenants, demoUnits } from './locataires/demo';
import { ARREARS, LEASE_ENDS } from './outils/analytique/demoBase';
import { createDemoLoyers } from './outils/rapports/demo';
import { demoEcheances, demoEvents } from './suivi/agenda/demo';
import { demoContacts } from './suivi/contacts/demo';
import { demoDocuments } from './suivi/documents/demo';
import { demoInterventions } from './suivi/interventions/demo';
import { TENANT_BY_BIEN, tenantOf } from './suivi/shared/biens';

const isCurrent = (lease: Lease) => lease.status === 'en_cours' || lease.status === 'preavis';
const currentLeases = demoLeases.filter(isCurrent);
const tenantById = new Map(demoTenants.map((tenant) => [tenant.id, tenant]));
const unitById = new Map(demoUnits.map((unit) => [unit.id, unit]));
const nameOf = (tenantId: string): string => {
  const tenant = tenantById.get(tenantId);
  return tenant ? `${tenant.firstName} ${tenant.lastName}` : `<${tenantId} inconnu>`;
};
const tenantNames = new Set(demoTenants.map((tenant) => `${tenant.firstName} ${tenant.lastName}`));
const personNames = new Set([...tenantNames, ...demoCandidates.map((candidate) => `${candidate.firstName} ${candidate.lastName}`)]);
const currentLeaseOfUnit = (unitId: string): Lease | undefined => currentLeases.find((lease) => lease.unitId === unitId);
const seasonalUnits = new Set(demoReservations.map((reservation) => reservation.unitId));
const cc = (lease: Lease): number => lease.rent + lease.charges;
const dayAfter = (date: string): string => new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

describe('cohérence inter-lots : référentiel Baux et Locataires', () => {
  it('toute référence d’un bail pointe vers une unité et des locataires existants', () => {
    const problems = demoLeases.flatMap((lease) => [
      ...(unitById.has(lease.unitId) ? [] : [`${lease.reference} : unité ${lease.unitId} inconnue`]),
      ...lease.tenantIds.filter((id) => !tenantById.has(id)).map((id) => `${lease.reference} : locataire ${id} inconnu`),
    ]);
    expect(problems).toEqual([]);
  });

  it('les numéros de bail sont uniques', () => {
    const references = demoLeases.map((lease) => lease.reference);
    expect(new Set(references).size).toBe(references.length);
  });

  it('un locataire et une unité n’ont qu’un bail en cours', () => {
    const tenantIds = currentLeases.flatMap((lease) => lease.tenantIds);
    expect(tenantIds.filter((id, index) => tenantIds.indexOf(id) !== index)).toEqual([]);
    const unitIds = currentLeases.map((lease) => lease.unitId);
    expect(unitIds.filter((id, index) => unitIds.indexOf(id) !== index)).toEqual([]);
  });

  it('une unité est vacante si et seulement si elle n’a aucun bail en cours (hors location saisonnière)', () => {
    const problems = demoUnits
      .filter((unit) => !seasonalUnits.has(unit.id))
      .filter((unit) => unit.vacant !== (currentLeaseOfUnit(unit.id) === undefined))
      .map((unit) => `${unit.id} : vacant=${String(unit.vacant)}`);
    expect(problems).toEqual([]);
  });

  it('chaque locataire en cours occupe l’unité de son bail, avec la même situation et le même solde', () => {
    const problems = demoTenants.flatMap((tenant) => {
      const lease = currentLeases.find((item) => item.tenantIds.includes(tenant.id));
      if (!lease) return tenant.unitId === null ? [] : [`${tenant.id} : unité ${tenant.unitId} sans bail en cours`];
      return [
        ...(tenant.unitId === lease.unitId ? [] : [`${tenant.id} : unité ${String(tenant.unitId)} au lieu de ${lease.unitId}`]),
        ...(tenant.since === lease.start ? [] : [`${tenant.id} : depuis ${tenant.since} au lieu de ${lease.start}`]),
        ...(tenant.balance === lease.balance ? [] : [`${tenant.id} : solde ${String(tenant.balance)} au lieu de ${String(lease.balance)}`]),
        ...((tenant.state === 'preavis') === (lease.status === 'preavis') ? [] : [`${tenant.id} : état ${tenant.state} incohérent avec le bail ${lease.status}`]),
      ];
    });
    expect(problems).toEqual([]);
  });

  it('les candidats visent une unité vacante ou en préavis', () => {
    const problems = demoCandidates
      .filter((candidate) => currentLeaseOfUnit(candidate.unitId)?.status === 'en_cours' || !unitById.has(candidate.unitId))
      .map((candidate) => `${candidate.id} : unité ${candidate.unitId}`);
    expect(problems).toEqual([]);
  });

  it('les conditions de démo des baux en cours sont celles des baux', () => {
    const problems = currentLeases.flatMap((lease) => {
      const terms = demoLeaseTerms[lease.unitId];
      if (!terms) return [lease.reference];
      return terms.tenantId === lease.tenantIds[0] && terms.rent === lease.rent && terms.charges === lease.charges ? [] : [lease.reference];
    });
    expect(problems).toEqual([]);
  });

  it('les états des lieux et le bail à venir concordent avec les locataires', () => {
    const problems = demoEdls.flatMap((edl) => {
      const lease = demoLeases.find((item) => item.unitId === edl.unitId && item.tenantIds.includes(edl.tenantId ?? ''));
      if (!lease) return [`${edl.reference} : aucun bail de ${String(edl.tenantId)} sur ${edl.unitId}`];
      return edl.type === 'entree' && edl.date !== lease.start ? [`${edl.reference} : entrée le ${String(edl.date)} au lieu de ${lease.start}`] : [];
    });
    expect(problems).toEqual([]);
  });
});

describe('cohérence inter-lots : Finances', () => {
  const finances = createDemoFinances();
  const leaseOfBail = (numero: string) => demoLeases.find((lease) => lease.reference === numero);

  it('chaque bail financier est un bail en cours du référentiel (numéro, locataire, unité, immeuble)', () => {
    const problems = finances.baux.flatMap((bail) => {
      const lease = leaseOfBail(bail.numero);
      if (!lease || !isCurrent(lease)) return [`${bail.numero} : bail en cours introuvable`];
      const unit = unitById.get(lease.unitId);
      return [
        ...(lease.tenantIds.includes(bail.locataireId) ? [] : [`${bail.numero} : locataire ${bail.locataireId} au lieu de ${lease.tenantIds.join(',')}`]),
        ...(bail.locataire === nameOf(bail.locataireId) ? [] : [`${bail.numero} : nom ${bail.locataire}`]),
        ...(bail.unite === unit?.label ? [] : [`${bail.numero} : unité ${bail.unite} au lieu de ${String(unit?.label)}`]),
        ...(bail.immeuble === unit?.building ? [] : [`${bail.numero} : immeuble ${bail.immeuble}`]),
      ];
    });
    expect(problems).toEqual([]);
  });

  it('un locataire n’a qu’un bail financier', () => {
    const ids = finances.baux.map((bail) => bail.locataireId);
    expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
  });

  it('les échéances de novembre 2026 valent loyer + charges du bail', () => {
    const problems = finances.baux.flatMap((bail) => {
      const lease = leaseOfBail(bail.numero);
      const called = finances.echeances
        .filter((item) => item.bailId === bail.id && item.echeance.startsWith('2026-11') && item.statut === 'active')
        .reduce((sum, item) => sum + item.montant, 0);
      return lease && called === cc(lease) ? [] : [`${bail.numero} : ${String(called)} appelés pour ${String(lease && cc(lease))}`];
    });
    expect(problems).toEqual([]);
  });

  it('les échéances de décembre 2026 valent loyer + charges du bail', () => {
    const problems = finances.echeances
      .filter((item) => item.echeance.startsWith('2026-12'))
      .flatMap((item) => {
        const bail = finances.baux.find((entry) => entry.id === item.bailId);
        const lease = bail && leaseOfBail(bail.numero);
        return lease && item.montant === cc(lease) ? [] : [item.id];
      });
    expect(problems).toEqual([]);
  });

  it('échéances, paiements, reçus et factures ne citent que des baux et locataires existants', () => {
    const bailIds = new Set(finances.baux.map((bail) => bail.id));
    const problems = [
      ...finances.echeances.filter((item) => !bailIds.has(item.bailId)).map((item) => `échéance ${item.id}`),
      ...finances.paiements.filter((item) => !bailIds.has(item.bailId)).map((item) => `paiement ${item.id}`),
      ...finances.recus.filter((item) => !bailIds.has(item.bailId)).map((item) => `reçu ${item.id}`),
      ...finances.factures.filter((item) => !tenantById.has(item.locataireId)).map((item) => `facture ${item.numero} : ${item.locataireId}`),
      ...finances.factures
        .filter((item) => item.bailId !== null && finances.baux.find((bail) => bail.id === item.bailId)?.locataireId !== item.locataireId)
        .map((item) => `facture ${item.numero} : bail ${String(item.bailId)}`),
    ];
    expect(problems).toEqual([]);
  });

  it('les impayés correspondent aux soldes des baux', () => {
    const problems = finances.baux.flatMap((bail) => {
      const lease = leaseOfBail(bail.numero);
      const due = finances.echeances
        .filter((item) => item.bailId === bail.id && item.echeance.startsWith('2026-11'))
        .reduce((sum, item) => sum + Math.max(0, item.montant - item.paye), 0);
      return lease && due === Math.max(0, -lease.balance) ? [] : [`${bail.numero} : ${String(due)} dus, solde du bail ${String(lease?.balance)}`];
    });
    expect(problems).toEqual([]);
  });

  it('chaque bail en cours du référentiel a son bail financier et ses échéances de novembre', () => {
    const problems = currentLeases.flatMap((lease) => {
      const bail = finances.baux.find((item) => item.numero === lease.reference);
      if (!bail) return [`${lease.reference} : aucun bail financier`];
      const row = buildInstallments(lease).find((item) => item.month === '2026-11');
      const own = finances.echeances.filter((item) => item.bailId === bail.id && item.echeance.startsWith('2026-11'));
      const [call] = own;
      if (!row || own.length !== 1 || !call) return [`${lease.reference} : ${String(own.length)} échéance(s) de novembre`];
      return [
        ...(call.montant === row.called ? [] : [`${lease.reference} : appelé ${String(call.montant)} au lieu de ${String(row.called)}`]),
        ...(Math.min(call.paye, call.montant) === row.received ? [] : [`${lease.reference} : encaissé ${String(call.paye)} au lieu de ${String(row.received)}`]),
      ];
    });
    expect(problems).toEqual([]);
  });

  it('les échéances financières restent dans la durée du bail et reprennent les appels de l’échéancier des baux', () => {
    const problems = finances.echeances.flatMap((item) => {
      const bail = finances.baux.find((entry) => entry.id === item.bailId);
      const lease = bail && leaseOfBail(bail.numero);
      if (!lease) return [`${item.id} : bail introuvable`];
      const month = item.echeance.slice(0, 7);
      const row = buildInstallments(lease).find((entry) => entry.month === month);
      return [
        ...(month >= lease.start.slice(0, 7) && month <= lease.end.slice(0, 7) ? [] : [`${item.id} : ${item.echeance} hors du bail ${lease.reference}`]),
        ...(row && item.montant === cc(lease) && row.called >= item.montant ? [] : [`${item.id} : aucun appel correspondant dans l’échéancier de ${lease.reference}`]),
      ];
    });
    expect(problems).toEqual([]);
  });

  it('un bail brouillon ou à venir n’a ni bail, ni échéance, ni paiement en Finances, comme dans l’échéancier des baux', () => {
    const pending = demoLeases.filter((lease) => lease.status === 'brouillon' || lease.status === 'a_venir');
    expect(pending.map((lease) => lease.reference)).toEqual(['BL-2026-0017', 'BL-2026-0018']);
    const problems = pending.flatMap((lease) => {
      const id = finances.baux.find((item) => item.numero === lease.reference)?.id;
      return [
        ...(id === undefined ? [] : [`${lease.reference} : bail financier`]),
        ...(buildInstallments(lease).length === 0 ? [] : [`${lease.reference} : échéancier des baux non vide`]),
        ...finances.echeances.filter((item) => item.bailId === slugify(lease.reference)).map((item) => `${lease.reference} : échéance ${item.id}`),
        ...finances.paiements.filter((item) => item.bailId === slugify(lease.reference)).map((item) => `${lease.reference} : paiement ${item.id}`),
      ];
    });
    expect(problems).toEqual([]);
  });

  it('un renouvellement en brouillon prolonge le bail financier du locataire sans rupture ni appel anticipé', () => {
    const renewals = demoLeases.filter((lease) => lease.status === 'brouillon');
    expect(renewals.map((lease) => lease.reference)).toEqual(['BL-2026-0018']);
    const problems = renewals.flatMap((renewal) => {
      const current = currentLeases.find((lease) => lease.unitId === renewal.unitId && lease.tenantIds[0] === renewal.tenantIds[0]);
      if (!current) return [`${renewal.reference} : aucun bail en cours à renouveler`];
      const bail = finances.baux.find((item) => item.numero === current.reference);
      return [
        ...(dayAfter(current.end) === renewal.start ? [] : [`${renewal.reference} : début ${renewal.start}, le bail en cours finit le ${current.end}`]),
        ...(cc(current) === cc(renewal) ? [] : [`${renewal.reference} : ${String(cc(renewal))} appelés au lieu de ${String(cc(current))}`]),
        ...(bail?.locataireId === renewal.tenantIds[0] ? [] : [`${renewal.reference} : bail financier ${String(bail?.numero)}`]),
        ...finances.echeances.filter((item) => item.bailId === bail?.id && item.echeance >= renewal.start).map((item) => `${item.id} : appel dès ${item.echeance}`),
      ];
    });
    expect(problems).toEqual([]);
  });
});

describe('cohérence inter-lots : Biens', () => {
  const state = createDemoState();

  it('l’occupant d’un lot est le locataire du bail en cours de l’unité correspondante, sinon le lot est vacant', () => {
    const problems = state.lots.flatMap((lot) => {
      const { row } = lot;
      const lease = currentLeaseOfUnit(row.id);
      if (unitById.has(row.id)) {
        if (!lease) return row.tenant === null ? [] : [`${row.id} : occupé par ${row.tenant.name} sans bail en cours`];
        const tenant = tenantById.get(lease.tenantIds[0] ?? '');
        return [
          ...(row.tenant?.id === tenant?.id && row.tenant?.name === nameOf(lease.tenantIds[0] ?? '') ? [] : [`${row.id} : occupant ${String(row.tenant?.name)}`]),
          ...(row.rent === cc(lease) ? [] : [`${row.id} : loyer ${String(row.rent)} au lieu de ${String(cc(lease))}`]),
          ...(lot.rentExcl === lease.rent && lot.charges === lease.charges ? [] : [`${row.id} : loyer hors charges ${String(lot.rentExcl)} + ${String(lot.charges)}`]),
          ...(row.leaseEnd === lease.end ? [] : [`${row.id} : fin ${String(row.leaseEnd)} au lieu de ${lease.end}`]),
          ...(row.status === (tenant?.state === 'retard' || tenant?.state === 'preavis' ? tenant.state : 'a_jour') ? [] : [`${row.id} : statut ${row.status}`]),
        ];
      }
      if (!row.tenant) return [];
      const tenant = tenantById.get(row.tenant.id);
      const rented = tenant && currentLeases.some((item) => item.tenantIds.includes(tenant.id));
      return rented && row.tenant.name === nameOf(row.tenant.id) ? [] : [`${row.id} : occupant ${row.tenant.name} sans bail en cours`];
    });
    expect(problems).toEqual([]);
  });

  it('un candidat n’occupe aucun lot', () => {
    const candidateIds = new Set(demoCandidates.map((candidate) => candidate.id));
    expect(state.lots.filter((lot) => lot.row.tenant && candidateIds.has(lot.row.tenant.id)).map((lot) => lot.row.id)).toEqual([]);
  });

  it('les fiches de lot (bail, périodes d’occupation) reprennent le bail canonique', () => {
    const problems = Object.entries(state.lotExtras).flatMap(([lotId, extras]) => {
      const lease = currentLeaseOfUnit(lotId);
      if (!lease) return [`${lotId} : aucun bail en cours`];
      const block = extras.lease;
      const current = extras.occupation?.periods.find((period) => period.kind === 'bail' && (period.status === 'en_cours' || period.status === 'preavis'));
      const former = (extras.occupation?.periods ?? []).filter((period) => period.kind === 'bail' && period.occupant && demoCandidates.some((candidate) => candidate.id === period.occupant?.id));
      return [
        ...(block !== null && block.tenant.id === lease.tenantIds[0] && block.rentExcl === lease.rent && block.provisions === lease.charges && block.deposit === lease.deposit && block.startDate === lease.start && block.endDate === lease.end ? [] : [`${lotId} : bloc bail`]),
        ...(current !== undefined && current.occupant?.id === lease.tenantIds[0] && current.lastRent === lease.rent && current.deposit === lease.deposit && current.startDate === lease.start ? [] : [`${lotId} : période en cours`]),
        ...former.map((period) => `${lotId} : candidat ${period.id} dans l’historique`),
        ...(extras.occupation?.periods ?? [])
          .filter((period) => period.kind === 'bail' && period.status === 'termine' && period.occupant && demoLeases.some((item) => item.unitId === lotId && item.status === 'termine' && item.tenantIds.includes(period.occupant?.id ?? '')))
          .filter((period) => !demoLeases.some((item) => item.unitId === lotId && item.tenantIds.includes(period.occupant?.id ?? '') && item.start === period.startDate && item.end === period.endDate))
          .map((period) => `${lotId} : période ${period.id} hors dates du bail terminé`),
      ];
    });
    expect(problems).toEqual([]);
  });

  it('les inventaires citent l’occupant du lot ou un ancien occupant', () => {
    const problems = state.inventaires.flatMap((item) => {
      if (item.tenant === null) return [];
      const known = new Set<string>([
        ...demoLeases.filter((lease) => lease.unitId === item.lotId).map((lease) => nameOf(lease.tenantIds[0] ?? '')),
        ...(state.lotExtras[item.lotId]?.occupation?.periods ?? []).flatMap((period) => (period.occupant ? [period.occupant.name] : [])),
      ]);
      return known.has(item.tenant) ? [] : [`${item.ref} : ${item.tenant} n’a jamais occupé ${item.lotId}`];
    });
    expect(problems).toEqual([]);
  });

  it('la régularisation des charges cite les occupants des lots', () => {
    const rows = Object.values(state.immeubleExtras).flatMap((extras) => extras.charges?.regularisation ?? []);
    const problems = rows.flatMap((row) => {
      const lot = state.lots.find((item) => item.row.id === row.lotId);
      return lot?.row.tenant?.name === row.tenant && lot.row.name === row.lotName ? [] : [`${row.lotId} : ${String(row.tenant)}`];
    });
    expect(problems).toEqual([]);
  });

  it('chaque unité longue durée du référentiel a son lot, avec le même libellé et le même immeuble', () => {
    const buildingOf = new Map(state.immeubles.map((item) => [item.row.id, item.row.name]));
    const problems = demoUnits
      .filter((unit) => !seasonalUnits.has(unit.id))
      .flatMap((unit) => {
        const lot = state.lots.find((item) => item.row.id === unit.id);
        if (!lot) return [`${unit.id} : aucun lot`];
        return [
          ...(lot.row.name === unit.label ? [] : [`${unit.id} : nom ${lot.row.name}`]),
          ...(buildingOf.get(lot.row.immeubleId) === unit.building ? [] : [`${unit.id} : immeuble ${lot.row.immeubleId}`]),
          ...(lot.row.archived ? [`${unit.id} : archivé`] : []),
        ];
      });
    expect(problems).toEqual([]);
  });

  it('un lot vacant dont un bail est à venir affiche le loyer de ce bail', () => {
    const problems = demoLeases
      .filter((lease) => lease.status === 'a_venir')
      .flatMap((lease) => {
        const lot = state.lots.find((item) => item.row.id === lease.unitId);
        if (!lot) return [`${lease.reference} : aucun lot ${lease.unitId}`];
        return [
          ...(lot.row.tenant === null ? [] : [`${lot.row.id} : occupé avant le début du bail`]),
          ...(lot.row.rent === cc(lease) && lot.rentExcl === lease.rent && lot.charges === lease.charges ? [] : [`${lot.row.id} : loyer ${String(lot.row.rent)} au lieu de ${String(cc(lease))}`]),
        ];
      });
    expect(problems).toEqual([]);
  });

  it('les tantièmes et la régularisation des charges reprennent les lots actifs de l’immeuble', () => {
    const lots = state.lots.filter((lot) => lot.row.immeubleId === 'les-tilleuls' && !lot.row.archived);
    const charges = state.immeubleExtras['les-tilleuls']?.charges;
    const sum = lots.reduce((total, lot) => total + (lot.row.tantiemes ?? 0), 0);
    expect(charges?.sharePerMille).toBe(sum);
    expect(state.immeubleExtras['les-tilleuls']?.keys.find((key) => key.id === 'generales')?.detail).toBe(`Tantièmes, ${String(sum)} / 1 000`);
    const rented = lots.filter((lot) => lot.row.tenant !== null).map((lot) => lot.row.id);
    expect((charges?.regularisation ?? []).map((row) => row.lotId).sort()).toEqual(rented.sort());
    expect(lots.map((lot) => lot.row.tantiemes).every((value) => value !== null && value > 0)).toBe(true);
  });

  it('inventaires, équipements et compteurs ne citent que des lots existants, sous leur nom', () => {
    const lotById = new Map(state.lots.map((lot) => [lot.row.id, lot.row]));
    const problems = [
      ...state.inventaires.filter((item) => lotById.get(item.lotId)?.name !== item.lotName).map((item) => `inventaire ${item.ref} : ${item.lotId}`),
      ...state.equipements.filter((item) => item.row.lotId !== null && lotById.get(item.row.lotId)?.name !== item.row.placeName).map((item) => `équipement ${item.row.id} : ${String(item.row.lotId)}`),
      ...state.meters.filter((item) => !lotById.has(item.lotId)).map((item) => `compteur ${item.id}`),
      ...state.readings.filter((item) => lotById.get(item.lotId)?.name !== item.lotName).map((item) => `relevé ${item.id}`),
    ];
    expect(problems).toEqual([]);
  });

  it('le bureau compte les lots du portefeuille', () => {
    const active = state.lots.filter((lot) => !lot.row.archived);
    expect(demoBureau.occupancy).toEqual({ rented: active.filter((lot) => lot.row.tenant !== null).length, total: active.length });
    expect(demoShell.counts.lots).toBe(active.length);
  });
});

describe('cohérence inter-lots : Courriers', () => {
  it('courriers, quittances et avis citent le locataire et l’unité de leur bail', () => {
    const problems = [
      ...demoCourriers.map((item) => ({ ref: item.reference, tenantId: item.tenantId, unitId: item.unitId })),
      ...demoReceipts.map((item) => ({ ref: item.id, tenantId: item.tenantId, unitId: item.unitId })),
      ...demoNotices.map((item) => ({ ref: item.id, tenantId: item.tenantId, unitId: item.unitId })),
    ].flatMap(({ ref, tenantId, unitId }) =>
      demoLeases.some((lease) => lease.unitId === unitId && lease.tenantIds.includes(tenantId)) ? [] : [`${ref} : ${tenantId} sur ${String(unitId)}`],
    );
    expect(problems).toEqual([]);
  });

  it('un numéro de bail cité dans un courrier est celui du bail du destinataire', () => {
    const problems = demoCourriers.flatMap((item) => {
      const cited = item.body.match(/BL-\d{4}-\d{4}/g) ?? [];
      const lease = demoLeases.find((entry) => entry.unitId === item.unitId && entry.tenantIds.includes(item.tenantId));
      return cited.filter((reference) => reference !== lease?.reference).map((reference) => `${item.reference} : ${reference}`);
    });
    expect(problems).toEqual([]);
    expect(demoCourriers.some((item) => /BL-\d{4}-\d{4}/.test(item.body))).toBe(true);
  });

  it('les montants des quittances et avis sont ceux du bail', () => {
    const problems = [...demoReceipts, ...demoNotices].flatMap((item) => {
      const lease = demoLeases.find((entry) => entry.id === item.leaseId);
      return lease?.rent === item.rent && lease.charges === item.charges ? [] : [item.id];
    });
    expect(problems).toEqual([]);
  });
});

describe('cohérence inter-lots : Suivi', () => {
  it('la table bien → locataire reprend les baux en cours', () => {
    const problems = Object.entries(TENANT_BY_BIEN).flatMap(([bienId, name]) => {
      const lease = currentLeaseOfUnit(bienId);
      return lease && nameOf(lease.tenantIds[0] ?? '') === name ? [] : [`${bienId} : ${name}`];
    });
    expect(problems).toEqual([]);
    expect(tenantOf('apt-b3')).toBeNull();
  });

  it('les documents partagés avec un locataire le sont avec celui du bien, et un bien sans bail n’a ni quittance ni avis', () => {
    const problems = demoDocuments.flatMap((document) => {
      const missing = document.sharedWith === null && /^(Quittance|Avis d'échéance)/.test(document.fileName) ? [`${document.id} : sans destinataire`] : [];
      const wrong = document.sharedWith !== null && document.sharedWith !== tenantOf(document.bienId ?? '') ? [`${document.id} : ${document.sharedWith}`] : [];
      return [...missing, ...wrong];
    });
    expect(problems).toEqual([]);
  });

  it('les interventions préviennent le locataire du bien', () => {
    const problems = demoInterventions.flatMap((intervention) =>
      intervention.history
        .filter((entry) => entry.label === 'Locataire prévenu')
        .filter((entry) => entry.detail !== tenantOf(intervention.bienId))
        .map((entry) => `${intervention.id} : ${entry.detail}`),
    );
    expect(problems).toEqual([]);
  });

  it('l’agenda ne cite que des locataires ou candidats connus, et le bon locataire pour un bien loué', () => {
    const problems = [
      ...demoEvents.flatMap((event) => event.invitees.filter((name) => !personNames.has(name)).map((name) => `${event.id} : ${name}`)),
      ...demoEcheances.filter((item) => item.bienId !== null && tenantNames.has(item.detail) && item.detail !== tenantOf(item.bienId)).map((item) => item.id),
      ...demoEvents.filter((event) => event.title.startsWith('Anniversaire de ') && event.title.replace('Anniversaire de ', '') !== tenantOf(event.bienId ?? '')).map((event) => event.id),
    ];
    expect(problems).toEqual([]);
  });

  it('les garants sont ceux d’un locataire existant, rattaché à son bien ou à son immeuble', () => {
    const bienOfBuilding: Record<string, string> = { 'Les Tilleuls': 'les-tilleuls', 'Résidence du Parc': 'residence-du-parc', 'Maison Rivière': 'villa-rdc' };
    const problems = demoContacts.flatMap((contact) => {
      const match = /^Garante? d[e’']\s?(.+)$/.exec(contact.subtitle);
      if (!match) return [];
      const tenant = demoTenants.find((item) => `${item.firstName} ${item.lastName}` === match[1]);
      const lease = demoLeases.find((item) => item.tenantIds.includes(tenant?.id ?? '') && (isCurrent(item) || item.status === 'a_venir'));
      const unit = lease ? unitById.get(lease.unitId) : undefined;
      if (!tenant || !unit) return [`${contact.id} : ${String(match[1])} sans bail en cours ou à venir`];
      const allowed = [unit.id, bienOfBuilding[unit.building] ?? ''];
      return contact.bienIds.every((id) => allowed.includes(id)) ? [] : [`${contact.id} : biens ${contact.bienIds.join(',')} pour ${unit.id}`];
    });
    expect(problems).toEqual([]);
  });
});

describe('cohérence inter-lots : Bureau, Rapports et Analytique', () => {
  const finances = createDemoFinances();
  const november = finances.echeances.filter((item) => item.echeance.startsWith('2026-11') && item.statut === 'active');

  it('le bureau reprend les appels, encaissements et impayés de novembre', () => {
    const called = november.reduce((sum, item) => sum + item.montant, 0);
    const collected = november.reduce((sum, item) => sum + Math.min(item.paye, item.montant), 0);
    const late = november.filter((item) => item.paye < item.montant);
    expect(demoBureau.collection).toEqual({ called, collected });
    expect(demoBureau.arrears.amount).toBe(called - collected);
    expect(demoBureau.arrears.tenants).toBe(late.length);
    expect(demoBureau.rentHistory.at(-1)).toMatchObject({ month: '2026-11', called, collected });
    expect(called).toBe(currentLeases.reduce((sum, lease) => sum + cc(lease), 0));
  });

  it('le bureau ne cite que des locataires connus, avec leur unité', () => {
    const problems = demoBureau.recentPayments.flatMap((payment) => {
      const tenant = demoTenants.find((item) => `${item.firstName} ${item.lastName}` === payment.tenant);
      const unit = tenant?.unitId ? unitById.get(tenant.unitId) : undefined;
      const paid = finances.paiements.find((item) => item.date === payment.date && item.montant === payment.amount && item.libelle.endsWith(payment.tenant));
      return unit?.label === payment.unit && paid ? [] : [`${payment.id} : ${payment.tenant}, ${payment.unit}`];
    });
    expect(problems).toEqual([]);
  });

  it('le bureau et les notifications ne citent ni candidat comme locataire ni bail inexistant', () => {
    const text = [...demoShell.notifications.map((item) => `${item.title} ${item.detail}`), ...demoBureau.todos.map((item) => `${item.title} ${item.detail}`)].join('\n');
    expect(text).not.toMatch(/Léa Martin|Lot B3|Studio C2/);
    expect(demoShell.notifications.find((item) => item.title === 'Bail signé')?.detail).toContain('Mariam Sy');
  });

  it('les loyers du rapport sont ceux des baux en cours', () => {
    const problems = createDemoLoyers().lots.flatMap((lot) => {
      const lease = currentLeaseOfUnit(lot.id);
      if (!lease) return [`${lot.id} : aucun bail en cours`];
      return lease.tenantIds[0] === lot.tenantId && lot.tenantName === nameOf(lot.tenantId) && lot.rent === cc(lease) ? [] : [`${lot.id} : ${lot.tenantName}, ${String(lot.rent)}`];
    });
    expect(problems).toEqual([]);
  });

  it('l’analytique reprend les impayés et les fins de bail', () => {
    const problems = [
      ...ARREARS.flatMap((item) => {
        const lease = currentLeaseOfUnit(item.lotId);
        return lease && nameOf(lease.tenantIds[0] ?? '') === item.tenant && -lease.balance === item.amount ? [] : [`impayé ${item.lotId}`];
      }),
      ...LEASE_ENDS.filter((item) => unitById.has(item.lotId)).flatMap((item) => {
        const lease = currentLeaseOfUnit(item.lotId);
        if (!lease) return [`fin de bail ${item.lotId} : aucun bail en cours`];
        return lease.end === item.date ? [] : [`fin de bail ${item.lotId} : ${item.date}`];
      }),
    ];
    expect(problems).toEqual([]);
    expect(LEASE_ENDS.map((item) => item.lotId)).not.toContain('lot-b3');
  });
});
