"use client";

import { Alert, Button, Icon } from "@eguardimmo/ui";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { formatDay } from "@/lib/dates";
import type { IssuedInvitation } from "./schemas";

type CopyState = "idle" | "copied" | "failed";

export function PairingCodeView({ issued, onDone }: { issued: IssuedInvitation; onDone: () => void }) {
  const [copy, setCopy] = useState<CopyState>("idle");
  const { invitation } = issued;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(issued.pairing_code);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <Alert tone="warning" title="Ce code ne s’affiche qu’une seule fois">
        Transmettez-le au propriétaire par un autre canal que l’e-mail (de vive voix, par téléphone ou en main propre). Il ne sera plus consultable après la fermeture de cette fenêtre.
      </Alert>
      <div className="flex flex-col items-center gap-2 rounded-md border border-line bg-muted px-3 py-4">
        <span className="text-caption text-fg-subtle">Code d’appariement à 6 chiffres</span>
        <output aria-label="Code d’appariement" className="select-all font-mono text-[28px] leading-8 font-semibold tracking-[0.3em] text-fg tabular-nums">
          {issued.pairing_code}
        </output>
        <Button variant="secondary" size="sm" onClick={() => { void copyCode(); }}>
          <Icon icon={copy === "copied" ? Check : Copy} />
          {copy === "copied" ? "Code copié" : "Copier le code"}
        </Button>
        {copy === "failed" ? <p role="alert" className="text-caption text-fg-danger">Copie impossible : sélectionnez le code ci-dessus et copiez-le à la main.</p> : null}
      </div>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-body text-fg-muted">
        <li>
          Une invitation a été envoyée à {invitation.email_hint ?? "l’adresse indiquée"}, valable jusqu’au {formatDay(invitation.expires_at.slice(0, 10))}.
        </li>
        <li>{`Le propriétaire dispose de ${String(invitation.attempts_remaining)} essais pour saisir le code.`}</li>
        <li>Le mandant sera averti à son adresse principale de cette invitation.</li>
      </ul>
      <div className="flex justify-end">
        <Button onClick={onDone}>J’ai transmis le code</Button>
      </div>
    </div>
  );
}
