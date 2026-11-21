"use client";

import { Button, Spinner } from "@eguardimmo/ui";
import { FormAlert } from "@/components/FormAlert";

export function Loading({ label }: { label: string }) {
  return (
    <div className="flex justify-center py-10">
      <Spinner size={32} label={label} />
    </div>
  );
}

export function Retry({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <FormAlert tone="danger" title={title} focusOnMount>
        {message}
      </FormAlert>
      <Button className="self-start" onClick={onRetry}>
        Réessayer
      </Button>
    </div>
  );
}
