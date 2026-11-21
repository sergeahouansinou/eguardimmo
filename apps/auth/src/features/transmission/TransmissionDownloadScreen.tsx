"use client";

import { Button, Icon } from "@eguardimmo/ui";
import { Download, FileArchive, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { AuthCard, AuthHeading } from "@/components/AuthCard";
import { FormAlert } from "@/components/FormAlert";
import { IconTile } from "@/components/IconTile";
import { StatusScreen } from "@/components/StatusScreen";
import { apiEnv } from "@/lib/env";
import { downloadTransmission, saveBlob } from "./download";
import type { DownloadOutcome } from "./download";
import { ZIP_FILE_NAME, transmissionTokenSchema } from "./token";

type Failure = Exclude<DownloadOutcome["kind"], "ok" | "not_found">;

type State = { step: "idle" } | { step: "loading" } | { step: "done" } | { step: "invalid" } | { step: "failed"; failure: Failure; retryAfterSeconds: number | null };

const secondsLabel = (seconds: number): string => `${String(seconds)} seconde${seconds > 1 ? "s" : ""}`;

function failureMessage(state: Extract<State, { step: "failed" }>): { title: string; message: string } {
  if (state.failure === "rate_limited") return { title: "Trop de tentatives", message: `Patientez ${secondsLabel(state.retryAfterSeconds ?? 60)} avant de réessayer.` };
  if (state.failure === "unreachable") return { title: "Serveur injoignable", message: "Vérifiez votre connexion puis réessayez : votre lien reste valable." };
  return { title: "Téléchargement indisponible", message: "Le téléchargement est momentanément indisponible. Réessayez dans un instant : votre lien reste valable." };
}

export function InvalidLinkScreen() {
  return (
    <StatusScreen icon={TriangleAlert} tone="warning" title="Lien invalide ou expiré" description="Ce lien n’existe pas, a expiré ou a été révoqué. Demandez à son expéditeur de vous en envoyer un nouveau." />
  );
}

export function TransmissionDownloadScreen({ urlToken }: { urlToken: string }) {
  const token = transmissionTokenSchema.safeParse(urlToken);
  const [state, setState] = useState<State>(token.success ? { step: "idle" } : { step: "invalid" });

  if (state.step === "invalid" || !token.success) return <InvalidLinkScreen />;

  const download = async () => {
    setState({ step: "loading" });
    const outcome = await downloadTransmission(token.data, apiEnv().NEXT_PUBLIC_API_URL);
    if (outcome.kind === "not_found") setState({ step: "invalid" });
    else if (outcome.kind === "ok") {
      saveBlob(outcome.blob, ZIP_FILE_NAME);
      setState({ step: "done" });
    } else setState({ step: "failed", failure: outcome.kind, retryAfterSeconds: outcome.kind === "rate_limited" ? outcome.retryAfterSeconds : null });
  };

  return (
    <AuthCard label="Téléchargement des pièces" centered>
      <IconTile icon={FileArchive} tone="info" large />
      <AuthHeading
        title="Pièces d’un dossier de recouvrement"
        description="Vous avez reçu ce lien pour récupérer les pièces d’un dossier : décompte des sommes dues, avis d’échéance, fiche du bail et extrait du grand livre, réunis dans un fichier ZIP."
        focus
      />
      <div className="flex w-full flex-col items-stretch gap-3">
        {state.step === "done" ? (
          <FormAlert tone="success" title="Téléchargement lancé">
            {`Le fichier ${ZIP_FILE_NAME} a été enregistré. Vous pouvez le télécharger à nouveau tant que le lien est valable.`}
          </FormAlert>
        ) : null}
        {state.step === "failed" ? (
          <FormAlert tone="danger" title={failureMessage(state).title} focusOnMount>
            {failureMessage(state).message}
          </FormAlert>
        ) : null}
        <Button className="w-full" loading={state.step === "loading"} onClick={() => { void download(); }}>
          <Icon icon={Download} />
          {state.step === "done" ? "Télécharger à nouveau" : "Télécharger le dossier (ZIP)"}
        </Button>
        <p className="text-center text-caption text-fg-subtle">Chaque téléchargement est enregistré avec sa date et votre adresse IP. Le lien expire à la date fixée par son expéditeur.</p>
      </div>
    </AuthCard>
  );
}
