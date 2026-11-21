"use client";

import { Alert, Button, ConfirmDialog, Dialog, DialogContent, Icon, Select, TextField, useToast } from "@eguardimmo/ui";
import { CalendarX, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { EditDialog } from "@/components/ui/EditDialog";
import { RowMenu } from "@/components/ui/RowMenu";
import { isoDayOrNull } from "@/lib/dates";
import { useMandatAction, useMandatFormOptions, useMandatOperations } from "../queries";
import type { Mandat, MandatUnit } from "../schemas";
import type { MandatState } from "../selectors";
import { MandatUnitsTable } from "../shared/MandatUnitsTable";

interface Pending {
  kind: "end" | "remove";
  unit: MandatUnit;
}

const endSchema = z.object({ endIso: z.string().refine((value) => isoDayOrNull(value) !== null, "Indiquez le dernier jour du lot, par exemple 31/12/2026.") });

function AddUnitDialog({ mandat, onClose }: { mandat: Mandat; onClose: () => void }) {
  const options = useMandatFormOptions();
  const action = useMandatAction();
  const toast = useToast();
  const [unitId, setUnitId] = useState("");
  const [fromIso, setFromIso] = useState("");
  const [failure, setFailure] = useState<string>();
  const taken = new Set((mandat.units ?? []).filter((unit) => unit.endIso === null).map((unit) => unit.unitId));
  const choices = (options.data?.units ?? []).filter((unit) => !taken.has(unit.id)).map((unit) => ({ value: unit.id, label: unit.reference, description: unit.propertyName }));

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent title={`Ajouter un lot au mandat ${mandat.number}`} description="Le lot est couvert dès la date indiquée. Un autre mandat de l'agence ne doit pas déjà le couvrir.">
        <form
          noValidate
          className="flex flex-col gap-3 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (unitId === "") {
              setFailure("Choisissez le lot à ajouter.");
              return;
            }
            if (fromIso !== "" && isoDayOrNull(fromIso) === null) {
              setFailure("Indiquez une date valide, par exemple 01/12/2026.");
              return;
            }
            setFailure(undefined);
            action.mutate((operations) => operations.addUnit(mandat.id, unitId, fromIso === "" ? undefined : fromIso), {
              onSuccess: () => {
                toast.show({ title: "Lot ajouté", description: `Mandat ${mandat.number}` });
                onClose();
              },
              onError: (error) => { setFailure(error.message); },
            });
          }}
        >
          {failure ? <Alert tone="danger" title="Ajout impossible">{failure}</Alert> : null}
          <Select
            label="Lot *"
            placeholder="Choisir un lot, ex. : A12"
            options={choices}
            value={unitId}
            onValueChange={setUnitId}
            searchable
            searchPlaceholder="Rechercher un lot"
            emptyLabel={options.isPending ? "Chargement des lots" : "Aucun lot disponible"}
          />
          <TextField label="Couvert à partir du" type="date" placeholder="01/12/2026" hint="Laissez vide pour la prise d'effet du mandat." value={fromIso} onChange={(event) => { setFromIso(event.target.value); }} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Annuler</Button>
            <Button type="submit" loading={action.isPending}>Ajouter le lot</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MandatUnitsPanel({ mandat, state }: { mandat: Mandat; state: MandatState }) {
  const operations = useMandatOperations();
  const action = useMandatAction();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<Pending>();
  const editable = operations !== undefined && !mandat.archived && state !== "termine";
  const units = mandat.units ?? [];

  return (
    <div className="flex flex-col gap-3">
      {editable ? (
        <div>
          <Button variant="secondary" size="sm" onClick={() => { setAdding(true); }}>
            <Icon icon={Plus} />
            Ajouter un lot
          </Button>
        </div>
      ) : null}
      <MandatUnitsTable
        units={units}
        label="Lots du mandat"
        {...(editable
          ? {
              actions: (unit: MandatUnit) =>
                unit.endIso === null ? (
                  <RowMenu
                    label={`Actions pour le lot ${unit.reference}`}
                    items={[
                      { id: "terminer", label: "Terminer le lot", icon: CalendarX, onSelect: () => { setPending({ kind: "end", unit }); } },
                      ...(state === "brouillon" ? [{ id: "retirer", label: "Retirer du mandat", icon: Trash2, tone: "danger" as const, onSelect: () => { setPending({ kind: "remove", unit }); } }] : []),
                    ]}
                  />
                ) : null,
            }
          : {})}
      />
      {adding ? <AddUnitDialog mandat={mandat} onClose={() => { setAdding(false); }} /> : null}
      {pending?.kind === "end" ? (
        <EditDialog
          open
          onOpenChange={(open) => { if (!open) setPending(undefined); }}
          title={`Terminer le lot ${pending.unit.reference}`}
          description="Le lot n'est plus couvert par ce mandat après cette date. Le mandat doit garder au moins un lot."
          fields={[{ name: "endIso", label: "Dernier jour sous mandat", placeholder: "31/12/2026", value: "", type: "date" }]}
          schema={endSchema}
          onSubmit={async (values) => {
            await action.mutateAsync((ops) => ops.endUnit(mandat.id, pending.unit.id, values.endIso ?? ""));
            toast.show({ title: "Lot terminé", description: `Lot ${pending.unit.reference}` });
          }}
        />
      ) : null}
      {pending?.kind === "remove" ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => { if (!open) setPending(undefined); }}
          title={`Retirer le lot ${pending.unit.reference}`}
          description="Le lot est retiré du brouillon. Un mandat garde au moins un lot."
          confirmLabel="Retirer le lot"
          tone="danger"
          loading={action.isPending}
          onConfirm={() => {
            const target = pending.unit;
            action.mutate((ops) => ops.removeUnit(mandat.id, target.id), {
              onSuccess: () => {
                toast.show({ title: "Lot retiré", description: `Lot ${target.reference}` });
                setPending(undefined);
              },
              onError: (error) => {
                setPending(undefined);
                toast.show({ tone: "danger", title: "Le retrait a échoué", description: error.message });
              },
            });
          }}
        />
      ) : null}
    </div>
  );
}
