import { formatDate, plural } from '@/lib/dates';
import { formatApiMoney } from '@/tenant/format';
import { BALANCE_LABEL, CHARGE_STATUS_VIEW, balanceDirection, exerciseLabel } from '@/tenant/chargeLabels';
import type { ChargeStatement } from '@/tenant/chargeModel';
import type { Money } from '@/tenant/model';
import type { ChargesView } from './chargesView';

const absolute = ({ amount, currency }: Money): Money => ({ amount: Math.abs(amount), currency });

export function apiChargesView(statement: ChargeStatement): ChargesView {
  const exercise = exerciseLabel(statement.periodStart, statement.periodEnd);
  const direction = balanceDirection(statement.balance);
  const balance = formatApiMoney(absolute(statement.balance));
  const share = formatApiMoney(statement.shareTotal);
  const issued = statement.issuedAt === null ? '' : ` · émis le ${formatDate(statement.issuedAt)}`;
  return {
    title: exercise === null ? 'Régularisation des charges' : `Régularisation des charges ${exercise}`,
    crumbs: [
      { label: 'Mes loyers', href: '/loyers' },
      { label: 'Régularisation des charges', href: '/loyers/regularisation' },
      { label: statement.number },
    ],
    badge: CHARGE_STATUS_VIEW[statement.status],
    subtitle: `Décompte ${statement.number}${issued}`,
    stats: [
      { label: 'Votre part des charges', value: share, note: `${plural(statement.occupiedDays, 'jour', 'jours')} d’occupation` },
      { label: 'Provisions appelées', value: formatApiMoney(statement.provisionsCalled), note: exercise === null ? 'Sur la période du décompte' : `Exercice ${exercise}` },
      { label: BALANCE_LABEL[direction], value: balance, note: 'Votre part moins les provisions appelées' },
      { label: 'Provision mensuelle suggérée', value: `${formatApiMoney(statement.suggestedMonthlyProvision)} par mois`, note: 'Simple suggestion pour les mois à venir' },
    ],
    tableTitle: 'Détail des charges',
    amountHeader: 'Votre part',
    lines: (statement.lines ?? []).map((line, index) => ({
      id: String(index),
      label: line.label,
      split: line.splitLabel,
      base: formatApiMoney(line.itemAmount),
      days: line.days,
      amount: formatApiMoney(line.share),
    })),
    totalLabel: 'Total de votre part',
    total: share,
    calculation: [
      { label: 'Votre part des charges', value: share },
      { label: 'Provisions appelées', value: `− ${formatApiMoney(statement.provisionsCalled)}` },
      { label: BALANCE_LABEL[direction], value: balance, strong: true },
    ],
    extra: null,
  };
}
