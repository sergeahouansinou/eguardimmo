"use client";

import { Alert, Badge, Button, Card, CardHeader, CardTitle, Icon } from "@eguardimmo/ui";
import { ExternalLink, History } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useWatch } from "react-hook-form";
import { QueryState } from "@/components/ui/QueryState";
import { ActionDialog, FormSelect, FormSwitch, SettingsPage, SummaryLines, applyServerError, useNotify, useSchemaForm } from "@/features/kit";
import { formatDate, formatDateTime } from "@/features/shared/dates";
import { messageOf } from "@/features/shared/errors";
import { DevicesDialog } from "./DevicesDialog";
import { useSaveSecurityRules, useSecurity, useSignOutDevice } from "./hooks";
import { InfoRow } from "./InfoRow";
import { LoginLogDialog } from "./LoginLogDialog";
import { PasswordDialog } from "./PasswordDialog";
import { MIN_LENGTH_VALUES, PASSWORD_LENGTH_OPTIONS, securityRulesInputSchema } from "./securitySchemas";
import type { Device, SecurityOverview, SecurityRulesInput } from "./securitySchemas";

type Panel = "password" | "log" | "devices" | null;

const STRENGTH_TONES = { Forte: "success", Correcte: "warning", Faible: "danger" } as const;

function rulesOf(overview: SecurityOverview): SecurityRulesInput {
  return {
    twoFactorRequired: overview.rules.twoFactorRequired,
    minPasswordLength: MIN_LENGTH_VALUES[overview.rules.minPasswordLength],
  };
}

function missingTwoFactor(names: readonly string[]): { title: string; detail: string } | null {
  if (names.length === 0) return null;
  if (names.length === 1) {
    return {
      title: `${names[0] ?? ""} n'a pas encore activé la double authentification`,
      detail: "Elle devra l'activer à sa prochaine connexion.",
    };
  }
  return {
    title: `${names.join(", ")} n'ont pas encore activé la double authentification`,
    detail: "Ils devront l'activer à leur prochaine connexion.",
  };
}

function SecurityForm({ overview }: { overview: SecurityOverview }) {
  const notify = useNotify();
  const save = useSaveSecurityRules();
  const signOut = useSignOutDevice();
  const [panel, setPanel] = useState<Panel>(null);
  const [deviceToSignOut, setDeviceToSignOut] = useState<Device | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, reset, setError, formState } = useSchemaForm(securityRulesInputSchema, rulesOf(overview));
  const { connection, team } = overview;
  const required = useWatch({ control, name: "twoFactorRequired" });
  const missing = required ? missingTwoFactor(team.withoutTwoFactor) : null;
  const deviceCount = connection.devices.length;

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await save.mutateAsync(values);
      reset(values);
      notify.success("Règles de sécurité enregistrées");
    } catch (error) {
      setFormError(applyServerError(setError, error));
    }
  });

  const confirmSignOut = async () => {
    if (!deviceToSignOut) return;
    setSignOutError(null);
    try {
      await signOut.mutateAsync(deviceToSignOut.id);
      notify.success("Appareil déconnecté", deviceToSignOut.label);
      setDeviceToSignOut(null);
    } catch (error) {
      setSignOutError(messageOf(error));
    }
  };

  return (
    <SettingsPage
      currentHref="/compte/securite"
      subtitle="Règles de l'agence et résumé de votre propre connexion."
      onSubmit={(event) => void submit(event)}
      onCancel={() => {
        reset(rulesOf(overview));
        setFormError(null);
      }}
      dirty={formState.isDirty}
      saving={save.isPending}
      formError={formError}
    >
      <div className="grid min-w-0 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_18.75rem]">
        <div className="flex min-w-0 flex-col gap-3">
          <Card role="region" aria-label="Règles de l'agence">
            <CardHeader>
              <CardTitle as="h2">Règles de l'agence</CardTitle>
            </CardHeader>
            <FormSwitch
              control={control}
              name="twoFactorRequired"
              label="Double authentification obligatoire"
              hint={`${String(team.covered)} collaborateurs sur ${String(team.total)} l'ont activée`}
            />
            <FormSelect
              control={control}
              name="minPasswordLength"
              label="Longueur minimale du mot de passe"
              placeholder="Choisir une longueur"
              hint="Imposée à toute l'équipe"
              options={PASSWORD_LENGTH_OPTIONS}
              className="max-w-64"
            />
            {missing ? (
              <Alert tone="warning" title={missing.title}>
                <span className="flex flex-wrap items-center justify-between gap-2">
                  {missing.detail}
                  <Button asChild variant="secondary" size="sm">
                    <Link href="/equipe">Voir l'équipe</Link>
                  </Button>
                </span>
              </Alert>
            ) : null}
          </Card>
          <Card role="region" aria-label="Ma connexion">
            <CardHeader>
              <CardTitle as="h2">Ma connexion</CardTitle>
              <Button
                size="sm"
                onClick={() => {
                  setPanel("password");
                }}
              >
                <Icon icon={ExternalLink} />
                Gérer dans Mon compte
              </Button>
            </CardHeader>
            <InfoRow
              title="Mot de passe"
              hint={`Modifié le ${formatDate(connection.passwordChangedAt)}`}
              trailing={<Badge tone={STRENGTH_TONES[connection.passwordStrength]}>{connection.passwordStrength}</Badge>}
            />
            <InfoRow
              title="Double authentification"
              hint={`${connection.twoFactorMethod} · ${String(connection.backupCodes)} codes de secours`}
              trailing={<Badge tone="success">Activée</Badge>}
            />
            <InfoRow
              title="Appareils connectés"
              hint={deviceCount > 1 ? `${String(deviceCount)} appareils, dont cette session` : "Cette session uniquement"}
              trailing={
                <>
                  <Badge>{deviceCount}</Badge>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setPanel("devices");
                    }}
                  >
                    Gérer les appareils
                  </Button>
                </>
              }
            />
          </Card>
        </div>
        <aside className="flex min-w-0 flex-col gap-3">
          <Card role="region" aria-label="Journal de connexion">
            <CardHeader>
              <CardTitle as="h2">Journal de connexion</CardTitle>
            </CardHeader>
            <SummaryLines
              lines={[
                { label: "Dernière connexion", value: connection.lastLoginAt ? formatDateTime(connection.lastLoginAt) : "Jamais" },
                { label: "Échecs en 30 jours", value: String(connection.failuresLast30Days) },
                { label: "Nouvel appareil", value: connection.lastNewDeviceAt ? formatDate(connection.lastNewDeviceAt) : "Aucun" },
              ]}
            />
            <Button
              variant="secondary"
              onClick={() => {
                setPanel("log");
              }}
            >
              <Icon icon={History} />
              Voir le journal
            </Button>
          </Card>
        </aside>
      </div>
      {panel === "password" ? (
        <PasswordDialog
          minLength={overview.rules.minPasswordLength}
          onClose={() => {
            setPanel(null);
          }}
        />
      ) : null}
      {panel === "log" ? (
        <LoginLogDialog
          log={connection.log}
          onClose={() => {
            setPanel(null);
          }}
        />
      ) : null}
      {panel === "devices" ? (
        <DevicesDialog
          devices={connection.devices}
          onClose={() => {
            setPanel(null);
          }}
          onSignOut={(device) => {
            setPanel(null);
            setDeviceToSignOut(device);
          }}
        />
      ) : null}
      <ActionDialog
        open={deviceToSignOut !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeviceToSignOut(null);
            setSignOutError(null);
          }
        }}
        tone="danger"
        title="Déconnecter cet appareil ?"
        description={deviceToSignOut ? `${deviceToSignOut.label} devra se reconnecter avec votre mot de passe et un code de double authentification.` : ""}
        confirmLabel="Déconnecter"
        cancelLabel="Retour"
        loading={signOut.isPending}
        error={signOutError}
        onConfirm={() => void confirmSignOut()}
      />
    </SettingsPage>
  );
}

export function SecurityPage() {
  const query = useSecurity();
  return (
    <QueryState query={query} label="La sécurité du compte">
      {(overview) => <SecurityForm overview={overview} />}
    </QueryState>
  );
}
