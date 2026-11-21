"use client";

import { ConfirmDialog, useToast } from "@eguardimmo/ui";
import { Archive, ArchiveRestore, CirclePause, CirclePlay, FileCheck } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { EditDialog } from "@/components/ui/EditDialog";
import { RowMenu } from "@/components/ui/RowMenu";
import type { RowMenuItem } from "@/components/ui/RowMenu";
import { isoDayOrNull } from "@/lib/dates";
import { useMandatAction, useMandatOperations } from "../queries";
import type { Mandat } from "../schemas";
import type { MandatState } from "../selectors";

type Lifecycle = "activate" | "suspend" | "resume" | "archive" | "restore";

const CONFIRMATIONS: Record<Exclude<Lifecycle, "activate">, { title: string; description: string; confirm: string; done: string }> = {
  suspend: {
    title: "Suspendre le mandat",
    description: "Le mandat reste en vigueur mais l'agence cesse d'agir pour le mandant. Vous pourrez le reprendre à tout moment.",
    confirm: "Suspendre le mandat",
    done: "suspendu",
  },
  resume: { title: "Reprendre le mandat", description: "Le mandat redevient actif aux mêmes conditions.", confirm: "Reprendre le mandat", done: "repris" },
  archive: { title: "Archiver le mandat", description: "Le mandat quitte la liste courante. Vous pourrez le restaurer depuis l'onglet Archivés.", confirm: "Archiver le mandat", done: "archivé" },
  restore: { title: "Restaurer le mandat", description: "Le mandat revient dans la liste courante.", confirm: "Restaurer le mandat", done: "restauré" },
};

function lifecycleItems(mandat: Mandat, state: MandatState, open: (next: Lifecycle) => void): RowMenuItem[] {
  if (mandat.archived) return [{ id: "restaurer", label: "Restaurer le mandat", icon: ArchiveRestore, onSelect: () => { open("restore"); }, separatorBefore: true }];
  if (state === "brouillon") {
    return [
      { id: "activer", label: "Activer le mandat", icon: FileCheck, onSelect: () => { open("activate"); }, separatorBefore: true },
      { id: "archiver", label: "Archiver le brouillon", icon: Archive, onSelect: () => { open("archive"); } },
    ];
  }
  if (state === "actif" || state === "a_renouveler") return [{ id: "suspendre", label: "Suspendre le mandat", icon: CirclePause, onSelect: () => { open("suspend"); }, separatorBefore: true }];
  if (state === "suspendu") return [{ id: "reprendre", label: "Reprendre le mandat", icon: CirclePlay, onSelect: () => { open("resume"); }, separatorBefore: true }];
  if (state === "termine") return [{ id: "archiver", label: "Archiver le mandat", icon: Archive, onSelect: () => { open("archive"); }, separatorBefore: true }];
  return [];
}

export function MandatMenu({ mandat, state, label, items, todayIso }: { mandat: Mandat; state: MandatState; label: string; items: readonly RowMenuItem[]; todayIso: string }) {
  const operations = useMandatOperations();
  const action = useMandatAction();
  const toast = useToast();
  const [dialog, setDialog] = useState<Lifecycle>();

  const signedSchema = z.object({
    signedOn: z
      .string()
      .refine((value) => isoDayOrNull(value) !== null, "Indiquez la date de signature, par exemple 13/11/2026.")
      .refine((value) => value <= todayIso, "La date de signature ne peut pas être dans le futur."),
  });

  const run = (execute: Parameters<typeof action.mutate>[0], done: string) => {
    action.mutate(execute, {
      onSuccess: () => {
        toast.show({ title: `Mandat ${mandat.number} ${done}` });
        setDialog(undefined);
      },
      onError: (error) => {
        setDialog(undefined);
        toast.show({ tone: "danger", title: "L'action a échoué", description: error.message });
      },
    });
  };

  const confirmation = dialog && dialog !== "activate" ? CONFIRMATIONS[dialog] : undefined;
  const all = [...items, ...(operations ? lifecycleItems(mandat, state, setDialog) : [])];

  return (
    <>
      <RowMenu label={label} items={all} />
      {dialog === "activate" ? (
        <EditDialog
          open
          onOpenChange={(open) => { if (!open) setDialog(undefined); }}
          title={`Activer le mandat ${mandat.number}`}
          description="Un mandat activé couvre ses lots : aucun autre mandat de l'agence ne peut les couvrir sur la même période."
          fields={[{ name: "signedOn", label: "Date de signature", placeholder: "13/11/2026", value: "", type: "date" }]}
          schema={signedSchema}
          onSubmit={async (values) => {
            await action.mutateAsync((operations) => operations.activate(mandat.id, values.signedOn ?? ""));
            toast.show({ title: `Mandat ${mandat.number} activé` });
          }}
        />
      ) : null}
      {confirmation && dialog && dialog !== "activate" ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => { if (!open) setDialog(undefined); }}
          title={`${confirmation.title} ${mandat.number}`}
          description={confirmation.description}
          confirmLabel={confirmation.confirm}
          loading={action.isPending}
          onConfirm={() => {
            run((operations) => operations[dialog === "suspend" ? "suspend" : dialog === "resume" ? "resume" : dialog === "archive" ? "archive" : "restore"](mandat.id), confirmation.done);
          }}
        />
      ) : null}
    </>
  );
}
