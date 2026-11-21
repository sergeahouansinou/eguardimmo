"use client";

import { Alert, Button, Dialog, DialogContent, TextField } from "@eguardimmo/ui";
import { useState } from "react";
import type { SubmitEvent } from "react";
import type { z } from "zod";

export interface EditField {
  name: string;
  label: string;
  placeholder: string;
  value: string;
  hint?: string;
  type?: "text" | "date";
}

export interface EditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  fields: readonly EditField[];
  schema: z.ZodType<Record<string, string>>;
  onSubmit: (values: Record<string, string>) => Promise<void>;
}

export function EditDialog({ open, onOpenChange, title, description, fields, schema, onSubmit }: EditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} {...(description ? { description } : {})}>
        <EditForm fields={fields} schema={schema} onSubmit={onSubmit} onCancel={() => { onOpenChange(false); }} onDone={() => { onOpenChange(false); }} />
      </DialogContent>
    </Dialog>
  );
}

interface EditFormProps {
  fields: readonly EditField[];
  schema: z.ZodType<Record<string, string>>;
  onSubmit: (values: Record<string, string>) => Promise<void>;
  onCancel: () => void;
  onDone: () => void;
}

function EditForm({ fields, schema, onSubmit, onCancel, onDone }: EditFormProps) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((field) => [field.name, field.value])));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string>();
  const [pending, setPending] = useState(false);

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setFailure(undefined);
    setPending(true);
    try {
      await onSubmit(parsed.data);
      onDone();
    } catch (error: unknown) {
      setFailure(error instanceof Error ? error.message : "L'enregistrement a échoué.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={(event) => { void submit(event); }} noValidate className="flex flex-col gap-3 p-4">
      {failure ? <Alert tone="danger" title="Modification impossible">{failure}</Alert> : null}
      {fields.map((field) => (
        <TextField
          key={field.name}
          label={field.label}
          placeholder={field.placeholder}
          {...(field.type ? { type: field.type } : {})}
          value={values[field.name] ?? ""}
          {...(field.hint ? { hint: field.hint } : {})}
          {...(errors[field.name] ? { error: errors[field.name] } : {})}
          onChange={(event) => { setValues((current) => ({ ...current, [field.name]: event.target.value })); }}
        />
      ))}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" loading={pending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
