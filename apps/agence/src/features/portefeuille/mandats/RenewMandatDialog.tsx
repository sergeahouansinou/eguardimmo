"use client";

import { ConfirmDialog, useToast } from "@eguardimmo/ui";
import { addMonths, formatDay } from "@/lib/dates";
import { plural } from "../labels";
import { useMandatDetail, useRenewMandat } from "../queries";
import type { Mandat } from "../schemas";

const RENEWAL_YEARS = 3;

export function RenewMandatDialog({ mandat, onOpenChange }: { mandat: Mandat | undefined; onOpenChange: (open: boolean) => void }) {
  const renew = useRenewMandat();
  const toast = useToast();
  const detail = useMandatDetail(mandat?.id ?? "");
  if (!mandat) return null;
  const waiting = detail.isPending;
  const months = detail.data?.renewalMonths ?? RENEWAL_YEARS * 12;
  const nextEnd = formatDay(addMonths(mandat.endIso, months));
  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title={`Renouveler le mandat ${mandat.number}`}
      description={waiting ? "Chargement de la durée de reconduction du mandat." : `Le mandat est reconduit pour ${months % 12 === 0 ? plural(months / 12, "an", "ans") : plural(months, "mois", "mois")} aux mêmes conditions. Nouvelle échéance : ${nextEnd}.`}
      confirmLabel="Renouveler le mandat"
      loading={renew.isPending || waiting}
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
