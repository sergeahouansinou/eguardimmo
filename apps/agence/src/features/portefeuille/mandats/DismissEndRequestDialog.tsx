"use client";

import { Button, Dialog, DialogContent, Textarea, useToast } from "@eguardimmo/ui";
import { useState } from "react";
import type { SubmitEvent } from "react";
import { z } from "zod";
import { useDismissEndRequest } from "../queries";

export const END_REQUEST_NOTE_MAX = 500;

const noteSchema = z.string().trim().max(END_REQUEST_NOTE_MAX, `La note ne peut pas dépasser ${String(END_REQUEST_NOTE_MAX)} caractères.`);

interface Props {
  mandateId: string;
  mandateNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DismissEndRequestDialog({ mandateId, mandateNumber, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Classer sans suite la demande de fin du mandat ${mandateNumber}`}
        description="Le mandat n’est pas modifié : la demande est marquée comme traitée. Cette décision ne peut pas être annulée."
      >
        <DismissForm mandateId={mandateId} mandateNumber={mandateNumber} onClose={() => { onOpenChange(false); }} />
      </DialogContent>
    </Dialog>
  );
}

function DismissForm({ mandateId, mandateNumber, onClose }: { mandateId: string; mandateNumber: string; onClose: () => void }) {
  const [note, setNote] = useState("");
  const dismiss = useDismissEndRequest(mandateId);
  const toast = useToast();
  const parsed = noteSchema.safeParse(note);
  const tooLong = !parsed.success;

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!parsed.success) return;
    dismiss.mutate(parsed.data === "" ? null : parsed.data, {
      onSuccess: () => {
        toast.show({ title: `Demande de fin du mandat ${mandateNumber} classée sans suite` });
        onClose();
      },
      onError: (error) => {
        toast.show({ tone: "danger", title: "La demande n’a pas pu être classée", description: error.message });
        onClose();
      },
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3 p-4">
      <Textarea
        label="Note (facultative)"
        placeholder="Ex. : vu avec le propriétaire, le mandat se poursuit."
        value={note}
        hint={`${String(note.trim().length)} / ${String(END_REQUEST_NOTE_MAX)} caractères`}
        {...(tooLong ? { error: parsed.error.issues[0]?.message ?? "Note trop longue." } : {})}
        onChange={(event) => { setNote(event.target.value); }}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button type="submit" loading={dismiss.isPending} disabled={tooLong}>
          Classer sans suite
        </Button>
      </div>
    </form>
  );
}
