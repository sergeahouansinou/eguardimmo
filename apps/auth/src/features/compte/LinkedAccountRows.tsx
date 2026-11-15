"use client";

import { Apple, Globe } from "lucide-react";
import { Button } from "@eguardimmo/ui";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { SocialIdentityPicker } from "@/components/SocialButtons";
import { useLinkProvider, useUnlinkProvider } from "@/features/auth/queries";
import type { LinkedAccount, SocialProvider } from "@/features/auth/schemas";
import { formatDate } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { ConfirmDialog } from "./ConfirmDialog";
import { useNoticeStore } from "./noticeStore";
import { SettingList, SettingRow, StatusPill } from "./parts";
import { useIsConfirmed, useRequireConfirmation } from "./useConfirmation";

const LABELS: Record<SocialProvider, string> = { google: "Google", apple: "Apple" };

export function LinkedAccountRows({
  accounts,
  confirmedUntil,
  conflictProvider,
}: {
  accounts: LinkedAccount[];
  confirmedUntil: string | null;
  conflictProvider?: SocialProvider;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const link = useLinkProvider();
  const unlink = useUnlinkProvider();
  const show = useNoticeStore((state) => state.show);
  const confirmed = useIsConfirmed(confirmedUntil);
  const requireConfirmation = useRequireConfirmation();
  const [picking, setPicking] = useState<SocialProvider | null>(null);
  const [unlinking, setUnlinking] = useState<SocialProvider | null>(null);

  const startLink = (provider: SocialProvider) => {
    if (!confirmed) {
      requireConfirmation(false);
      return;
    }
    setPicking(provider);
  };

  const startUnlink = (provider: SocialProvider) => {
    if (!confirmed) {
      requireConfirmation(false);
      return;
    }
    setUnlinking(provider);
  };

  const doLink = async (provider: SocialProvider, identityId: string) => {
    setPicking(null);
    try {
      const result = await link.mutateAsync({ provider, identityId });
      if (result.status === "ok") {
        const comingFromConflict = pathname.endsWith("liaison-impossible");
        show({ tone: "success", title: `${LABELS[provider]} lié à votre compte.` }, { carry: comingFromConflict });
        if (comingFromConflict) router.push(ROUTES.comptesLies);
      } else if (result.status === "conflict") {
        router.push(`${ROUTES.comptesLies}/liaison-impossible?fournisseur=${provider}`);
      } else {
        requireConfirmation(result.needsCode);
      }
    } catch {
      show({ tone: "danger", title: "Liaison impossible pour le moment.", message: "Réessayez dans un instant." });
    }
  };

  const doUnlink = async (provider: SocialProvider) => {
    try {
      const result = await unlink.mutateAsync(provider);
      setUnlinking(null);
      if (result.status === "ok") {
        show({ tone: "success", title: `${LABELS[provider]} délié de votre compte.` });
      } else if (result.status === "last_login_method") {
        show({
          tone: "danger",
          title: "Impossible de délier votre seul moyen de connexion.",
          message: "Définissez d’abord un mot de passe, puis réessayez.",
        });
      } else {
        requireConfirmation(result.needsCode);
      }
    } catch {
      setUnlinking(null);
      show({ tone: "danger", title: "Opération impossible pour le moment.", message: "Réessayez dans un instant." });
    }
  };

  return (
    <>
      <SettingList>
        {accounts.map((account) => {
          const conflict = conflictProvider === account.provider;
          const caption = conflict
            ? "Non lié. Liaison refusée."
            : account.linked
              ? `${account.email ?? ""}, lié le ${account.linkedAt ? formatDate(account.linkedAt) : ""}`
              : account.provider === "apple"
                ? "Non lié. Un e-mail relais Apple n’est jamais utilisé pour retrouver un compte."
                : "Non lié";
          return (
            <SettingRow
              key={account.provider}
              icon={account.provider === "apple" ? Apple : Globe}
              tone={conflict ? "danger" : account.linked ? "success" : "neutral"}
              title={LABELS[account.provider]}
              caption={caption}
              status={<StatusPill tone={account.linked ? "success" : "neutral"}>{account.linked ? "Lié" : "Non lié"}</StatusPill>}
              action={
                account.linked ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={`Délier ${LABELS[account.provider]}`}
                    onClick={() => { startUnlink(account.provider); }}
                  >
                    Délier
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant={conflict ? "primary" : "secondary"}
                    aria-label={conflict ? `Lier un autre compte ${LABELS[account.provider]}` : `Lier ${LABELS[account.provider]}`}
                    onClick={() => { startLink(account.provider); }}
                  >
                    {conflict ? `Lier un autre compte ${LABELS[account.provider]}` : "Lier"}
                  </Button>
                )
              }
            />
          );
        })}
      </SettingList>
      {picking ? (
        <SocialIdentityPicker
          provider={picking}
          intent="connexion"
          open
          busy={link.isPending}
          onOpenChange={(open) => {
            if (!open) setPicking(null);
          }}
          onPick={(identityId) => { void doLink(picking, identityId); }}
        />
      ) : null}
      <ConfirmDialog
        open={unlinking !== null}
        onOpenChange={(open) => {
          if (!open) setUnlinking(null);
        }}
        title={unlinking ? `Délier ${LABELS[unlinking]} ?` : "Délier ce compte ?"}
        description="Vous ne pourrez plus vous connecter avec ce compte. Votre compte eGuardImmo reste inchangé."
        confirmLabel="Délier"
        tone="danger"
        pending={unlink.isPending}
        onConfirm={() => {
          if (unlinking) void doUnlink(unlinking);
        }}
      />
    </>
  );
}
