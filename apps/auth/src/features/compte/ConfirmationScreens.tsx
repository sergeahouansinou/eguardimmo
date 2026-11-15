"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@eguardimmo/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { CodeInput } from "@/components/CodeInput";
import { DemoNotice } from "@/components/DemoNotice";
import { FormAlert } from "@/components/FormAlert";
import { PasswordField } from "@/components/PasswordField";
import { TextLink, AltLine } from "@/components/TextLink";
import { useConfirmCode, useConfirmPassword, useSecurity } from "@/features/auth/queries";
import { confirmPasswordSchema, totpCodeSchema } from "@/features/auth/schemas";
import type { ConfirmPasswordValues } from "@/features/auth/schemas";
import type { ConfirmationResult } from "@/features/auth/source";
import { isInternalPath } from "@/lib/returnTo";
import { formatDuration } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { useCountdown } from "@/lib/useCountdown";
import { PageHead, Section } from "./parts";
import { QueryState } from "./QueryState";
import { withConfirmed } from "./useConfirmation";

function useConfirmationTarget() {
  const router = useRouter();
  const params = useSearchParams();
  const suiteParam = params.get("suite");
  const suite = isInternalPath(suiteParam) ? suiteParam : ROUTES.compte;
  const exigeCode = params.get("exige") === "code";
  const query = (path: string, withExige = true) => {
    const next = new URLSearchParams({ suite });
    if (withExige && exigeCode) next.set("exige", "code");
    return `${path}?${next.toString()}`;
  };
  return {
    suite,
    exigeCode,
    query,
    done: () => { router.replace(withConfirmed(suite)); },
    cancel: () => { router.push(suite); },
  };
}

function useConfirmationOutcome() {
  const [problem, setProblem] = useState<"invalid" | "locked" | "technical" | null>(null);
  const [lockSeconds, setLockSeconds] = useState(0);
  const remaining = useCountdown(lockSeconds);
  const apply = (result: ConfirmationResult, onConfirmed: () => void) => {
    if (result.status === "confirmed") {
      onConfirmed();
    } else if (result.status === "locked") {
      setLockSeconds(result.retryAfterSeconds);
      setProblem("locked");
    } else {
      setProblem("invalid");
    }
  };
  return { problem, setProblem, remaining, locked: problem === "locked" && remaining > 0, apply };
}

function Alerts({ outcome, invalidTitle, invalidMessage }: { outcome: ReturnType<typeof useConfirmationOutcome>; invalidTitle: string; invalidMessage: string }) {
  return (
    <>
      {outcome.problem === "invalid" ? (
        <FormAlert tone="danger" title={invalidTitle} focusOnMount>
          {invalidMessage}
        </FormAlert>
      ) : null}
      {outcome.locked ? (
        <FormAlert tone="warning" title="Trop de tentatives.">
          Réessayez dans {formatDuration(outcome.remaining)}.
        </FormAlert>
      ) : null}
      {outcome.problem === "technical" ? (
        <FormAlert tone="danger" title="Confirmation impossible pour le moment." focusOnMount>
          Une erreur est survenue. Réessayez dans un instant.
        </FormAlert>
      ) : null}
    </>
  );
}

export function ConfirmerMotDePasseScreen() {
  const target = useConfirmationTarget();
  const security = useSecurity();
  const confirm = useConfirmPassword();
  const outcome = useConfirmationOutcome();
  const form = useForm<ConfirmPasswordValues>({
    resolver: zodResolver(confirmPasswordSchema),
    defaultValues: { password: "" },
  });
  const { setFocus } = form;
  const router = useRouter();
  const { exigeCode } = target;
  const codePath = target.query(`${ROUTES.confirmation}/code`);
  useEffect(() => {
    if (exigeCode) router.replace(codePath);
    else setFocus("password");
  }, [setFocus, exigeCode, codePath, router]);

  const submit = form.handleSubmit(async (values) => {
    outcome.setProblem(null);
    try {
      outcome.apply(await confirm.mutateAsync(values.password), target.done);
      form.resetField("password");
    } catch {
      outcome.setProblem("technical");
    }
  });

  return (
    <>
      <PageHead
        crumbs={[{ label: "Mon compte", href: ROUTES.compte }, { label: "Sécurité", href: ROUTES.compte }, { label: "Confirmation" }]}
        title="Confirmez votre mot de passe"
        description="Action sensible : nous vérifions que c’est bien vous."
      />
      <QueryState isPending={security.isPending} isError={security.isError} refetch={security.refetch} label="confirmation">
        <Section id="k1" title="Confirmation">
          <Alerts outcome={outcome} invalidTitle="Mot de passe incorrect." invalidMessage="Vérifiez votre saisie puis réessayez." />
          {security.data && !security.data.hasPassword ? (
            <FormAlert tone="info" title="Votre compte n’a pas de mot de passe.">
              Définissez-en un pour confirmer cette action. <TextLink href="/mot-de-passe/definir">Définir un mot de passe</TextLink>
            </FormAlert>
          ) : null}
          <form noValidate onSubmit={(event) => { void submit(event); }} className="flex flex-col gap-3">
            <PasswordField
              label="Mot de passe *"
              placeholder="Votre mot de passe"
              autoComplete="current-password"
              error={form.formState.errors.password?.message}
              {...form.register("password")}
            />
            <div className="flex justify-end">
              <TextLink href={ROUTES.motDePasseOublie}>Mot de passe oublié ?</TextLink>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={target.cancel}>
                Annuler
              </Button>
              <Button type="submit" loading={form.formState.isSubmitting} disabled={outcome.locked}>
                Confirmer
              </Button>
            </div>
          </form>
          {security.data?.twoFactor.enabled ? (
            <AltLine>
              Ou <TextLink href={target.query(`${ROUTES.confirmation}/code`, false)}>confirmer avec un code de double authentification</TextLink>
            </AltLine>
          ) : null}
          <DemoNotice>Mot de passe de démonstration : MotDePasse-2026.</DemoNotice>
        </Section>
      </QueryState>
    </>
  );
}

export function ConfirmerCodeScreen() {
  const target = useConfirmationTarget();
  const security = useSecurity();
  const confirm = useConfirmCode();
  const outcome = useConfirmationOutcome();
  const [code, setCode] = useState("");
  const [focusSignal, setFocusSignal] = useState(0);
  const [format, setFormat] = useState(false);

  const submit = async () => {
    const parsed = totpCodeSchema.safeParse(code);
    setFormat(!parsed.success);
    if (!parsed.success) return;
    outcome.setProblem(null);
    try {
      outcome.apply(await confirm.mutateAsync(parsed.data), target.done);
      setCode("");
      setFocusSignal((value) => value + 1);
    } catch {
      outcome.setProblem("technical");
    }
  };

  return (
    <>
      <PageHead
        crumbs={[{ label: "Mon compte", href: ROUTES.compte }, { label: "Sécurité", href: ROUTES.compte }, { label: "Confirmation" }]}
        title="Confirmez avec votre code"
        description="Action sensible : saisissez le code à 6 chiffres de votre application d’authentification."
      />
      <QueryState isPending={security.isPending} isError={security.isError} refetch={security.refetch} label="confirmation">
        <Section id="k2" title="Confirmation">
          <Alerts outcome={outcome} invalidTitle="Code incorrect." invalidMessage="Vérifiez l’heure de votre téléphone. Après 5 essais, patientez une minute." />
          {format ? (
            <FormAlert tone="danger" title="Le code comporte 6 chiffres." focusOnMount>
              Saisissez les 6 chiffres affichés par votre application.
            </FormAlert>
          ) : null}
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
            className="flex flex-col gap-3"
          >
            <CodeInput
              label="Code à 6 chiffres"
              value={code}
              onChange={setCode}
              invalid={outcome.problem === "invalid" || format}
              disabled={outcome.locked}
              focusOnMount
              focusSignal={focusSignal}
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={target.cancel}>
                Annuler
              </Button>
              <Button type="submit" loading={confirm.isPending} disabled={outcome.locked}>
                Confirmer
              </Button>
            </div>
          </form>
          {target.exigeCode ? null : (
            <AltLine>
              <TextLink href={target.query(ROUTES.confirmation)}>Confirmer avec mon mot de passe</TextLink>
            </AltLine>
          )}
          <DemoNotice>Code de démonstration : 481305 (compte Koffi).</DemoNotice>
        </Section>
      </QueryState>
    </>
  );
}
