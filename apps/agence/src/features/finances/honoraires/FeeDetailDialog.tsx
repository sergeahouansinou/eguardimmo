"use client";

import { Button, Dialog, DialogClose, DialogContent } from "@eguardimmo/ui";
import { DetailList, DialogBody, DialogFooter, LinkButton } from "@/features/kit";
import { formatMoneyExact } from "@/features/shared/money";
import { rateTtc } from "../format";
import type { Honoraires } from "../schemas";

type FeeRow = Honoraires["rows"][number];

export function FeeDetailDialog({ row, periodLabel, showReversement, onClose }: { row: FeeRow | null; periodLabel: string; showReversement: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {row ? (
        <DialogContent title={`Honoraires, ${row.name}`} description={`${row.kind} · Mandat ${row.mateRef} · ${periodLabel}`}>
          <DialogBody>
            <DetailList
              items={[
                { label: "Taux", value: rateTtc(row.rateBp) },
                { label: "Loyers encaissés", value: formatMoneyExact(row.collectedMinor) },
                { label: "Honoraires HT", value: formatMoneyExact(row.htMinor) },
                { label: "TVA 20 %", value: formatMoneyExact(row.vatMinor) },
                { label: "Honoraires TTC", value: formatMoneyExact(row.feeMinor) },
                { label: "À prélever après encaissement", value: formatMoneyExact(row.pendingMinor) },
                { label: "État", value: row.retention },
              ]}
            />
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Fermer</Button>
            </DialogClose>
            {showReversement ? (
              <LinkButton href={`/finances/reversements/${row.mandantId}`} variant="primary">
                Voir le reversement
              </LinkButton>
            ) : null}
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
