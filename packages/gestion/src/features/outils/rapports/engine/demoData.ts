import { demoAttestations, demoLeases } from '../../../baux/demo';
import { aptA1Extras } from '../../../biens/demo/seed-lot-details';
import { createDemoFinances } from '../../../finances/demo';
import { demoTenants, demoUnits } from '../../../locataires/demo';
import { DEMO_NOW, DEMO_TODAY, euros, slugify } from '../../kit';
import { createDemoLoyers } from '../demo';
import type { ReportsData } from './data';

const MONTHS_2026 = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11'].map((month) => `2026-${month}`);

const EXPENSE_KINDS: Record<string, string> = {
  reparation: 'Réparation',
  entretien: 'Entretien',
  taxe: 'Taxe',
  assurance: 'Assurance',
  energie: 'Énergie',
  autre: 'Autre',
};

const PRICES: Record<string, [number, number, number, number]> = {
  'apt-a2': [168000, 2017, 205000, 2026],
  'apt-b1': [143000, 2018, 171000, 2026],
  'apt-a3': [150000, 2016, 182000, 2026],
  'apt-b2': [158000, 2018, 188000, 2026],
  'studio-b3': [96000, 2019, 109000, 2026],
  'studio-2e': [98000, 2019, 112000, 2026],
  'studio-c2': [88000, 2020, 99000, 2026],
  'villa-rdc': [410000, 2015, 520000, 2026],
};

const INSURERS = ['Assurances Rivière', 'MAIF', 'Matmut', 'AXA'];

function splitProperty(label: string): { lotName: string; buildingName: string } {
  const [lotName = label, buildingName = ''] = label.split(', ');
  return { lotName, buildingName };
}

export function createDemoReportsData(): ReportsData {
  const finances = createDemoFinances();
  const loyers = createDemoLoyers();
  const tenantName = new Map(demoTenants.map((tenant) => [tenant.id, `${tenant.firstName} ${tenant.lastName}`]));
  const unitName = new Map(demoUnits.map((unit) => [unit.id, unit.label]));

  const leases = demoLeases.flatMap((lease) => {
    const status = lease.status;
    if (lease.tenantIds.length === 0 || (status !== 'en_cours' && status !== 'preavis' && status !== 'a_venir')) return [];
    return [{
      lotId: lease.unitId,
      reference: lease.reference,
      tenantId: lease.tenantIds[0] ?? '',
      tenantName: tenantName.get(lease.tenantIds[0] ?? '') ?? 'Locataire',
      furnished: lease.furnished,
      status,
      start: lease.start,
      end: lease.end,
      rent: lease.rent,
      charges: lease.charges,
      deposit: lease.deposit,
      depositReceivedOn: lease.depositReceivedOn,
      nextRevision: lease.nextRevision ?? lease.end,
      revisionIndex: lease.revisionIndex,
    }];
  });

  const known = new Map(loyers.lots.map((lot) => [lot.id, lot.payments]));
  const payments = leases
    .filter((lease) => lease.status !== 'a_venir')
    .flatMap((lease) => {
      const fixture = known.get(lease.lotId);
      if (fixture) return fixture.map((payment) => ({ lotId: lease.lotId, month: payment.month, called: lease.rent + lease.charges, collected: payment.amount }));
      return MONTHS_2026.filter((month) => month >= lease.start.slice(0, 7)).map((month) => ({
        lotId: lease.lotId,
        month,
        called: lease.rent + lease.charges,
        collected: lease.rent + lease.charges,
      }));
    });

  const insurances = leases
    .filter((lease) => lease.status !== 'a_venir')
    .map((lease, index) => {
      const lotId = lease.lotId;
      if (lease.tenantId === 'koffi-adjovi') return { lotId, tenantName: lease.tenantName, insurer: 'Assurances Rivière', validUntil: '2027-03-31', status: 'valide' as const };
      if (lease.tenantId === 'yann-le-gall') return { lotId, tenantName: lease.tenantName, insurer: '', validUntil: null, status: 'manquante' as const };
      if (lease.tenantId === 'moussa-diallo') return { lotId, tenantName: lease.tenantName, insurer: 'MAIF', validUntil: '2026-10-31', status: 'expire' as const };
      return { lotId, tenantName: lease.tenantName, insurer: INSURERS[index % INSURERS.length] ?? 'MAIF', validUntil: '2027-06-30', status: 'valide' as const };
    });

  const a1Diagnostics = (aptA1Extras.diagnostics?.items ?? []).map((item) => ({
    lotId: 'apt-a1',
    label: item.label,
    doneOn: item.doneOn,
    expiresOn: item.expiresOn,
    status: item.status,
  }));

  const assets = demoUnits.map((unit) => {
    if (unit.id === 'apt-a1') {
      const finance = aptA1Extras.finances;
      return {
        lotId: unit.id,
        purchasePrice: finance?.purchasePrice ?? null,
        purchaseYear: finance?.purchaseYear ?? null,
        fees: finance?.fees ?? null,
        estimatedValue: finance?.estimatedValue ?? null,
        estimatedYear: finance?.estimatedYear ?? null,
      };
    }
    const price = PRICES[unit.id];
    return {
      lotId: unit.id,
      purchasePrice: price ? euros(price[0]) : null,
      purchaseYear: price ? price[1] : null,
      fees: price ? Math.round(euros(price[0]) * 0.075) : null,
      estimatedValue: price ? euros(price[2]) : null,
      estimatedYear: price ? price[3] : null,
    };
  });

  return {
    generatedAt: DEMO_NOW,
    today: DEMO_TODAY,
    lots: demoUnits.map((unit) => ({ id: unit.id, name: unitName.get(unit.id) ?? unit.label, buildingId: slugify(unit.building), buildingName: unit.building })),
    leases,
    payments,
    expenses: finances.depenses
      .filter((expense) => !expense.annulee)
      .map((expense) => ({
        id: expense.id,
        date: expense.date,
        ...splitProperty(expense.bien),
        kind: EXPENSE_KINDS[expense.type] ?? expense.type,
        supplier: expense.fournisseur,
        description: expense.description,
        amount: expense.montantTtc,
      })),
    yearBalances: finances.bilans.map((bilan) => ({
      year: bilan.annee,
      depreciation: bilan.amortissementsLmnp,
      lines: bilan.lignes.map((line) => ({ id: line.id, label: line.categorie, detail: line.detail, kind: line.sens, amount: line.montant, missingProofs: line.manquants })),
    })),
    invoices: finances.factures.map((invoice) => ({
      id: invoice.id,
      number: invoice.numero,
      date: invoice.date,
      kind: invoice.type,
      recipient: invoice.destinataire,
      amountHt: invoice.montantHt,
      amountTtc: invoice.montantTtc,
      vatPct: invoice.tvaPct,
    })),
    occupants: demoTenants
      .filter((tenant) => tenant.unitId !== null && tenant.status === 'actif')
      .map((tenant) => ({ tenantId: tenant.id, name: `${tenant.firstName} ${tenant.lastName}`, lotId: tenant.unitId ?? '', since: tenant.since, email: tenant.email, state: tenant.state })),
    assets,
    loans: finances.prets
      .filter((loan) => !loan.supprime && loan.statut !== 'archive')
      .map((loan) => ({
        id: loan.id,
        buildingName: loan.bien,
        bank: loan.banque,
        borrowed: loan.emprunte,
        rateBp: loan.tauxBp,
        endMonth: loan.fin,
        monthly: loan.mensualite,
        remaining: loan.restantDu,
        interestYear: loan.interetsAnnee,
        status: loan.statut === 'rembourse' ? 'rembourse' : 'en_cours',
      })),
    diagnostics: [
      ...a1Diagnostics,
      { lotId: 'apt-a2', label: 'Performance énergétique (DPE)', doneOn: '2025-02-18', expiresOn: '2035-02-17', status: 'valide' },
      { lotId: 'apt-a2', label: 'Installation électrique', doneOn: '2024-05-06', expiresOn: '2030-05-05', status: 'valide' },
      { lotId: 'apt-b1', label: 'Performance énergétique (DPE)', doneOn: '2023-09-11', expiresOn: '2033-09-10', status: 'valide' },
      { lotId: 'apt-b1', label: 'Installation électrique', doneOn: '2021-01-15', expiresOn: '2027-01-14', status: 'a_refaire' },
      { lotId: 'studio-2e', label: 'Performance énergétique (DPE)', doneOn: '2022-07-04', expiresOn: '2032-07-03', status: 'valide' },
      { lotId: 'villa-rdc', label: 'Installation gaz', doneOn: '2020-06-30', expiresOn: '2026-06-29', status: 'expire' },
      { lotId: 'villa-rdc', label: 'Performance énergétique (DPE)', doneOn: '2024-10-02', expiresOn: '2034-10-01', status: 'valide' },
    ],
    depositReturns: demoAttestations.map((attestation) => ({
      lotId: attestation.unitId,
      number: attestation.number,
      tenantName: attestation.tenantName,
      deposit: attestation.deposit,
      returned: attestation.returned,
      retained: attestation.deductions.reduce((total, item) => total + item.amount, 0),
      receivedOn: attestation.depositReceivedOn,
      issuedOn: attestation.issuedOn,
    })),
    insurances,
  };
}
