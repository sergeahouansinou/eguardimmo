"use client";

import { Key, Mail, Monitor, QrCode, Smartphone, Trash2 } from "lucide-react";
import { Alert, Button } from "@eguardimmo/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { TextLink } from "@/components/TextLink";
import { useDisableTwoFactor, useRegenerateBackupCodes, useSecurity, useSession } from "@/features/auth/queries";
import type { SecurityOverview } from "@/features/auth/schemas";
import { useAuthSource } from "@/features/auth/source";
import { formatDate, formatDay, formatElapsed } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { ChangeEmailDialog, ChangePasswordDialog } from "./ChangeDialogs";
import { ConfirmDialog } from "./ConfirmDialog";
import { LinkedAccountRows } from "./LinkedAccountRows";
import { QueryState } from "./QueryState";
import { useCodesStore } from "@/features/auth/codesStore";
import { useNoticeStore } from "./noticeStore";
import { PageHead, Section, SettingList, SettingRow, StatusPill } from "./parts";
import { useIsConfirmed, useRequireConfirmation } from "./useConfirmation";

type Pending = "disable" | "regenerate" | null;

function TwoFactorSection({ security }: { security: SecurityOverview }) {
  const router = useRouter();
  const disable = useDisableTwoFactor();
  const regenerate = useRegenerateBackupCodes();
  const reveal = useCodesStore((state) => state.reveal);
  const show = useNoticeStore((state) => state.show);
  const confirmed = useIsConfirmed(security.confirmedUntil);
  const requireConfirmation = useRequireConfirmation();
  const [pending, setPending] = useState<Pending>(null);
  const { twoFactor } = security;

  const ask = (action: Exclude<Pending, null>) => {
    if (!confirmed) {
      requireConfirmation(false);
      return;
    }
    setPending(action);
  };

  const confirm = async () => {
    try {
      if (pending === "disable") {
        const result = await disable.mutateAsync(undefined);
        setPending(null);
        if (result.status === "ok") show({ tone: "success", title: "Double authentification désactivée." });
        else requireConfirmation(result.needsCode);
      } else if (pending === "regenerate") {
        const result = await regenerate.mutateAsync(undefined);
        setPending(null);
        if (result.status === "ok") {
          reveal(result.backupCodes);
          router.push(`${ROUTES.codesSecours}?regeneration=1`);
        } else {
          requireConfirmation(result.needsCode);
        }
      }
    } catch {
      setPending(null);
      show({ tone: "danger", title: "Opération impossible pour le moment.", message: "Réessayez dans un instant." });
    }
  };

  return (
    <Section id="s2" title="Double authentification">
      <SettingList>
        <SettingRow
          icon={QrCode}
          tone={twoFactor.enabled ? "success" : "neutral"}
          title="Application d’authentification"
          caption={twoFactor.enabled && twoFactor.enabledAt ? `Activée le ${formatDate(twoFactor.enabledAt)}` : "Non activée"}
          status={<StatusPill tone={twoFactor.enabled ? "success" : "neutral"}>{twoFactor.enabled ? "Activée" : "Désactivée"}</StatusPill>}
          action={
            twoFactor.enabled ? (
              <Button size="sm" variant="secondary" onClick={() => { ask("disable"); }}>
                Désactiver
              </Button>
            ) : security.hasPassword ? (
              <Button asChild size="sm" variant="secondary">
                <Link href={ROUTES.doubleAuthentification}>Activer</Link>
              </Button>
            ) : (
              <TextLink href="/mot-de-passe/definir">Définir un mot de passe</TextLink>
            )
          }
        />
        {twoFactor.enabled ? (
          <SettingRow
            icon={Key}
            title="Codes de secours"
            caption={`${String(twoFactor.backupCodesRemaining)} codes restants sur ${String(twoFactor.backupCodesTotal)}`}
            action={
              <Button size="sm" variant="secondary" onClick={() => { ask("regenerate"); }}>
                Régénérer
              </Button>
            }
          />
        ) : null}
      </SettingList>
      {!twoFactor.enabled && !security.hasPassword ? (
        <Alert tone="info" title="Un mot de passe est requis avant d’activer la double authentification." />
      ) : null}
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={pending === "disable" ? "Désactiver la double authentification ?" : "Régénérer les codes de secours ?"}
        description={
          pending === "disable"
            ? "Votre compte ne sera plus protégé que par votre mot de passe. Les codes de secours seront supprimés."
            : "Les codes actuels cessent de fonctionner. Les nouveaux codes ne s’affichent qu’une seule fois."
        }
        confirmLabel={pending === "disable" ? "Désactiver" : "Régénérer"}
        tone={pending === "disable" ? "danger" : "primary"}
        pending={disable.isPending || regenerate.isPending}
        onConfirm={() => { void confirm(); }}
      />
    </Section>
  );
}

function SecurityContent({ security, fullName }: { security: SecurityOverview; fullName: string }) {
  const source = useAuthSource();
  const params = useSearchParams();
  const confirmed = useIsConfirmed(security.confirmedUntil);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const now = source.now();
  const others = security.devices.filter((device) => !device.current);
  const current = security.devices.find((device) => device.current);
  const shown = [others[0], current].filter((device) => device !== undefined);

  return (
    <>
      <PageHead
        crumbs={[{ label: "Mon compte", href: ROUTES.compte }, { label: "Sécurité" }]}
        title="Sécurité du compte"
        description={`Connecté en tant que ${fullName}, ${security.email}. Ces réglages valent pour tous vos espaces eGuardImmo.`}
      />
      {params.get("confirme") === "1" && confirmed ? (
        <Alert tone="success" title="Mot de passe confirmé.">
          Vous pouvez poursuivre pendant les 5 prochaines minutes.
        </Alert>
      ) : null}
      <Section id="s1" title="Connexion">
        <SettingList>
          <SettingRow
            icon={Mail}
            tone="success"
            title="E-mail"
            caption={security.email}
            status={
              <StatusPill tone={security.emailVerified ? "success" : "warning"}>
                {security.emailVerified ? "Vérifié" : "Non vérifié"}
              </StatusPill>
            }
            action={
              <Button size="sm" variant="secondary" onClick={() => { setEmailOpen(true); }}>
                Modifier
              </Button>
            }
          />
          <SettingRow
            icon={Key}
            title="Mot de passe"
            caption={
              security.hasPassword
                ? security.passwordChangedAt
                  ? `Modifié ${formatElapsed(security.passwordChangedAt, now)}`
                  : "Défini"
                : "Non défini"
            }
            action={
              security.hasPassword ? (
                <Button size="sm" variant="secondary" onClick={() => { setPasswordOpen(true); }}>
                  Modifier
                </Button>
              ) : (
                <TextLink href="/mot-de-passe/definir">Définir</TextLink>
              )
            }
          />
        </SettingList>
      </Section>
      <TwoFactorSection security={security} />
      <Section id="s3" title="Comptes liés" action={<TextLink href={ROUTES.comptesLies}>Gérer</TextLink>}>
        <LinkedAccountRows accounts={security.linkedAccounts} confirmedUntil={security.confirmedUntil} />
      </Section>
      <Section id="s4" title="Appareils connectés" action={<TextLink href={ROUTES.appareils}>Tout voir, {security.devices.length}</TextLink>}>
        <SettingList>
          {shown.map((device) => (
            <SettingRow
              key={device.id}
              icon={device.type === "mobile" ? Smartphone : Monitor}
              title={device.name}
              caption={
                device.current
                  ? "Session en cours"
                  : `Dernière activité ${formatDay(device.lastActivityAt, now)}${device.location ? `, ${device.location}` : ""}`
              }
              status={device.current ? <StatusPill tone="info">Cet appareil</StatusPill> : undefined}
            />
          ))}
        </SettingList>
      </Section>
      <Section id="s5" title="Zone sensible">
        <SettingList>
          <SettingRow
            icon={Trash2}
            tone="danger"
            title="Supprimer mon compte"
            caption="Anonymise votre compte. Les documents légaux sont conservés."
            action={
              <Button asChild size="sm" variant="secondary">
                <Link href={ROUTES.supprimer}>Supprimer</Link>
              </Button>
            }
          />
        </SettingList>
      </Section>
      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
      <ChangeEmailDialog open={emailOpen} onOpenChange={setEmailOpen} />
    </>
  );
}

export function SecuriteScreen() {
  const security = useSecurity();
  const session = useSession();
  const fullName = session.data ? `${session.data.firstName} ${session.data.lastName}` : "";
  return (
    <QueryState isPending={security.isPending || session.isPending} isError={security.isError} refetch={security.refetch} label="sécurité du compte">
      {security.data ? <SecurityContent security={security.data} fullName={fullName} /> : null}
    </QueryState>
  );
}
