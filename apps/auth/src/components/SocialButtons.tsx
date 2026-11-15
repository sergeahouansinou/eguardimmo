"use client";

import { Apple } from "lucide-react";
import { Button, Dialog, DialogContent, Icon } from "@eguardimmo/ui";
import { useState } from "react";
import { useAuthSource } from "@/features/auth/source";
import type { SocialIntent } from "@/features/auth/source";
import type { SocialProvider } from "@/features/auth/schemas";

const PROVIDER_LABELS: Record<SocialProvider, string> = { google: "Google", apple: "Apple" };

export function ProviderIcon({ provider }: { provider: SocialProvider }) {
  return provider === "google" ? (
    <span aria-hidden="true" className="text-[16px] leading-4 font-bold text-action-on-subtle">
      G
    </span>
  ) : (
    <Icon icon={Apple} />
  );
}

export function SocialIdentityPicker({
  provider,
  intent,
  open,
  onOpenChange,
  onPick,
  busy = false,
}: {
  provider: SocialProvider;
  intent: SocialIntent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (identityId: string) => void;
  busy?: boolean;
}) {
  const source = useAuthSource();
  const identities = source.socialIdentities(intent);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Choisir un compte ${PROVIDER_LABELS[provider]}`}
        description="Simulation du fournisseur : choisissez l’identité renvoyée à eGuardImmo."
      >
        <ul className="flex flex-col gap-2 p-4">
          {identities.map((identity) => (
            <li key={identity.id}>
              <Button
                variant="secondary"
                disabled={busy}
                className="h-auto w-full flex-col items-start gap-0 py-2 whitespace-normal"
                onClick={() => { onPick(identity.id); }}
              >
                <span className="text-body-strong">{identity.label}</span>
                <span className="text-caption font-normal text-fg-subtle">{identity.description}</span>
              </Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

export interface SocialButtonsProps {
  verb: "Continuer avec" | "S’inscrire avec" | "Activer avec";
  intent: SocialIntent;
  onPick: (provider: SocialProvider, identityId: string) => void;
  busy?: boolean;
}

export function SocialButtons({ verb, intent, onPick, busy = false }: SocialButtonsProps) {
  const [provider, setProvider] = useState<SocialProvider | null>(null);
  return (
    <>
      <div className="flex items-center gap-2 text-caption text-fg-subtle before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
        <span>ou</span>
      </div>
      {(["google", "apple"] as const).map((candidate) => (
        <Button
          key={candidate}
          variant="secondary"
          size="lg"
          className="w-full"
          disabled={busy}
          onClick={() => { setProvider(candidate); }}
        >
          <ProviderIcon provider={candidate} />
          {verb} {PROVIDER_LABELS[candidate]}
        </Button>
      ))}
      {provider ? (
        <SocialIdentityPicker
          provider={provider}
          intent={intent}
          open
          busy={busy}
          onOpenChange={(open) => {
            if (!open) setProvider(null);
          }}
          onPick={(identityId) => {
            onPick(provider, identityId);
            setProvider(null);
          }}
        />
      ) : null}
    </>
  );
}
