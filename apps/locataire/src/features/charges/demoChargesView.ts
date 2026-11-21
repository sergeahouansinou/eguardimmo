import type { ChargesStatement } from '@/data/schemas/loyers';
import { formatDate } from '@/lib/dates';
import { formatAmount, formatMoney } from '@/lib/money';
import type { ChargesView } from './chargesView';

const STATUS: Record<ChargesStatement['status'], ChargesView['badge']> = {
  remboursee: { label: 'Remboursée', tone: 'success' },
  a_regler: { label: 'À régler', tone: 'warning' },
  compensee: { label: 'Compensée', tone: 'info' },
};

export function demoChargesView(data: ChargesStatement): ChargesView {
  const year = String(data.year);
  return {
    title: `Régularisation des charges ${year}`,
    crumbs: [{ label: 'Loyers et quittances', href: '/loyers' }, { label: 'Régularisation des charges' }],
    badge: STATUS[data.status],
    subtitle: `Provisions de ${formatMoney(data.monthlyProvisionCents)} par mois comparées aux charges réelles de l'immeuble.`,
    stats: [
      { label: 'Provisions versées', value: formatMoney(data.provisionsPaidCents), note: `12 mois × ${formatMoney(data.monthlyProvisionCents)}` },
      { label: 'Charges réelles', value: formatMoney(data.actualCents), note: `Exercice ${year}` },
      {
        label: 'Solde en votre faveur',
        value: formatMoney(data.balanceCents),
        note: data.settledOn ? `Remboursé le ${formatDate(data.settledOn)}` : 'À rembourser',
      },
      { label: 'Provision actuelle', value: `${formatMoney(data.currentProvisionCents)} par mois`, note: data.provisionNote },
    ],
    tableTitle: `Charges réelles de ${year}`,
    amountHeader: 'Montant',
    lines: data.lines.map((line, index) => ({
      id: String(index),
      label: line.label,
      split: line.split,
      base: null,
      days: null,
      amount: `${formatAmount(line.amountCents)} €`,
    })),
    totalLabel: `Charges réelles ${year}`,
    total: `${formatAmount(data.actualCents)} €`,
    calculation: [
      { label: 'Provisions versées', value: `${formatAmount(data.provisionsPaidCents)} €` },
      { label: 'Charges réelles', value: `− ${formatAmount(data.actualCents)} €` },
      { label: 'Solde remboursé', value: `${formatAmount(data.balanceCents)} €`, strong: true },
    ],
    extra: data.settledOn
      ? {
          title: 'Remboursement',
          items: [
            { label: 'Date', value: formatDate(data.settledOn) },
            { label: 'Moyen', value: data.settlementLabel ?? '—' },
            { label: 'Montant', value: `${formatAmount(data.balanceCents)} €` },
          ],
        }
      : null,
  };
}
