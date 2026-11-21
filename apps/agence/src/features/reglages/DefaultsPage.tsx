"use client";

import { Alert, Button, Skeleton } from "@eguardimmo/ui";
import { useState } from "react";
import { SettingsPage } from "@/features/kit/SettingsPage";
import { useTermDefaults } from "@/features/portefeuille/queries";
import { DefaultsForm } from "./DefaultsForm";

const FINANCES_HREF = "/reglages/finances";
const SUBTITLE = "Conditions types qui préremplissent la création d’un mandat. Chaque mandat reste la seule référence de ses honoraires : modifier ces réglages ne touche aucun mandat existant.";

export function DefaultsPage() {
  const state = useTermDefaults();
  const [generation, setGeneration] = useState(0);

  if (state.kind === "ready") {
    const reload = async (): Promise<void> => {
      await state.reload();
      setGeneration((value) => value + 1);
    };
    return <DefaultsForm key={generation} defaults={state.defaults} canSave={state.canSave} reload={reload} />;
  }

  return (
    <SettingsPage currentHref={FINANCES_HREF} subtitle={SUBTITLE}>
      {state.kind === "loading" ? (
        <div role="status" aria-label="Chargement : les conditions par défaut" className="flex flex-col gap-3">
          <Skeleton shape="block" className="h-32" />
          <Skeleton shape="block" className="h-48" />
        </div>
      ) : state.kind === "unverifiable" ? (
        <Alert tone="danger" title="Les conditions par défaut n’ont pas pu être chargées">
          <div className="flex flex-col items-start gap-2">
            <span>Le serveur n’a pas répondu. Vos conditions ne sont pas perdues : réessayez dans un instant.</span>
            <Button variant="secondary" size="sm" onClick={state.retry}>
              Réessayer
            </Button>
          </div>
        </Alert>
      ) : (
        <Alert tone="info" title="Conditions par défaut indisponibles">
          Cette fonction n’est pas reliée au serveur.
        </Alert>
      )}
    </SettingsPage>
  );
}
