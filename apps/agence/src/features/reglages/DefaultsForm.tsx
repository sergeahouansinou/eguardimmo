"use client";

import { Alert, Button, RadioGroup, Select, TextField } from "@eguardimmo/ui";
import Link from "next/link";
import { useState } from "react";
import { Controller, useWatch } from "react-hook-form";
import { SectionCard } from "@/components/ui/SectionCard";
import { agenceRoutes } from "@/espace/routes";
import { useSchemaForm } from "@/features/kit/form";
import { useNotify } from "@/features/kit/notify";
import { SettingsPage } from "@/features/kit/SettingsPage";
import type { TermDefaults } from "@/features/portefeuille/api/apiDefaults";
import { FEE_BASE_OPTIONS, FEE_TAX_MODE_OPTIONS } from "@/features/portefeuille/feeTerms";
import { useSaveTermDefaults } from "@/features/portefeuille/queries";
import { PortefeuilleError } from "@/features/portefeuille/source";
import { defaultsToFormValues, toTermDefaultsInput } from "@/features/portefeuille/termsForm";
import { CURRENCIES, currencyName, currencySymbol } from "@/lib/currency";
import type { Currency } from "@/lib/currency";
import { BLANK_DEFAULTS_FORM, defaultsFieldOf, defaultsFormSchema } from "./defaultsSchema";
import type { DefaultsFormValues } from "./defaultsSchema";
import { SettingRow, StaticRow } from "./SettingRow";

const PAYOUT_DAY_OPTIONS = Array.from({ length: 28 }, (_, index) => ({ value: String(index + 1), label: index === 0 ? "Le 1er du mois" : `Le ${String(index + 1)} du mois` }));
const CURRENCY_OPTIONS = CURRENCIES.map((code) => ({ value: code, label: `${currencyName(code)} (${currencySymbol(code)})` }));
const FEE_KIND_OPTIONS = [
  { value: "percentage", label: "Pourcentage du loyer" },
  { value: "flat", label: "Forfait mensuel" },
];

interface DefaultsFormProps {
  defaults: TermDefaults | null;
  canSave: boolean;
  reload: () => Promise<void>;
}

export function DefaultsForm({ defaults, canSave, reload }: DefaultsFormProps) {
  const notify = useNotify();
  const save = useSaveTermDefaults();
  const initial = defaults === null ? BLANK_DEFAULTS_FORM : defaultsToFormValues(defaults);
  const form = useSchemaForm<DefaultsFormValues, DefaultsFormValues>(defaultsFormSchema, initial);
  const [formError, setFormError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [mismatch, setMismatch] = useState<Currency | null>(null);
  const { errors } = form.formState;
  const feeKind = useWatch({ control: form.control, name: "feeKind" });
  const currency: Currency = useWatch({ control: form.control, name: "currency" });
  const symbol = currencySymbol(currency);
  const readOnly = !canSave;

  const submit = form.handleSubmit(async (submitted) => {
    setFormError(null);
    setStale(false);
    try {
      const saved = await save.mutateAsync({ lockVersion: defaults?.lockVersion ?? null, values: toTermDefaultsInput(submitted) });
      form.reset(defaultsToFormValues(saved));
      if (saved.currency !== submitted.currency) {
        setMismatch(saved.currency);
        return;
      }
      setMismatch(null);
      notify.success("Conditions par défaut enregistrées", "Elles préremplissent chaque nouveau mandat. Les mandats existants ne changent pas.");
    } catch (error: unknown) {
      if (!(error instanceof PortefeuilleError)) {
        setFormError("L’enregistrement a échoué. Réessayez.");
        return;
      }
      if (error.kind === "stale_version") {
        setStale(true);
        setFormError(error.message);
        return;
      }
      const field = defaultsFieldOf(error.field, submitted.feeKind);
      if (field === undefined) setFormError(error.message);
      else form.setError(field, { type: "server", message: error.message });
    }
  });

  const subtitle = "Conditions types qui préremplissent la création d’un mandat. Chaque mandat reste la seule référence de ses honoraires : modifier ces réglages ne touche aucun mandat existant.";

  return (
    <SettingsPage
      currentHref={agenceRoutes.reglagesFinances}
      subtitle={subtitle}
      {...(readOnly
        ? {}
        : {
            dirty: form.formState.isDirty,
            saving: save.isPending,
            formError,
            onSubmit: (event) => {
              void submit(event);
            },
            onCancel: () => {
              form.reset(initial);
              setFormError(null);
              setStale(false);
            },
          })}
    >
      {stale ? (
        <Alert tone="warning" title="Conditions modifiées entre-temps">
          <div className="flex flex-col items-start gap-2">
            <span>Rechargez les conditions pour voir la dernière version, puis refaites votre changement.</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void reload();
              }}
            >
              Recharger
            </Button>
          </div>
        </Alert>
      ) : null}
      {mismatch === null ? null : (
        <Alert tone="warning" title={`Montants enregistrés en ${currencyName(mismatch)}`}>
          Les montants sont enregistrés dans la devise de l’organisation, {currencyName(mismatch)}, et non dans celle choisie. Vérifiez-les ci-dessous et corrigez-les si besoin.
        </Alert>
      )}
      {defaults === null ? (
        <Alert tone="info" title="Aucune condition par défaut n’est posée">
          {readOnly
            ? "Le titulaire ou un administrateur peut les poser. Chaque mandat se crée alors avec des conditions à saisir."
            : "Renseignez-les ci-dessous : elles préremplissent chaque nouveau mandat, qui reste modifiable."}
        </Alert>
      ) : readOnly ? (
        <Alert tone="info">Seuls le titulaire et les administrateurs modifient ces conditions.</Alert>
      ) : null}
      {defaults === null && readOnly ? null : (
        <>
          <SectionCard title="Honoraires de gestion">
            {defaults === null ? (
              <SettingRow title="Devise" hint="Doit être celle de l’organisation : le serveur enregistre les montants dans sa devise">
                <Controller control={form.control} name="currency" render={({ field }) => <Select label="Devise" hideLabel placeholder="Choisir une devise" options={CURRENCY_OPTIONS} value={field.value} onValueChange={field.onChange} disabled={readOnly} />} />
              </SettingRow>
            ) : (
              <StaticRow title="Devise" hint="Devise de l’organisation, non modifiable ici">
                {currencyName(defaults.currency)}
              </StaticRow>
            )}
            <SettingRow title="Mode de calcul" hint="Pourcentage du loyer ou forfait mensuel par lot">
              <Controller
                control={form.control}
                name="feeKind"
                render={({ field }) => (
                  <RadioGroup label="Mode de calcul" options={FEE_KIND_OPTIONS.map((option) => ({ ...option, disabled: readOnly }))} value={field.value} onValueChange={field.onChange} />
                )}
              />
            </SettingRow>
            {feeKind === "percentage" ? (
              <SettingRow title="Taux par défaut" hint="Modifiable mandat par mandat, par avenant signé">
                <TextField label="Taux par défaut (%)" hideLabel inputMode="decimal" placeholder="Ex. : 7" disabled={readOnly} error={errors.feePercent?.message} className="text-right" {...form.register("feePercent")} />
              </SettingRow>
            ) : (
              <SettingRow title="Forfait mensuel par lot" hint="Montant fixe retenu chaque mois">
                <TextField label={`Forfait mensuel par lot (${symbol})`} hideLabel inputMode="decimal" placeholder={currency === "XOF" ? "Ex. : 25 000" : "Ex. : 45"} disabled={readOnly} error={errors.flatFee?.message} className="text-right" {...form.register("flatFee")} />
              </SettingRow>
            )}
            <SettingRow title="Base de calcul" hint="Les honoraires sont retenus au reversement, sur les loyers encaissés">
              <Controller control={form.control} name="feeBase" render={({ field }) => <Select label="Base de calcul" hideLabel placeholder="Choisir une base" options={FEE_BASE_OPTIONS} value={field.value} onValueChange={field.onChange} disabled={readOnly} {...(errors.feeBase?.message ? { error: errors.feeBase.message } : {})} />} />
            </SettingRow>
            <SettingRow title="Honoraires exprimés" hint="Hors taxes ou toutes taxes comprises">
              <Controller control={form.control} name="feeTaxMode" render={({ field }) => <Select label="Honoraires exprimés" hideLabel placeholder="Choisir un mode" options={FEE_TAX_MODE_OPTIONS} value={field.value} onValueChange={field.onChange} disabled={readOnly} {...(errors.feeTaxMode?.message ? { error: errors.feeTaxMode.message } : {})} />} />
            </SettingRow>
            <SettingRow title="Minimum mensuel par lot" hint="Appliqué si le loyer est faible, 0 si aucun">
              <TextField label={`Minimum mensuel par lot (${symbol})`} hideLabel inputMode="decimal" placeholder={currency === "XOF" ? "Ex. : 5 000" : "Ex. : 15"} disabled={readOnly} error={errors.feeMinimum?.message} className="text-right" {...form.register("feeMinimum")} />
            </SettingRow>
            <SettingRow title="Relocation" hint="Part des honoraires en cas de relocation, vide si le mandat ne la prévoit pas">
              <TextField label="Honoraires de relocation (%)" hideLabel inputMode="decimal" placeholder="Ex. : 50" disabled={readOnly} error={errors.lettingRate?.message} className="text-right" {...form.register("lettingRate")} />
            </SettingRow>
            <SettingRow title="Suivi de travaux" hint="Honoraires sur les travaux suivis, vide si le mandat ne les prévoit pas">
              <TextField label="Honoraires de suivi de travaux (%)" hideLabel inputMode="decimal" placeholder="Ex. : 5" disabled={readOnly} error={errors.worksFeeRate?.message} className="text-right" {...form.register("worksFeeRate")} />
            </SettingRow>
            <StaticRow title="TVA" hint="Régime et taux de l’identité légale de l’agence">
              <Link href={agenceRoutes.reglages} className="inline-flex min-h-6 items-center text-action underline focus-visible:outline-2 focus-visible:outline-focus">
                Consulter l’identité légale
              </Link>
            </StaticRow>
          </SectionCard>
          <SectionCard title="Reversements">
            <SettingRow title="Jour de reversement" hint="Aux mandants, après rapprochement bancaire">
              <Controller control={form.control} name="payoutDay" render={({ field }) => <Select label="Jour de reversement" hideLabel placeholder="Choisir un jour" options={PAYOUT_DAY_OPTIONS} value={field.value} onValueChange={field.onChange} disabled={readOnly} {...(errors.payoutDay?.message ? { error: errors.payoutDay.message } : {})} />} />
            </SettingRow>
            <SettingRow title="Travaux sans accord du mandant" hint="Au-delà, un devis lui est soumis">
              <TextField label={`Travaux sans accord du mandant (${symbol})`} hideLabel inputMode="decimal" placeholder={currency === "XOF" ? "Ex. : 250 000" : "Ex. : 500"} disabled={readOnly} error={errors.worksLimit?.message} className="text-right" {...form.register("worksLimit")} />
            </SettingRow>
            <StaticRow title="Compte des mandants" hint="Compte séquestre, géré avec la banque">
              <Link href={agenceRoutes.banqueComptes} className="inline-flex min-h-6 items-center text-action underline focus-visible:outline-2 focus-visible:outline-focus">
                Consulter les comptes bancaires
              </Link>
            </StaticRow>
          </SectionCard>
        </>
      )}
    </SettingsPage>
  );
}
