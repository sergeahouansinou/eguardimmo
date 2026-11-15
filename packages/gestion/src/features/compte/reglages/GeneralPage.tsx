'use client';

import { Select } from '@eguardimmo/ui';
import type { SelectOption } from '@eguardimmo/ui';
import { useTheme } from '@eguardimmo/shell';
import type { ThemeChoice } from '@eguardimmo/shell';
import { QueryState, Segmented } from '../../outils/kit';
import type { ScreenProps } from '../../outils/kit';
import { FormAlerts } from '../shared/FormAlerts';
import { SettingRow, SettingsCard, controlWidth } from '../shared/SettingRow';
import { SettingsLayout } from '../shared/SettingsLayout';
import { Toggle } from '../shared/Toggle';
import { areaUnitOptions, currencyOptions, dateFormatOptions, displayNameOptions, fiscalStartOptions, languageOptions, taxRegimeOptions, timezoneOptions } from './options';
import { narrow } from '../shared/narrow';
import {
  AREA_UNITS,
  CURRENCY_CHOICES,
  DATE_FORMATS,
  DISPLAY_NAMES,
  FISCAL_STARTS,
  TAX_REGIMES,
  TIMEZONES,
  generalSchema,
} from './schemas';
import type { GeneralSettings } from './schemas';
import { useGeneralSettings, useSaveGeneral } from './source';
import { useSettingsForm } from '../shared/useSettingsForm';

const THEME_OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
  { value: 'auto', label: 'Système' },
];

function Choice<T extends string>({
  title,
  hint,
  options,
  candidates,
  value,
  onChange,
}: {
  title: string;
  hint?: string;
  options: SelectOption[];
  candidates: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <SettingRow title={title} hint={hint}>
      <Select
        label={title}
        hideLabel
        placeholder="Choisir"
        className={controlWidth}
        options={options}
        value={value}
        onValueChange={(next) => {
          const found = narrow(candidates, next);
          if (found) onChange(found);
        }}
      />
    </SettingRow>
  );
}

function GeneralForm({ value, update }: { value: GeneralSettings; update: (patch: Partial<GeneralSettings>) => void }) {
  const [theme, setTheme] = useTheme();
  return (
    <>
      <SettingsCard id="rg-aff" title="Affichage">
        <div>
          <Choice title="Affichage des noms" hint="Ordre utilisé dans les listes et les documents" options={displayNameOptions} candidates={DISPLAY_NAMES} value={value.displayNames} onChange={(displayNames) => { update({ displayNames }); }} />
          <Choice title="Langue" hint="Interface et documents envoyés aux locataires" options={languageOptions} candidates={['fr'] as const} value={value.language} onChange={(language) => { update({ language }); }} />
          <Choice title="Devise par défaut" hint="Chaque bien garde la devise de son pays" options={currencyOptions} candidates={CURRENCY_CHOICES} value={value.currency} onChange={(currency) => { update({ currency }); }} />
          <Choice title="Format de date" options={dateFormatOptions} candidates={DATE_FORMATS} value={value.dateFormat} onChange={(dateFormat) => { update({ dateFormat }); }} />
          <Choice title="Fuseau horaire" hint="Heure des rappels et des envois programmés" options={timezoneOptions} candidates={TIMEZONES} value={value.timezone} onChange={(timezone) => { update({ timezone }); }} />
          <Choice title="Unité de surface" options={areaUnitOptions} candidates={AREA_UNITS} value={value.areaUnit} onChange={(areaUnit) => { update({ areaUnit }); }} />
          <SettingRow title="Apparence" hint="Appliquée immédiatement sur cet appareil">
            <Segmented label="Apparence" options={THEME_OPTIONS} value={theme} onValueChange={setTheme} />
          </SettingRow>
        </div>
      </SettingsCard>
      <SettingsCard id="rg-comp" title="Comptabilité">
        <div>
          <Choice title="Début de l'exercice" hint="Bilans et déclarations calculés sur cette période" options={fiscalStartOptions} candidates={FISCAL_STARTS} value={value.fiscalYearStart} onChange={(fiscalYearStart) => { update({ fiscalYearStart }); }} />
          <Choice title="Régime fiscal par défaut" hint="Proposé à la création d'un bien" options={taxRegimeOptions} candidates={TAX_REGIMES} value={value.taxRegime} onChange={(taxRegime) => { update({ taxRegime }); }} />
          <SettingRow title="Mode expert" hint="Affiche les écritures, les comptes et les réglages avancés">
            <Toggle label="Mode expert" checked={value.expertMode} onCheckedChange={(expertMode) => { update({ expertMode }); }} />
          </SettingRow>
          <SettingRow title="Aide à la saisie" hint="Propose une catégorie pour les dépenses importées">
            <Toggle label="Aide à la saisie" checked={value.entryAssist} onCheckedChange={(entryAssist) => { update({ entryAssist }); }} />
          </SettingRow>
        </div>
      </SettingsCard>
    </>
  );
}

export function ReglagesPage({ Link }: ScreenProps) {
  const query = useGeneralSettings();
  const save = useSaveGeneral();
  const form = useSettingsForm({
    saved: query.data,
    schema: generalSchema,
    save: (value) => save.mutateAsync(value),
    success: 'Réglages généraux enregistrés.',
  });
  return (
    <SettingsLayout
      Link={Link}
      section="general"
      description="Préférences d'affichage et de comptabilité, appliquées à tout le compte."
      onCancel={form.reset}
      onSave={form.submit}
      saving={form.saving}
    >
      <FormAlerts errors={form.errors} failed={form.failed} failureTitle="Les réglages n'ont pas pu être enregistrés" />
      <QueryState query={query} errorTitle="Les réglages n'ont pas pu être chargés" loadingLabel="Chargement des réglages">
        {() => (form.value ? <GeneralForm value={form.value} update={form.update} /> : null)}
      </QueryState>
    </SettingsLayout>
  );
}
