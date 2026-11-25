"use client";

import { Alert, Button, Dialog, DialogClose, DialogContent, TextField } from "@eguardimmo/ui";
import { useState } from "react";
import { useFieldArray, useWatch } from "react-hook-form";
import { DialogBody, DialogFooter, FormSelect, FormSwitch, useNotify, useSchemaForm } from "@/features/kit";
import { OrgApiError, errorMessage } from "@/features/org/errors";
import { CHOICE_TYPES, TYPE_LABELS, VOCABULARY_LABELS } from "./labels";
import { buildPayload, emptyForm, fieldFormSchema, formFromField } from "./form";
import type { FieldForm } from "./form";
import { useSaveField } from "./hooks";
import { FIELD_TYPES, VOCABULARIES } from "./schemas";
import type { CustomField, Entity } from "./schemas";

const TYPE_OPTIONS = FIELD_TYPES.map((value) => ({ value, label: TYPE_LABELS[value] }));
const VOCABULARY_OPTIONS = VOCABULARIES.map((value) => ({ value, label: VOCABULARY_LABELS[value] }));
const SERVER_FIELDS: readonly string[] = ["key", "type", "vocabulary", "required"];

export interface FieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: Entity;
  field: CustomField | null;
}

export function FieldDialog({ open, onOpenChange, entity, field }: FieldDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={field === null ? "Nouveau champ personnalisé" : "Modifier le champ"}
        description="Le champ apparaît dans les formulaires de l’objet concerné pour toute l’agence."
      >
        <FieldForm
          entity={entity}
          field={field}
          onDone={() => {
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function FieldForm({ entity, field, onDone }: { entity: Entity; field: CustomField | null; onDone: () => void }) {
  const notify = useNotify();
  const save = useSaveField(entity);
  const editing = field !== null;
  const locked = field?.typeLocked === true;
  const form = useSchemaForm<FieldForm, FieldForm>(fieldFormSchema(editing), field === null ? emptyForm() : formFromField(field));
  const options = useFieldArray({ control: form.control, name: "options" });
  const type = useWatch({ control: form.control, name: "type" });
  const [formError, setFormError] = useState<string | null>(null);
  const { errors } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await save.mutateAsync({ payload: buildPayload(values, field ?? undefined), existing: field });
      notify.success(editing ? "Champ modifié" : "Champ créé", values.label);
      onDone();
    } catch (error: unknown) {
      const named = error instanceof OrgApiError ? Object.entries(error.fieldErrors).filter(([name]) => SERVER_FIELDS.includes(name)) : [];
      named.forEach(([name, messages]) => {
        form.setError(name as "key" | "type" | "vocabulary" | "required", { type: "server", message: messages[0] ?? "" });
      });
      setFormError(named.length === 0 ? errorMessage(error) : null);
    }
  });

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <DialogBody>
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        <TextField label="Libellé" placeholder="Ex. : Code d’accès" error={errors.label?.message} {...form.register("label")} />
        <TextField
          label="Clé technique"
          placeholder="Ex. : code_acces"
          hint={editing ? "La clé ne change plus après la création." : "Identifiant stable utilisé par les imports et l’API."}
          error={errors.key?.message}
          disabled={editing}
          {...form.register("key")}
        />
        <FormSelect
          control={form.control}
          name="type"
          label="Type de valeur"
          placeholder="Choisir un type"
          options={TYPE_OPTIONS}
          disabled={locked}
          hint={locked ? "Des valeurs existent déjà : le type n’est plus modifiable." : undefined}
        />
        {type === "term" ? <FormSelect control={form.control} name="vocabulary" label="Référentiel" placeholder="Choisir un référentiel" options={VOCABULARY_OPTIONS} searchable searchPlaceholder="Rechercher un référentiel" /> : null}
        {CHOICE_TYPES.includes(type) ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-body font-medium text-fg">Options</legend>
            {options.fields.map((item, index) => {
              const fixed = locked && item.key !== "";
              return (
                <div key={item.id} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <TextField label={`Option ${String(index + 1)}`} placeholder="Ex. : Nord" error={errors.options?.[index]?.label?.message} {...form.register(`options.${String(index)}.label` as `options.${number}.label`)} />
                  </div>
                  {fixed ? null : (
                    <Button
                      variant="secondary"
                      className="mt-6 min-h-11"
                      onClick={() => {
                        options.remove(index);
                      }}
                    >
                      Retirer <span className="sr-only">l’option {String(index + 1)}</span>
                    </Button>
                  )}
                </div>
              );
            })}
            {errors.options?.message ? <p role="alert" className="text-caption text-danger">{errors.options.message}</p> : null}
            <div>
              <Button
                variant="secondary"
                onClick={() => {
                  options.append({ key: "", label: "" });
                }}
              >
                Ajouter une option
              </Button>
            </div>
          </fieldset>
        ) : null}
        <FormSwitch control={form.control} name="required" label="Champ obligatoire" hint="La valeur devra être renseignée dans les formulaires de l’objet." />
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary">Annuler</Button>
        </DialogClose>
        <Button type="submit" loading={save.isPending}>
          {editing ? "Enregistrer" : "Créer le champ"}
        </Button>
      </DialogFooter>
    </form>
  );
}
