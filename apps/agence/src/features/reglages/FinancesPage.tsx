"use client";

import { Badge, Button, TextField } from "@eguardimmo/ui";
import { useMemo, useState } from "react";
import { QueryState } from "@/components/ui/QueryState";
import { SectionCard } from "@/components/ui/SectionCard";
import { FormSelect, useSchemaForm } from "@/features/kit/form";
import { useNotify } from "@/features/kit/notify";
import { SettingsPage } from "@/features/kit/SettingsPage";
import { splitServerError } from "@/features/kit/serverValidation";
import { formatDate } from "@/features/shared/dates";
import { parseMoney } from "@/features/shared/money";
import { currencySymbol, formatAmountInput } from "@/lib/currency";
import type { Currency } from "@/lib/currency";
import { AccountDialog } from "./AccountDialog";
import { formatPercent, parseRateBp, payoutDayLabel, rateBpToText } from "./logic";
import { useFinances, useSaveFinances } from "./queries";
import { FEE_BASES, FEE_TAX_MODES, makeFinancesFormSchema } from "./schemas";
import type { Finances, FinancesForm } from "./schemas";
import { SettingRow, StaticRow } from "./SettingRow";

const PAYOUT_DAYS = Array.from({ length: 28 }, (_, index) => index + 1);

const VAT_REGIME_LABELS = { normal: "Assujettie à la TVA", franchise: "Franchise en base de TVA" } as const;

function toForm(finances: Finances): FinancesForm {
  const currency: Currency = finances.currency;
  return {
    feeRate: rateBpToText(finances.feeRateBp),
    feeBasis: finances.feeBasis,
    feeTaxMode: finances.feeTaxMode,
    minFee: formatAmountInput(finances.minFeeMinor, currency),
    payoutDay: String(finances.payoutDay),
    worksCeiling: formatAmountInput(finances.worksCeilingMinor, currency),
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
  const currency: Currency = finances.currency;
  const symbol = currencySymbol(currency);
  const schema = useMemo(() => makeFinancesFormSchema(currency), [currency]);
  const form = useSchemaForm<FinancesForm, FinancesForm>(schema, toForm(finances));
  const [editingAccount, setEditingAccount] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { errors } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    const feeRateBp = parseRateBp(values.feeRate);
    const minFeeMinor = parseMoney(values.minFee, currency);
    const worksCeilingMinor = parseMoney(values.worksCeiling, currency);
    if (feeRateBp === null || minFeeMinor === null || worksCeilingMinor === null) return;
    try {
      const saved = await save.mutateAsync({
        feeRateBp,
        feeBasis: values.feeBasis,
        feeTaxMode: values.feeTaxMode,
        minFeeMinor,
        payoutDay: Number(values.payoutDay),
        worksCeilingMinor,
      });
      form.reset(toForm(saved));
      notify.success("Réglages financiers enregistrés", "Ils préremplissent chaque nouveau mandat. Les mandats existants ne changent pas.");
    } catch (error: unknown) {
      const { fields, message } = splitServerError(error);
      setFormError(message ?? Object.values(fields).join(" "));
    }
  });

  const { account } = finances;

  return (
    <SettingsPage
      currentHref="/reglages/finances"
      subtitle="Conditions types qui préremplissent la création d’un mandat. Chaque mandat reste la seule référence de ses honoraires : modifier ces réglages ne touche aucun mandat existant."
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
        <SettingRow title="Taux par défaut" hint="Modifiable mandat par mandat, par avenant signé">
          <TextField
            label="Taux par défaut (%)"
            hideLabel
            inputMode="decimal"
            placeholder="Ex. : 7"
            error={errors.feeRate?.message}
            className="text-right"
            {...form.register("feeRate")}
          />
        </SettingRow>
        <SettingRow title="Base de calcul" hint="Les honoraires sont retenus au reversement, sur les loyers encaissés">
          <FormSelect
            control={form.control}
            name="feeBasis"
            label="Base de calcul"
            hideLabel
            placeholder="Choisir une base"
            options={FEE_BASES.map((basis) => ({ value: basis.value, label: basis.label }))}
          />
        </SettingRow>
        <SettingRow title="Honoraires exprimés" hint="Hors taxes ou toutes taxes comprises">
          <FormSelect
            control={form.control}
            name="feeTaxMode"
            label="Honoraires exprimés"
            hideLabel
            placeholder="Choisir un mode"
            options={FEE_TAX_MODES.map((mode) => ({ value: mode.value, label: mode.label }))}
          />
        </SettingRow>
        <SettingRow title="Minimum mensuel par lot" hint="Appliqué si le loyer est faible">
          <TextField
            label={`Minimum mensuel par lot (${symbol})`}
            hideLabel
            inputMode="decimal"
            placeholder={currency === "XOF" ? "Ex. : 5 000" : "Ex. : 15,00"}
            error={errors.minFee?.message}
            className="text-right"
            {...form.register("minFee")}
          />
        </SettingRow>
        <StaticRow title="TVA" hint="Lecture seule : régime de l’identité légale et taux de la juridiction de l’agence">
          <span>{VAT_REGIME_LABELS[finances.vat.regime]}</span>
          {finances.vat.regime === "normal" ? <Badge>{`Taux ${formatPercent(finances.vat.rateBp)}`}</Badge> : null}
        </StaticRow>
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
        <SettingRow title="Travaux sans accord du mandant" hint="Au-delà, un devis lui est soumis">
          <TextField
            label={`Travaux sans accord du mandant (${symbol})`}
            hideLabel
            inputMode="decimal"
            placeholder={currency === "XOF" ? "Ex. : 250 000" : "Ex. : 300"}
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
        <StaticRow title="IBAN" hint="Compte séquestre, distinct de celui de l’agence. Visible du titulaire, de l’administrateur et du comptable.">
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
