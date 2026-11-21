import { TotalsList } from '@/components/Section';
import { formatApiMoney } from '@/tenant/format';
import type { AmountBreakdown } from '@/tenant/rentModel';

export function AmountsList({ amounts }: { amounts: AmountBreakdown }) {
  return (
    <TotalsList
      items={[
        { label: 'Loyer', value: formatApiMoney(amounts.rent) },
        { label: 'Charges', value: formatApiMoney(amounts.charges) },
        { label: 'TVA', value: formatApiMoney(amounts.vat) },
        { label: 'Total', value: formatApiMoney(amounts.total), strong: true },
      ]}
    />
  );
}
