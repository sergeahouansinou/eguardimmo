"use client";

import { Alert, Button } from "@eguardimmo/ui";
import { useReloadPortefeuille } from "../queries";
import { PortefeuilleError } from "../source";

export function isStaleVersion(error: unknown): boolean {
  return error instanceof PortefeuilleError && error.kind === "stale_version";
}

export function MutationFailure({ title, message, error }: { title: string; message: string; error?: unknown }) {
  const reload = useReloadPortefeuille();
  return (
    <Alert tone="danger" title={isStaleVersion(error) ? "Mandat modifié entre-temps" : title}>
      <span className="flex flex-wrap items-center gap-2">
        {message}
        {isStaleVersion(error) ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void reload();
            }}
          >
            Recharger le mandat
          </Button>
        ) : null}
      </span>
    </Alert>
  );
}
