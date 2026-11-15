"use client";

import { Badge, Button, TextField } from "@eguardimmo/ui";
import { useState } from "react";
import { useWatch } from "react-hook-form";
import { QueryState } from "@/components/ui/QueryState";
import { SectionCard } from "@/components/ui/SectionCard";
import { FormSelect, FormSwitch, useSchemaForm } from "@/features/kit/form";
import { useNotify } from "@/features/kit/notify";
import { SettingsPage } from "@/features/kit/SettingsPage";
import { splitServerError } from "@/features/kit/serverValidation";
import { formatDate } from "@/features/shared/dates";
import { parseMoney } from "@/features/shared/money";
import { AccountDialog } from "./AccountDialog";
import { excludingVatRate, formatPercent, parseRateBp, payoutDayLabel, rateBpToText } from "./logic";
import { useFinances, useSaveFinances } from "./queries";
import { FEE_BASES, VAT_OPTIONS, financesFormSchema } from "./schemas";
import type { Finances, FinancesForm } from "./schemas";
import { SettingRow, StaticRow } from "./SettingRow";

const PAYOUT_DAYS = Array.from({ length: 28 }, (_, index) => index + 1);

function moneyText(minor: number): string {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100);
}

function worksText(minor: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(minor / 100);
}

function toForm(finances: Finances): FinancesForm {
  return {
    feeRate: rateBpToText(finances.feeRateBp),
    feeBasis: finances.feeBasis,
    vat: String(finances.vatBp) as FinancesForm["vat"],
    minFee: moneyText(finances.minFeeMinor),
    payoutDay: String(finances.payoutDay),
    retainFees: finances.retainFees,
    attachReport: finances.attachReport,
    worksCeiling: worksText(finances.worksCeilingMinor),
  };
}

export function FinancesPage() {
  const query = useFinances();
  return (
    <QueryState query={query} label="Les réglages financiers">
      {(finances) => <FinancesSettings finances={finances} />}
    </QueryState>
  );
}

function FinancesSettings({ finances }: { finances: Finances }) {
  const notify = useNotify();
  const save = useSaveFinances();
  const form = useSchemaForm<FinancesForm, FinancesForm>(financesFormSchema, toForm(finances));
  const [editingAccount, setEditingAccount] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { errors } = form.formState;
  const feeRate = useWatch({ control: form.control, name: "feeRate" });
  const vat = useWatch({ control: form.control, name: "vat" });
  const rateBp = parseRateBp(feeRate);
  const vatHint =
    rateBp === null ? "Saisissez un taux pour voir l’équivalent hors taxe." : `${formatPercent(rateBp)} TTC correspondent à ${formatPercent(excludingVatRate(rateBp, Number(vat)))} hors taxe`;

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    const feeRateBp = parseRateBp(values.feeRate);
    const minFeeMinor = parseMoney(values.minFee);
    const worksCeilingMinor = parseMoney(values.worksCeiling);
    if (feeRateBp === null || minFeeMinor === null || worksCeilingMinor === null) return;
    try {
      const saved = await save.mutateAsync({
        feeRateBp,
        feeBasis: values.feeBasis,
        vatBp: Number(values.vat),
        minFeeMinor,
        payoutDay: Number(values.payoutDay),
        retainFees: values.retainFees,
        attachReport: values.attachReport,
        worksCeilingMinor,
      });
      form.reset(toForm(saved));
      notify.success("Réglages financiers enregistrés", "Ils s’appliquent par défaut à chaque nouveau mandat.");
    } catch (error: unknown) {
      const { fields, message } = splitServerError(error);
      setFormError(message ?? Object.values(fields).join(" "));
    }
  });

  const { account } = finances;

  return (
    <SettingsPage
      currentHref="/reglages/finances"
      subtitle="Honoraires, reversements et compte des mandants, appliqués par défaut à chaque nouveau mandat."
      dirty={form.formState.isDirty}
      saving={save.isPending}
      formError={formError}
      onSubmit={(event) => {
        void submit(event);
      }}
      onCancel={() => {
        form.reset(toForm(finances));
        setFormError(null);
      }}
    >
      <SectionCard title="Honoraires de gestion">
        <SettingRow title="Taux par défaut" hint="Modifiable mandat par mandat">
          <TextField
            label="Taux par défaut (% TTC)"
            hideLabel
            inputMode="decimal"
            placeholder="Ex. : 7"
            error={errors.feeRate?.message}
            className="text-right"
            {...form.register("feeRate")}
          />
        </SettingRow>
        <SettingRow title="Base de calcul" hint="Honoraires prélevés à chaque encaissement">
          <FormSelect
            control={form.control}
            name="feeBasis"
            label="Base de calcul"
            hideLabel
            placeholder="Choisir une base"
            options={FEE_BASES.map((basis) => ({ value: basis.value, label: basis.label }))}
          />
        </SettingRow>
        <SettingRow title="TVA applicable" hint={vatHint}>
          <FormSelect
            control={form.control}
            name="vat"
            label="TVA applicable"
            hideLabel
            placeholder="Choisir un taux"
            options={VAT_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
          />
        </SettingRow>
        <SettingRow title="Minimum mensuel par lot" hint="Appliqué si le loyer est faible">
          <TextField
            label="Minimum mensuel par lot (€)"
            hideLabel
            inputMode="decimal"
            placeholder="Ex. : 15,00"
            error={errors.minFee?.message}
            className="text-right"
            {...form.register("minFee")}
          />
        </SettingRow>
      </SectionCard>
      <SectionCard title="Reversements">
        <SettingRow title="Jour de reversement" hint="Aux mandants, après rapprochement bancaire">
          <FormSelect
            control={form.control}
            name="payoutDay"
            label="Jour de reversement"
            hideLabel
            placeholder="Choisir un jour"
            options={PAYOUT_DAYS.map((day) => ({ value: String(day), label: payoutDayLabel(day) }))}
          />
        </SettingRow>
        <FormSwitch
          control={form.control}
          name="retainFees"
          label="Retenue des honoraires"
          hint="Déduits du reversement, détaillés sur le compte rendu"
        />
        <FormSwitch control={form.control} name="attachReport" label="Compte rendu de gestion joint" hint="Envoyé avec chaque reversement" />
        <SettingRow title="Travaux sans accord du mandant" hint="Au-delà, un devis lui est soumis">
          <TextField
            label="Travaux sans accord du mandant (€)"
            hideLabel
            inputMode="decimal"
            placeholder="Ex. : 300"
            error={errors.worksCeiling?.message}
            className="text-right"
            {...form.register("worksCeiling")}
          />
        </SettingRow>
      </SectionCard>
      <SectionCard
        title="Compte des mandants"
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setEditingAccount(true);
            }}
          >
            Modifier le compte
          </Button>
        }
      >
        <StaticRow title="IBAN" hint="Compte séquestre, distinct de celui de l’agence">
          <span className="tabular-nums">{account.ibanMasked}</span>
        </StaticRow>
        <StaticRow title="Banque">{account.bank}</StaticRow>
        <StaticRow title="Titulaire">{account.holder}</StaticRow>
        <StaticRow
          title="Dernier rapprochement"
          hint={account.reconciledOn ? "Relevé bancaire et grand livre concordent" : "Le compte a changé : lancez un rapprochement bancaire"}
        >
          {account.reconciledOn ? (
            <>
              <span>{formatDate(account.reconciledOn)}</span>
              <Badge tone="success">Conforme</Badge>
            </>
          ) : (
            <Badge tone="warning">À faire</Badge>
          )}
        </StaticRow>
      </SectionCard>
      <AccountDialog account={account} open={editingAccount} onOpenChange={setEditingAccount} />
    </SettingsPage>
  );
}
