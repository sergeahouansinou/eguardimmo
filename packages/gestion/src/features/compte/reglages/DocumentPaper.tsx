import { PrintArea } from '../shared/PrintArea';
import { formatMoney } from '../../../format/money';
import { renderNumber } from './numbering';
import type { DocumentsSettings } from './schemas';

export type DocumentKind = 'quittance' | 'avis';

const SAMPLE_LINES = {
  rent: 75_000,
  charges: [
    { label: 'Eau', amount: 3_000 },
    { label: 'Entretien des parties communes', amount: 4_000 },
    { label: 'Ordures ménagères', amount: 3_000 },
  ],
} as const;

const total = SAMPLE_LINES.rent + SAMPLE_LINES.charges.reduce((sum, line) => sum + line.amount, 0);

export function DocumentPaper({ kind, settings }: { kind: DocumentKind; settings: DocumentsSettings }) {
  const title = kind === 'quittance' ? 'Quittance de loyer' : "Avis d'échéance";
  const number = kind === 'quittance' ? renderNumber(settings.quittanceFormat, settings.quittanceNext) : renderNumber(settings.avisFormat, settings.avisNext);
  const money = (minor: number) => formatMoney(minor, 'EUR');
  return (
    <PrintArea label={`Aperçu : ${title}`}>
      <div className="flex flex-col gap-4 text-[13px] leading-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <b className="block text-[15px]">{title}</b>
            <span>N° {number}</span>
          </div>
          <div className="text-right">
            <b className="block">Awa Diallo</b>
            <span>12 rue des Lilas, 75011 Paris</span>
            <span className="block">Logo : {settings.logoName}</span>
          </div>
        </div>
        <div>
          <span className="block">Locataire : Koffi Adjovi, Apt A1, Les Tilleuls</span>
          <span className="block">Période : novembre 2026</span>
        </div>
        <table className="w-full border-collapse">
          <caption className="sr-only">Détail du montant</caption>
          <tbody>
            <tr>
              <th scope="row" className="border-b border-line py-1 text-left font-normal">Loyer hors charges</th>
              <td className="border-b border-line py-1 text-right tabular-nums">{money(SAMPLE_LINES.rent)}</td>
            </tr>
            {settings.chargesDetail ? (
              SAMPLE_LINES.charges.map((line) => (
                <tr key={line.label}>
                  <th scope="row" className="border-b border-line py-1 text-left font-normal">{line.label}</th>
                  <td className="border-b border-line py-1 text-right tabular-nums">{money(line.amount)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <th scope="row" className="border-b border-line py-1 text-left font-normal">Charges</th>
                <td className="border-b border-line py-1 text-right tabular-nums">
                  {money(SAMPLE_LINES.charges.reduce((sum, line) => sum + line.amount, 0))}
                </td>
              </tr>
            )}
            <tr>
              <th scope="row" className="py-1 text-left font-semibold">Total</th>
              <td className="py-1 text-right font-semibold tabular-nums">{money(total)}</td>
            </tr>
          </tbody>
        </table>
        {settings.tenantBalance ? <span>Solde antérieur du locataire : {money(0)}</span> : null}
        <div className="mt-6 flex items-end justify-between gap-4">
          {settings.qrCode ? (
            <span role="img" aria-label="Code QR de vérification" className="size-14 border-2 border-black bg-[repeating-linear-gradient(90deg,black_0_3px,white_3px_6px)]" />
          ) : (
            <span />
          )}
          <span className="text-right">Signature : {settings.signatureName}</span>
        </div>
        <span className="border-t border-line pt-2 text-[11px]">{settings.footer === '' ? 'Pied de page par défaut' : settings.footer}</span>
      </div>
    </PrintArea>
  );
}
