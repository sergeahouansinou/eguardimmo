"use client";

import { ConfirmDialog, useToast } from "@eguardimmo/ui";
import { addMonths, formatDay } from "@/lib/dates";
import { useRenewMandat } from "../queries";
import type { Mandat } from "../schemas";

const RENEWAL_YEARS = 3;

export function RenewMandatDialog({ mandat, onOpenChange }: { mandat: Mandat | undefined; onOpenChange: (open: boolean) => void }) {
  const renew = useRenewMandat();
  const toast = useToast();
  if (!mandat) return null;
  const nextEnd = formatDay(addMonths(mandat.endIso, RENEWAL_YEARS * 12));
  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title={`Renouveler le mandat ${mandat.number}`}
      description={`Le mandat est reconduit pour ${String(RENEWAL_YEARS)} ans aux mêmes conditions. Nouvelle échéance : ${nextEnd}.`}
      confirmLabel="Renouveler le mandat"
      loading={renew.isPending}
      onConfirm={() => {
        renew.mutate(mandat.id, {
          onSuccess: (updated) => {
            toast.show({ title: `Mandat ${updated.number} renouvelé`, description: `Nouvelle échéance : ${formatDay(updated.endIso)}.` });
            onOpenChange(false);
          },
          onError: (error) => {
            toast.show({ tone: "danger", title: "Le renouvellement a échoué", description: error.message });
          },
        });
      }}
    />
  );
}
