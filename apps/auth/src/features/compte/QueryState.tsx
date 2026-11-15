"use client";

import { Alert, Button, Spinner } from "@eguardimmo/ui";
import type { ReactNode } from "react";

export function QueryState({
  isPending,
  isError,
  refetch,
  label,
  children,
}: {
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
  label: string;
  children: ReactNode;
}) {
  if (isError) {
    return (
      <div className="flex flex-col gap-3">
        <Alert tone="danger" title={`Impossible de charger : ${label}`}>
          Une erreur est survenue. Vérifiez votre connexion puis réessayez.
        </Alert>
        <Button onClick={refetch} className="self-start">
          Réessayer
        </Button>
      </div>
    );
  }
  if (isPending) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size={32} label={`Chargement : ${label}`} />
      </div>
    );
  }
  return <>{children}</>;
}
