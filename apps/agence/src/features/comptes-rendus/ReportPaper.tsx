import { cx } from "@eguardimmo/ui";
import type { ReactNode } from "react";
import { AGENCY } from "@/features/shared/directory";
import { DEMO_NOW, formatDate } from "@/features/shared/dates";
import { formatMoneyExact } from "@/features/shared/money";
import { annexesOf, pageCount } from "./pages";
import type { Work } from "./pages";
import type { ReportDetail } from "./schemas";

const NUMBER_WORDS: Record<number, string> = { 0: "aucune", 1: "une", 2: "deux", 3: "trois" };

function reminderText(count: number): string {
  const word = NUMBER_WORDS[count] ?? String(count);
  return `${word} relance${count > 1 ? "s" : ""} envoyée${count > 1 ? "s" : ""}`;
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-1 flex-col gap-0.5 rounded-sm border border-line p-3">
      <span className="text-caption text-fg-subtle">{label}</span>
      <b className="text-block-title">{value}</b>
    </div>
  );
}

function Sheet({ number, total, current, children }: { number: number; total: number; current: boolean; children: ReactNode }) {
  return (
    <section
      aria-label={`Page ${String(number)} sur ${String(total)}`}
      data-page={number}
      data-current={current}
      className={cx("min-h-[1123px] w-[794px] flex-col gap-4 border border-line bg-surface p-12 text-body text-fg shadow-sm", current ? "flex" : "hidden print:flex")}
    >
      {children}
      <div className="mt-auto flex justify-between border-t border-line pt-2 text-caption text-fg-subtle">
        <span>{`${AGENCY.name}, document généré le ${formatDate(DEMO_NOW)} à ${DEMO_NOW.slice(11, 16)}`}</span>
        <span>{`Page ${String(number)} sur ${String(total)}`}</span>
      </div>
    </section>
  );
}

function Table({ head, rows, foot, numericFrom }: { head: readonly string[]; rows: readonly (readonly string[])[]; foot?: readonly string[]; numericFrom: number }) {
  const cell = (index: number) => cx("border-b border-line px-2 py-1.5 text-left", index >= numericFrom && "text-right tabular-nums");
  return (
    <table className="w-full border-collapse text-caption">
      <thead>
        <tr>
          {head.map((label, index) => (
            <th key={label} scope="col" className={cx(cell(index), "font-semibold text-fg-subtle")}>
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.join("|")}>
            {row.map((value, index) => (
              <td key={`${head[index] ?? ""}-${value}`} className={cell(index)}>
                {value}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {foot ? (
        <tfoot>
          <tr>
            {foot.map((value, index) => (
              <td key={`${head[index] ?? ""}-foot`} className={cx(cell(index), "font-semibold")}>
                {value}
              </td>
            ))}
          </tr>
        </tfoot>
      ) : null}
    </table>
  );
}

export interface ReportPaperProps {
  detail: ReportDetail;
  works: readonly Work[];
  worksError: boolean;
  page: number;
  zoom: number;
}

export function ReportPaper({ detail, works, worksError, page, zoom }: ReportPaperProps) {
  const { statement, content, options } = detail;
  const total = pageCount(detail, works);
  const annexes = annexesOf(detail, works);
  const has = (key: (typeof content)[number]) => content.includes(key);
  const unpaid = statement.lines.filter((line) => line.unpaidSince !== null && line.collectedMinor < line.calledMinor);
  const head = ["Lot", "Locataire", "Appelé", "Encaissé", ...(has("honoraires") ? ["Honoraires"] : []), ...(has("reversement") ? ["Net"] : [])];
  const rowOf = (values: { lot: string; tenant: string; called: number; collected: number; fee: number; net: number }) => [
    values.lot,
    values.tenant,
    formatMoneyExact(values.called),
    formatMoneyExact(values.collected),
    ...(has("honoraires") ? [formatMoneyExact(values.fee)] : []),
    ...(has("reversement") ? [formatMoneyExact(values.net)] : []),
  ];

  return (
    <article data-print-area aria-label="Compte rendu de gestion" style={{ zoom: zoom / 100 }} className="flex w-max flex-col gap-4">
      <Sheet number={1} total={total} current={page === 1}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          {options.letterhead ? (
            <div className="flex flex-col gap-0.5">
              <span className="flex items-center gap-2 text-block-title">
                <span aria-hidden="true" className="inline-flex size-7 items-center justify-center rounded-sm bg-action text-caption font-semibold text-on-action">
                  CD
                </span>
                {AGENCY.name}
              </span>
              <span className="text-caption text-fg-subtle">{AGENCY.tagline}</span>
              <span className="text-caption text-fg-subtle">{AGENCY.email}</span>
            </div>
          ) : (
            <span />
          )}
          <div className="flex flex-col items-end gap-0.5">
            <b className="text-block-title">COMPTE RENDU DE GESTION</b>
            <span className="text-caption text-fg-subtle">{detail.periodLabel}</span>
            <span className="text-caption text-fg-subtle">{`Mandat ${statement.mandateRef}`}</span>
          </div>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-caption text-fg-subtle">Mandant</span>
          <b>{`${statement.mandantName}, ${statement.mandantKind}`}</b>
          <span className="text-caption text-fg-subtle">{`${String(statement.lines.length)} lot${statement.lines.length > 1 ? "s" : ""} · Paris`}</span>
        </div>
        {has("loyers") || has("honoraires") || has("reversement") ? (
          <div className="flex flex-wrap gap-3">
            {has("loyers") ? <Box label="Loyers encaissés" value={formatMoneyExact(statement.collectedMinor)} /> : null}
            {has("honoraires") ? <Box label="Honoraires TTC" value={formatMoneyExact(statement.feeMinor)} /> : null}
            {has("reversement") ? <Box label="Net à reverser" value={formatMoneyExact(statement.netMinor)} /> : null}
          </div>
        ) : null}
        <Table
          head={head}
          numericFrom={2}
          rows={statement.lines.map((line) =>
            rowOf({ lot: line.lotLabel, tenant: line.tenantName, called: line.calledMinor, collected: line.collectedMinor, fee: line.feeMinor, net: line.netMinor }),
          )}
          foot={[
            "Total",
            "",
            formatMoneyExact(statement.calledMinor),
            formatMoneyExact(statement.collectedMinor),
            ...(has("honoraires") ? [formatMoneyExact(statement.feeMinor)] : []),
            ...(has("reversement") ? [formatMoneyExact(statement.netMinor)] : []),
          ]}
        />
        {has("impayes")
          ? unpaid.map((line) => (
              <p key={line.lotId} className="text-caption text-fg-muted">
                {`${line.lotLabel} : loyer de ${formatMoneyExact(line.calledMinor - line.collectedMinor)} impayé depuis le ${formatDate(line.unpaidSince ?? "")}, ${reminderText(line.reminders)}. Il sera reversé après encaissement.`}
              </p>
            ))
          : null}
        {has("reversement") ? (
          <p className="text-caption text-fg-muted">{`Virement de ${formatMoneyExact(statement.netMinor)} prévu le ${formatDate(statement.transferDate)} sur le compte •••• ${statement.ibanLast4}.`}</p>
        ) : null}
      </Sheet>
      {total === 2 ? (
        <Sheet number={2} total={total} current={page === 2}>
          <b className="text-block-title">{`Annexes, ${statement.mandantName}, ${detail.periodLabel.toLowerCase()}`}</b>
          {annexes.receipts ? (
            <div className="flex flex-col gap-1.5">
              <b>Quittances jointes</b>
              <Table
                head={["Référence", "Lot", "Locataire", "Payé le", "Montant"]}
                numericFrom={4}
                rows={detail.receipts.map((receipt) => [receipt.reference, receipt.lotLabel, receipt.tenantName, formatDate(receipt.paidOn), formatMoneyExact(receipt.amountMinor)])}
              />
            </div>
          ) : null}
          {annexes.reminders ? (
            <div className="flex flex-col gap-1.5">
              <b>Détail des relances</b>
              <Table
                head={["Lot", "Locataire", "Relance", "Envoyée le"]}
                numericFrom={4}
                rows={detail.reminders.map((reminder) => [reminder.lotLabel, reminder.tenantName, `n° ${String(reminder.rank)}`, formatDate(reminder.sentOn)])}
              />
            </div>
          ) : null}
          {annexes.works ? (
            <div className="flex flex-col gap-1.5">
              <b>Travaux et interventions</b>
              <ul className="flex flex-col gap-0.5 text-caption">
                {works.map((work) => (
                  <li key={work.id}>{`${work.subject}, ${work.propertyLabel} : ${work.statusLabel.toLowerCase()}`}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {worksError && detail.content.includes("travaux") ? <p className="text-caption text-fg-danger">Les interventions n'ont pas pu être chargées.</p> : null}
        </Sheet>
      ) : null}
    </article>
  );
}
