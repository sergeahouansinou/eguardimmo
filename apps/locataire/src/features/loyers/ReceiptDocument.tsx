import { Icon, cx } from '@eguardimmo/ui';
import type { ComponentProps } from 'react';
import { QrCode, ShieldCheck } from 'lucide-react';
import type { Receipt } from '@/data/schemas/loyers';
import { formatDate, monthName, monthOf, yearOf } from '@/lib/dates';
import { formatAmount, formatMoney } from '@/lib/money';

const periodText = (receipt: Receipt) =>
  `${receipt.periodStart.slice(8, 10)} – ${receipt.periodEnd.slice(8, 10)} ${monthName(receipt.periodStart)} ${String(yearOf(receipt.periodStart))}`;

const Cell = ({ numeric, className, ...props }: ComponentProps<'td'> & { numeric?: boolean }) => (
  <td {...props} className={cx('border-b border-line px-2 py-1.5', numeric && 'text-right tabular-nums', className)} />
);

export function ReceiptDocument({ receipt }: { receipt: Receipt }) {
  const called = receipt.rentCents + receipt.provisionsCents;
  const rows = [
    { label: 'Loyer hors charges', cents: receipt.rentCents },
    { label: 'Provision sur charges', cents: receipt.provisionsCents },
  ];
  const info = [
    ['Bailleur', receipt.landlord.name],
    ['Locataire', receipt.tenantName],
    ['Adresse', receipt.address],
    ['Bien', receipt.propertyLabel],
    ['N° de bail', receipt.leaseNumber],
    ['Durée du bail', `${formatDate(receipt.leaseStart)} → ${formatDate(receipt.leaseEnd)}`],
    ['Règlement', receipt.paymentLabel],
    ["Avis d'échéance", receipt.noticeNumber],
  ] as const;
  const shortPeriod = `${receipt.periodStart.slice(8, 10)}/${receipt.periodStart.slice(5, 7)} – ${receipt.periodEnd.slice(8, 10)}/${receipt.periodEnd.slice(5, 7)}`;

  return (
    <article
      aria-label={`Quittance ${receipt.number}`}
      className="print-area flex w-[794px] min-h-[1123px] flex-col bg-surface text-[12px] leading-[18px] text-fg"
    >
      <div aria-hidden="true" className="flex h-2">
        <i className="flex-[60] bg-nav" />
        <i className="flex-[25] bg-accent" />
        <i className="flex-[15] bg-action" />
      </div>
      <div className="flex flex-col gap-5 px-12 py-8">
        <header className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="inline-flex size-12 items-center justify-center rounded-lg bg-nav text-[16px] font-semibold text-nav-fg">
              GT
            </span>
            <div className="flex flex-col">
              <b className="text-[16px] leading-6 text-fg">{receipt.landlord.name}</b>
              <span className="text-fg-muted">{receipt.landlord.address}</span>
              <span className="mt-1 font-semibold tracking-wide text-action-on-subtle">QUITTANCE DE LOYER</span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-end gap-0.5">
              <b className="text-[14px] text-fg">N° {receipt.number}</b>
              <span className="text-fg-muted">Émise le {formatDate(receipt.issuedOn)}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-success px-2 py-0.5 text-success-fg">
                <Icon icon={ShieldCheck} size={14} />
                Scellé · SHA-256
              </span>
            </div>
            <span aria-hidden="true" className="inline-flex size-16 items-center justify-center rounded-md border border-line text-fg-muted">
              <Icon icon={QrCode} size={32} />
            </span>
          </div>
        </header>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-md border border-line p-3">
          {info.map(([label, value]) => (
            <div key={label} className="flex flex-col">
              <dt className="text-[11px] text-fg-subtle">{label}</dt>
              <dd className="font-semibold text-fg">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap justify-between gap-2 rounded-md bg-muted px-3 py-2 font-medium">
          <span>Période : {periodText(receipt)}</span>
          <span>Soldée le : {formatDate(receipt.paidOn)}</span>
          <span>Reste dû : 0,00 €</span>
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-[11px] text-fg-subtle">
              <th scope="col" className="px-2 py-1 font-medium">Libellé</th>
              <th scope="col" className="px-2 py-1 font-medium">Date</th>
              <th scope="col" className="px-2 py-1 text-right font-medium">Appelé</th>
              <th scope="col" className="px-2 py-1 text-right font-medium">Reçu</th>
              <th scope="col" className="px-2 py-1 text-right font-medium">Reste dû</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-page font-semibold">
              <td colSpan={5} className="px-2 py-1.5">1 · Échéance {monthOf(receipt.installmentId)} {String(yearOf(receipt.periodStart))}</td>
            </tr>
            {rows.map((row) => (
              <tr key={row.label}>
                <Cell>{row.label}</Cell>
                <Cell className="text-fg-subtle">{shortPeriod}</Cell>
                <Cell numeric>{formatAmount(row.cents)}</Cell>
                <Cell numeric>{formatAmount(row.cents)}</Cell>
                <Cell numeric>0,00</Cell>
              </tr>
            ))}
            <tr className="font-semibold">
              <Cell colSpan={2}>Sous-total de l'échéance</Cell>
              <Cell numeric>{formatAmount(called)}</Cell>
              <Cell numeric>{formatAmount(called)}</Cell>
              <Cell numeric>0,00</Cell>
            </tr>
            <tr className="bg-page font-semibold">
              <td colSpan={5} className="px-2 py-1.5">
                2 · Dettes antérieures
                <span className="ml-2 rounded-full bg-success px-2 py-0.5 text-[11px] font-medium text-success-fg">Aucune</span>
              </td>
            </tr>
            <tr className="text-fg-muted">
              <Cell>Reports des échéances précédentes</Cell>
              <Cell className="text-fg-subtle">au {formatDate(receipt.periodStart)}</Cell>
              <Cell numeric>{formatAmount(receipt.previousDebtCents)}</Cell>
              <Cell numeric>{formatAmount(receipt.previousDebtCents)}</Cell>
              <Cell numeric>0,00</Cell>
            </tr>
            <tr className="bg-page font-semibold">
              <td colSpan={5} className="px-2 py-1.5">3 · Règlements reçus</td>
            </tr>
            <tr>
              <Cell>Règlement intégral, {receipt.paymentLabel.toLowerCase()}</Cell>
              <Cell className="text-fg-subtle">{formatDate(receipt.paidOn)}</Cell>
              <Cell numeric>—</Cell>
              <Cell numeric>{formatAmount(receipt.totalReceivedCents)}</Cell>
              <Cell numeric>—</Cell>
            </tr>
            <tr className="font-semibold">
              <td colSpan={4} className="bg-action-subtle px-2 py-2 text-action-on-subtle">Total reçu, échéance soldée</td>
              <td className="bg-action-subtle px-2 py-2 text-right tabular-nums text-action-on-subtle">{formatMoney(receipt.totalReceivedCents, { fixed: true })}</td>
            </tr>
          </tbody>
        </table>

        <p className="rounded-md border border-line p-3">
          <b>Déclaration :</b> je soussigné, {receipt.landlord.name}, bailleur du logement désigné ci-dessus, déclare avoir reçu de M. {receipt.tenantName} la somme de{' '}
          <b>{formatMoney(receipt.totalReceivedCents, { fixed: true })}</b> au titre de l'échéance {monthOf(receipt.installmentId)} {String(yearOf(receipt.periodStart))}, dettes antérieures comprises, et lui en donne quittance, sous réserve de tous mes droits.{' '}
          <b>Cette quittance n'est émise que parce que l'échéance est intégralement soldée.</b>
        </p>

        <section aria-label="Cumuls de l'année">
          <h2 className="mb-1 text-[11px] font-semibold tracking-wide text-fg-subtle uppercase">Cumuls (année {String(yearOf(receipt.periodStart))})</h2>
          <dl className="grid grid-cols-4 gap-3">
            {[
              ['Appelé', formatAmount(receipt.cumul.calledCents)],
              ['Reçu', formatAmount(receipt.cumul.receivedCents)],
              ['Solde du compte', formatAmount(receipt.cumul.balanceCents)],
              ['Dépôt de garantie', formatAmount(receipt.cumul.depositCents)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-line px-3 py-2">
                <dt className="text-[11px] text-fg-subtle">{label}</dt>
                <dd className="text-[14px] font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="flex items-end justify-between gap-6 pt-2">
          <span>Fait à Paris, le {formatDate(receipt.issuedOn)}</span>
          <div className="flex w-56 flex-col gap-1">
            <i aria-hidden="true" className="h-10 border-b border-line-strong" />
            <span className="text-fg-muted">{receipt.landlord.name}</span>
          </div>
        </div>

        <p className="mt-auto text-[10px] leading-4 text-fg-subtle">
          <b>Mentions légales.</b> Les acomptes et paiements partiels donnent lieu à un reçu et non à une quittance ; la quittance couvre l'échéance entière. Document émis et scellé par eGuardImmo ; toute modification invalide son empreinte. Authenticité vérifiable avec le QR code ou le numéro du document. À conserver sans limitation de durée.
        </p>
      </div>
    </article>
  );
}
