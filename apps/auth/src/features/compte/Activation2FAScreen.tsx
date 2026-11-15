"use client";

import { Alert, Button, TextField } from "@eguardimmo/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DemoNotice } from "@/components/DemoNotice";
import { FormAlert } from "@/components/FormAlert";
import { QrCode } from "@/components/QrCode";
import { Stepper } from "@/components/Stepper";
import { TextLink } from "@/components/TextLink";
import { useCodesStore } from "@/features/auth/codesStore";
import { useEnableTwoFactor, useSecurity, useTwoFactorSetup } from "@/features/auth/queries";
import { totpCodeSchema } from "@/features/auth/schemas";
import { ROUTES } from "@/lib/routes";
import { PageHead, Section } from "./parts";
import { QueryState } from "./QueryState";
import { useIsConfirmed, useRequireConfirmation } from "./useConfirmation";

function groupKey(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

export function Activation2FAScreen() {
  const router = useRouter();
  const security = useSecurity();
  const data = security.data;
  const confirmed = useIsConfirmed(data?.confirmedUntil);
  const requireConfirmation = useRequireConfirmation();
  const enable = useEnableTwoFactor();
  const reveal = useCodesStore((state) => state.reveal);
  const ready = data !== undefined && confirmed && data.hasPassword && !data.twoFactor.enabled;
  const setup = useTwoFactorSetup(ready);
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState<"format" | "invalid" | "technical" | null>(null);

  useEffect(() => {
    if (!data) return;
    if (data.twoFactor.enabled) router.replace(ROUTES.compte);
    else if (data.hasPassword && !confirmed) requireConfirmation(false);
  }, [data, confirmed, router, requireConfirmation]);

  const submit = async () => {
    const parsed = totpCodeSchema.safeParse(code);
    if (!parsed.success) {
      setProblem("format");
      return;
    }
    setProblem(null);
    try {
      const result = await enable.mutateAsync(parsed.data);
      if (result.status === "ok") {
        reveal(result.backupCodes);
        router.push(ROUTES.codesSecours);
      } else if (result.status === "invalid_code") {
        setProblem("invalid");
        setCode("");
      } else {
        requireConfirmation(result.needsCode);
      }
    } catch {
      setProblem("technical");
    }
  };

  return (
    <>
      <PageHead
        crumbs={[{ label: "Mon compte", href: ROUTES.compte }, { label: "Sécurité", href: ROUTES.compte }, { label: "Double authentification" }]}
        title="Activer la double authentification"
        description="Un code à usage unique, en plus de votre mot de passe, protège votre compte."
      />
      <Stepper steps={["Scanner le code", "Codes de secours"]} current={0} />
      <QueryState isPending={security.isPending} isError={security.isError} refetch={security.refetch} label="double authentification">
        {data && !data.hasPassword ? (
          <Alert tone="warning" title="Un mot de passe est requis.">
            Définissez un mot de passe avant d’activer la double authentification.{" "}
            <TextLink href="/mot-de-passe/definir">Définir un mot de passe</TextLink>
          </Alert>
        ) : null}
        {ready ? (
          <>
            <Alert tone="success" title="Mot de passe confirmé.">
              Vous pouvez poursuivre pendant les 5 prochaines minutes.
            </Alert>
            <QueryState isPending={setup.isPending} isError={setup.isError} refetch={setup.refetch} label="clé de configuration">
              <Section id="a1" title="Scanner le code">
                <ol className="flex list-decimal flex-col gap-2 pl-5 text-body text-fg-muted">
                  <li>Installez une application d’authentification (Google Authenticator, 1Password, Microsoft Authenticator).</li>
                  <li>Scannez le code ci-dessous, ou saisissez la clé à la main.</li>
                  <li>Saisissez le code à 6 chiffres affiché pour confirmer.</li>
                </ol>
                <div className="flex flex-wrap items-start gap-4">
                  {setup.data ? <QrCode value={setup.data.otpauthUri} label="QR code de configuration de l’authentification en deux étapes" /> : null}
                  <div className="flex min-w-0 flex-1 basis-56 flex-col gap-3">
                    <span className="text-caption text-fg-subtle">Clé de configuration</span>
                    <code className="w-fit max-w-full rounded-sm border border-line bg-muted px-2.5 py-1.5 text-body-strong tracking-wider break-all text-fg">
                      {groupKey(setup.data?.secret ?? "")}
                    </code>
                    <form
                      noValidate
                      id="activation-2fa"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void submit();
                      }}
                    >
                      <TextField
                        label="Code à 6 chiffres *"
                        placeholder="123 456"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={code}
                        onChange={(event) => { setCode(event.target.value); }}
                        error={
                          problem === "format"
                            ? "Le code comporte 6 chiffres."
                            : problem === "invalid"
                              ? "Code incorrect. Vérifiez l’heure de votre téléphone."
                              : undefined
                        }
                      />
                    </form>
                  </div>
                </div>
                {problem === "technical" ? (
                  <FormAlert tone="danger" title="Activation impossible pour le moment." focusOnMount>
                    Une erreur est survenue. Réessayez dans un instant.
                  </FormAlert>
                ) : null}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="secondary" onClick={() => { router.push(ROUTES.compte); }}>
                    Annuler
                  </Button>
                  <Button type="submit" form="activation-2fa" loading={enable.isPending}>
                    Confirmer et activer
                  </Button>
                </div>
                <DemoNotice>Code de démonstration : 481305.</DemoNotice>
              </Section>
            </QueryState>
          </>
        ) : null}
      </QueryState>
    </>
  );
}
