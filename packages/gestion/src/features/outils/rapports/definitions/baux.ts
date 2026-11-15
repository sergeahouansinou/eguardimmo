import { formatDateFr, formatRoundedEuros, plural } from '../../analytique/format';
import { indexOfColumns, sumAt } from '../engine/engine';
import { FUTURE_PERIODS, inPeriod } from '../engine/periods';
import type { ReportDefinition } from '../engine/types';
import { GROUP_BUILDING, GROUP_NONE, daysBetween, isCurrent, lotIndex, makeRow, ratio } from './shared';

const LOCATIF_COLUMNS = [
  { id: 'building', label: 'Immeuble', kind: 'text' },
  { id: 'lot', label: 'Bien', kind: 'text' },
  { id: 'tenant', label: 'Locataire', kind: 'text' },
  { id: 'status', label: 'Situation', kind: 'text' },
  { id: 'start', label: 'Début du bail', kind: 'date' },
  { id: 'end', label: 'Fin du bail', kind: 'date' },
  { id: 'rent', label: 'Loyer', kind: 'money', total: 'sum' },
  { id: 'charges', label: 'Charges', kind: 'money', total: 'sum' },
  { id: 'total', label: 'Total mensuel', kind: 'money', total: 'sum' },
] as const;
const locatif = indexOfColumns(LOCATIF_COLUMNS);

export const etatLocatif: ReportDefinition = {
  slug: 'etat-locatif',
  title: 'ÉTAT LOCATIF',
  description: 'Chaque lot, son locataire, son bail et son loyer mensuel.',
  periods: null,
  filters: { lot: true, tenant: true },
  groups: [GROUP_BUILDING, { value: 'status', label: 'Regrouper par : Situation', attr: 'status' }, GROUP_NONE],
  columns: LOCATIF_COLUMNS,
  emptyHint: 'Aucun lot ne correspond à ce périmètre.',
  rows: ({ data }) =>
    data.lots.map((lot) => {
      const current = data.leases.find((lease) => lease.lotId === lot.id && isCurrent(lease));
      const upcoming = data.leases.find((lease) => lease.lotId === lot.id && lease.status === 'a_venir');
      if (!current) {
        const status = upcoming ? `Vacant, bail à venir le ${formatDateFr(upcoming.start)}` : 'Vacant';
        return makeRow(lot.id, { lotId: lot.id }, { building: lot.buildingName, status: 'Vacant' }, [lot.buildingName, lot.name, null, status, null, null, null, null, null], 'warning');
      }
      const status = current.status === 'preavis' ? 'Préavis reçu' : 'Loué';
      return makeRow(
        lot.id,
        { lotId: lot.id, tenantId: current.tenantId },
        { building: lot.buildingName, status },
        [lot.buildingName, lot.name, current.tenantName, status, current.start, current.end, current.rent, current.charges, current.rent + current.charges],
      );
    }),
  kpis: (rows) => {
    const rented = rows.filter((row) => row.tenantId !== null).length;
    return [
      { label: 'Lots', value: String(rows.length), caption: plural(rows.length - rented, 'vacant', 'vacants') },
      { label: 'Taux d’occupation', value: `${Math.round(ratio(rented, rows.length)).toString()} %` },
      { label: 'Loyers mensuels', value: formatRoundedEuros(sumAt(rows, locatif('rent'))) },
      { label: 'Total charges comprises', value: formatRoundedEuros(sumAt(rows, locatif('total'))) },
    ];
  },
};

const ECHEANCES_COLUMNS = [
  { id: 'building', label: 'Immeuble', kind: 'text' },
  { id: 'lot', label: 'Bien', kind: 'text' },
  { id: 'tenant', label: 'Locataire', kind: 'text' },
  { id: 'event', label: 'Échéance', kind: 'text' },
  { id: 'date', label: 'Date', kind: 'date' },
  { id: 'days', label: 'Dans (jours)', kind: 'int' },
  { id: 'index', label: 'Indice', kind: 'text' },
  { id: 'rent', label: 'Loyer actuel', kind: 'money', total: 'sum' },
] as const;
const echeances = indexOfColumns(ECHEANCES_COLUMNS);

export const echeancesRevisions: ReportDefinition = {
  slug: 'echeances-et-revisions',
  title: 'ÉCHÉANCES ET RÉVISIONS',
  description: 'Fins de bail et révisions de loyer à venir.',
  periods: FUTURE_PERIODS,
  filters: { lot: true, tenant: true },
  groups: [GROUP_NONE, GROUP_BUILDING, { value: 'event', label: 'Regrouper par : Type', attr: 'event' }],
  columns: ECHEANCES_COLUMNS,
  emptyHint: 'Aucune fin de bail ni révision de loyer n’est prévue sur cette période.',
  rows: ({ data, period, today }) => {
    const lots = lotIndex(data);
    return data.leases.filter(isCurrent).flatMap((lease) => {
      const building = lots.get(lease.lotId)?.buildingName ?? 'Autres';
      const lot = lots.get(lease.lotId)?.name ?? lease.lotId;
      const make = (event: string, date: string, index: string) =>
        makeRow(
          `${event}-${lease.lotId}`,
          { lotId: lease.lotId, tenantId: lease.tenantId },
          { building, event },
          [building, lot, lease.tenantName, event, date, daysBetween(today, date), index, lease.rent],
          daysBetween(today, date) <= 60 ? 'warning' : undefined,
        );
      return [
        ...(inPeriod(lease.end, period) ? [make('Fin de bail', lease.end, '')] : []),
        ...(inPeriod(lease.nextRevision, period) && lease.nextRevision !== lease.end ? [make('Révision du loyer', lease.nextRevision, lease.revisionIndex)] : []),
      ];
    }).sort((a, b) => String(a.cells[echeances('date')]).localeCompare(String(b.cells[echeances('date')])));
  },
  kpis: (rows) => [
    { label: 'Échéances', value: String(rows.length) },
    { label: 'Fins de bail', value: String(rows.filter((row) => row.attrs.event === 'Fin de bail').length) },
    { label: 'Révisions de loyer', value: String(rows.filter((row) => row.attrs.event === 'Révision du loyer').length) },
    { label: 'Prochaine échéance', value: formatDateFr(String(rows[0]?.cells[echeances('date')] ?? '')) },
  ],
};

const OCCUPANTS_COLUMNS = [
  { id: 'building', label: 'Immeuble', kind: 'text' },
  { id: 'lot', label: 'Bien', kind: 'text' },
  { id: 'occupant', label: 'Occupant', kind: 'text' },
  { id: 'role', label: 'Qualité', kind: 'text' },
  { id: 'since', label: 'Présent depuis', kind: 'date' },
  { id: 'email', label: 'E-mail', kind: 'text' },
  { id: 'state', label: 'Compte', kind: 'text' },
] as const;

const OCCUPANT_STATES: Record<string, string> = { a_jour: 'À jour', retard: 'En retard', preavis: 'Préavis', invitation: 'Invité' };

export const occupantsBiens: ReportDefinition = {
  slug: 'occupants-des-biens',
  title: 'OCCUPANTS DES BIENS',
  description: 'Locataires et colocataires présents dans chaque bien.',
  periods: null,
  filters: { lot: true, tenant: true },
  groups: [GROUP_BUILDING, GROUP_NONE],
  columns: OCCUPANTS_COLUMNS,
  emptyHint: 'Aucun occupant ne correspond à ce périmètre.',
  rows: ({ data }) => {
    const lots = lotIndex(data);
    return data.occupants.map((occupant) => {
      const state = OCCUPANT_STATES[occupant.state] ?? occupant.state;
      const building = lots.get(occupant.lotId)?.buildingName ?? 'Autres';
      return makeRow(
        occupant.tenantId,
        { lotId: occupant.lotId, tenantId: occupant.tenantId },
        { building },
        [building, lots.get(occupant.lotId)?.name ?? occupant.lotId, occupant.name, 'Locataire titulaire', occupant.since, occupant.email, state],
        occupant.state === 'retard' ? 'danger' : occupant.state === 'preavis' ? 'warning' : undefined,
      );
    });
  },
  kpis: (rows) => [
    { label: 'Occupants', value: String(rows.length) },
    { label: 'Lots occupés', value: String(new Set(rows.map((row) => row.lotId)).size) },
    { label: 'Comptes en retard', value: String(rows.filter((row) => row.tone === 'danger').length), tone: rows.some((row) => row.tone === 'danger') ? 'danger' : 'default' },
    { label: 'Préavis reçus', value: String(rows.filter((row) => row.tone === 'warning').length) },
  ],
};

const DIAGNOSTICS_COLUMNS = [
  { id: 'building', label: 'Immeuble', kind: 'text' },
  { id: 'lot', label: 'Bien', kind: 'text' },
  { id: 'kind', label: 'Type', kind: 'text' },
  { id: 'item', label: 'Document', kind: 'text' },
  { id: 'doneOn', label: 'Réalisé le', kind: 'date' },
  { id: 'expiresOn', label: 'Valable jusqu’au', kind: 'date' },
  { id: 'status', label: 'État', kind: 'text' },
] as const;

const DIAGNOSTIC_STATES: Record<string, string> = { valide: 'Valide', a_refaire: 'À refaire', expire: 'Expiré' };
const INSURANCE_STATES: Record<string, string> = { valide: 'Valide', expire: 'Expirée', manquante: 'Pièce manquante' };

export const diagnosticsAssurances: ReportDefinition = {
  slug: 'diagnostics-et-assurances',
  title: 'DIAGNOSTICS ET ASSURANCES',
  description: 'Validité des diagnostics et des attestations d’assurance, pièces manquantes.',
  periods: null,
  filters: { lot: true, tenant: false },
  groups: [GROUP_BUILDING, { value: 'status', label: 'Regrouper par : État', attr: 'status' }, GROUP_NONE],
  columns: DIAGNOSTICS_COLUMNS,
  emptyHint: 'Aucun diagnostic ni attestation d’assurance ne correspond à ce périmètre.',
  rows: ({ data }) => {
    const lots = lotIndex(data);
    const building = (lotId: string): string => lots.get(lotId)?.buildingName ?? 'Autres';
    const lot = (lotId: string): string => lots.get(lotId)?.name ?? lotId;
    const diagnostics = data.diagnostics
      .filter((item) => item.status !== 'sans_objet')
      .map((item, index) => {
        const status = DIAGNOSTIC_STATES[item.status] ?? item.status;
        return makeRow(
          `diag-${item.lotId}-${String(index)}`,
          { lotId: item.lotId },
          { building: building(item.lotId), status },
          [building(item.lotId), lot(item.lotId), 'Diagnostic', item.label, item.doneOn, item.expiresOn, status],
          item.status === 'expire' ? 'danger' : item.status === 'a_refaire' ? 'warning' : undefined,
        );
      });
    const insurances = data.insurances.map((item) => {
      const status = INSURANCE_STATES[item.status] ?? item.status;
      return makeRow(
        `assurance-${item.lotId}`,
        { lotId: item.lotId },
        { building: building(item.lotId), status },
        [building(item.lotId), lot(item.lotId), 'Assurance', `Attestation de ${item.tenantName}`, null, item.validUntil, status],
        item.status === 'valide' ? undefined : 'danger',
      );
    });
    return [...diagnostics, ...insurances];
  },
  kpis: (rows) => [
    { label: 'Documents suivis', value: String(rows.length) },
    { label: 'Valides', value: String(rows.filter((row) => row.tone === undefined).length) },
    { label: 'À refaire', value: String(rows.filter((row) => row.tone === 'warning').length) },
    { label: 'Expirés ou manquants', value: String(rows.filter((row) => row.tone === 'danger').length), tone: rows.some((row) => row.tone === 'danger') ? 'danger' : 'default' },
  ],
};
