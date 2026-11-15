import { cx } from "@eguardimmo/ui";
import type { ReactNode } from "react";
import { formatDate, monthLabel } from "../data/dates";
import { lotLabel, reportTotals } from "../data/derive";
import type { ConfieData, Report } from "../data/schemas";
import { eurFixed } from "../data/money";

export const PRINT_STYLE = `@media print {
  body * { visibility: hidden; }
  [data-print-root], [data-print-root] * { visibility: visible; }
  [data-print-root] { position: absolute; inset: 0; margin: 0; padding: 0; zoom: 1 !important; }
}`;

function DocTable({ headers, rows, footer }: { headers: readonly string[]; rows: readonly (readonly ReactNode[])[]; footer?: readonly ReactNode[] }) {
  return (
    <table className="w-full border-collapse text-caption">
      <thead>
        <tr>
          {headers.map((header, index) => (
            <th key={header} scope="col" className={cx("border-b border-line-strong py-1 font-semibold", index === 0 ? "text-left" : "text-right")}>
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex} className="border-b border-line">
            {row.map((cell, index) => (
              <td key={index} className={cx("py-1", index === 0 ? "text-left" : "text-right tabular-nums")}>{cell}</td>
            ))}
          </tr>
        ))}
        {footer ? (
          <tr className="font-semibold">
            {footer.map((cell, index) => (
              <td key={index} className={cx("py-1", index === 0 ? "text-left" : "text-right tabular-nums")}>{cell}</td>
            ))}
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

function Sheet({ visible, number, total, data, report, children }: { visible: boolean; number: number; total: number; data: ConfieData; report: Report; children: ReactNode }) {
  return (
    <section
      aria-label={`Page ${String(number)} sur ${String(total)}`}
      className={cx(
        "w-[595px] max-w-none flex-col gap-4 border border-line-strong bg-surface p-8 text-caption text-fg print:flex print:break-after-page print:border-0",
        visible ? "flex" : "hidden",
      )}
    >
      <div className="flex flex-1 flex-col gap-4">{children}</div>
      <footer className="flex justify-between border-t border-line pt-2 text-fg-subtle">
        <span>Établi le {formatDate(report.availableOn)} · {data.agency.name}</span>
        <span>Page {number} sur {total}</span>
      </footer>
    </section>
  );
}

export interface ReportDocumentProps {
  data: ConfieData;
  report: Report;
  page: number;
  zoom: number;
}

export function ReportDocument({ data, report, page, zoom }: ReportDocumentProps) {
  const totals = reportTotals(report);
  const lotCount = report.lots.length;
  const address = data.lots[0]?.address ?? "";
  const initials = data.agency.name
    .split(" ")
    .map((word) => word.charAt(0))
    .join("")
    .slice(0, 2);
  const total = report.pages;
  return (
    <div data-print-root className="flex flex-col gap-4" style={{ zoom: zoom / 100 }}>
      <Sheet visible={page === 1} number={1} total={total} data={data} report={report}>
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="inline-flex size-10 items-center justify-center rounded-md bg-action text-body-strong text-on-action">{initials}</span>
          <div className="flex flex-col">
            <b className="text-body-strong">{data.agency.name}</b>
            <span className="text-fg-subtle">{data.agency.address}</span>
            <span className="text-fg-subtle">{data.agency.email}</span>
          </div>
        </div>
        <div className="flex flex-col gap-0.5">
          <h3 className="text-block-title uppercase">Compte rendu de gestion</h3>
          <span>{report.longLabel}, du {formatDate(report.startOn).slice(0, 5)} au {formatDate(report.endOn)}</span>
          <span className="text-fg-subtle">Mandat {data.mandate.reference}</span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-md border border-line p-2">
          <span className="text-fg-subtle">Mandant</span>
          <b>{data.profile.denomination}, {data.profile.representative}</b>
          <span className="text-fg-subtle">{lotCount} lots · {address}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[["Encaissé", totals.collected], ["Honoraires", totals.fees], ["Net reversé", totals.reversed]].map(([label, amount]) => (
            <div key={String(label)} className="flex flex-col rounded-md border border-line p-2">
              <span className="text-fg-subtle">{label}</span>
              <b className="text-body-strong tabular-nums">{eurFixed(Number(amount))}</b>
            </div>
          ))}
        </div>
        <DocTable
          headers={["Mois", "Encaissé", "Honoraires", "Travaux", "Reversé"]}
          rows={report.months.map((month) => [monthLabel(month.month), eurFixed(month.collected), eurFixed(month.fees), month.works === 0 ? "—" : eurFixed(month.works), eurFixed(month.collected - month.fees - month.works)])}
          footer={["Trimestre", eurFixed(totals.collected), eurFixed(totals.fees), eurFixed(totals.works), eurFixed(totals.reversed)]}
        />
        <DocTable
          headers={["Lot", "Locataire", "Encaissé", "Honoraires"]}
          rows={report.lots.map((line) => [lotLabel(data, line.lotId), data.lots.find((lot) => lot.id === line.lotId)?.tenant.name ?? "", eurFixed(line.collected), eurFixed(line.fees)])}
        />
      </Sheet>
      <Sheet visible={page === 2} number={2} total={total} data={data} report={report}>
        <DocTable
          headers={["Virement", "Référence", "Montant"]}
          rows={report.months.map((month) => [formatDate(month.reversedOn), month.reference, eurFixed(month.collected - month.fees - month.works)])}
        />
        <div className="flex flex-col gap-1">
          {report.works.map((work) => (
            <p key={work.title}>Travaux : {work.title.charAt(0).toLowerCase() + work.title.slice(1)}, {eurFixed(work.amount)} TTC, imputés sur le reversement du {formatDate(report.months.find((month) => month.works > 0)?.reversedOn ?? report.availableOn)}.</p>
          ))}
          {report.arrears.filter((item) => item.tone === "success").map((item) => (
            <p key={item.title}>{item.title}.</p>
          ))}
          <p>{report.observations}</p>
        </div>
      </Sheet>
    </div>
  );
}
