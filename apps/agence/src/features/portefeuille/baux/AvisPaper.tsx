import { formatDay } from "@/lib/dates";
import { formatEurosExact } from "@/lib/money";
import { PAYMENT_MODE_LABELS } from "../labels";
import { monthLabel } from "../avis";
import type { AvisLine } from "../avis";

export const AVIS_PAPER_CSS = "@page { size: A4; margin: 12mm; } .avis-paper { background-color: white; color: black; } .avis-paper * { border-color: silver; }";

export function AvisPaper({ line, agencyName, todayIso }: { line: AvisLine; agencyName: string; todayIso: string }) {
  const { bail, bien, tenant, mandant, mandat, dueIso, avis } = line;
  const month = avis?.month ?? dueIso.slice(0, 7);
  const reference = `AE-${month}-${bail.number}`;
  return (
    <article
      data-print-area
      aria-label={`Avis d'échéance ${monthLabel(month)}, ${tenant.name}`}
      className="mx-auto flex min-h-[640px] w-full max-w-[794px] flex-col gap-6 avis-paper border p-6 shadow-sm sm:p-12"
    >
      <style>{AVIS_PAPER_CSS}</style>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <strong className="text-block-title">{agencyName}</strong>
          <span className="text-caption">Gestion locative sous mandat</span>
        </div>
        <div className="flex flex-col items-end gap-0.5 text-right">
          <h2 className="text-block-title uppercase tracking-wide">Avis d&apos;échéance</h2>
          <span className="text-body">{monthLabel(month)}</span>
          <span className="text-caption">{`Référence ${reference}`}</span>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-label="Parties">
        <div className="flex flex-col gap-0.5 rounded-sm border p-3">
          <span className="text-caption">Locataire</span>
          <strong>{tenant.name}</strong>
          <span>{bien.name}</span>
          <span>{bien.street}</span>
          <span>{`${bien.postalCode} ${bien.city}`}</span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-sm border p-3">
          <span className="text-caption">Pour le compte du bailleur</span>
          <strong>{mandant.name}</strong>
          <span>{mandant.legal === "Particulier" ? "Propriétaire" : mandant.legal}</span>
          <span>{`Mandat ${mandat.number}`}</span>
          <span>{`Bail ${bail.number}`}</span>
        </div>
      </section>

      <p>
        {`Nous vous informons que le terme du ${formatDay(dueIso)} est à régler pour le logement désigné ci-dessus.`}
      </p>

      <table className="w-full border-collapse text-body">
        <caption className="sr-only">Détail du montant à payer</caption>
        <thead>
          <tr>
            <th scope="col" className="border-b py-1.5 text-left font-semibold">
              Désignation
            </th>
            <th scope="col" className="border-b py-1.5 text-right font-semibold">
              Montant
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border-b py-1.5">Loyer hors charges</td>
            <td className="border-b py-1.5 text-right tabular-nums">{formatEurosExact(bail.rentMinor)}</td>
          </tr>
          <tr>
            <td className="border-b py-1.5">Provisions sur charges</td>
            <td className="border-b py-1.5 text-right tabular-nums">{formatEurosExact(bail.chargesMinor)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="py-2 text-left font-semibold">
              Total à payer
            </th>
            <td className="py-2 text-right font-semibold tabular-nums">{formatEurosExact(bail.rentMinor + bail.chargesMinor)}</td>
          </tr>
        </tfoot>
      </table>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        <div>
          <dt className="text-caption">Date d&apos;échéance</dt>
          <dd className="font-medium">{formatDay(dueIso)}</dd>
        </div>
        <div>
          <dt className="text-caption">Mode de paiement</dt>
          <dd className="font-medium">{PAYMENT_MODE_LABELS[bail.paymentMode]}</dd>
        </div>
      </dl>

      <p className="mt-auto border-t pt-3 text-caption">
        {`Cet avis d'échéance n'est pas une quittance : la quittance est émise après réception du paiement. Fait le ${formatDay(avis?.sentIso ?? todayIso)}, ${agencyName}.`}
      </p>
    </article>
  );
}
