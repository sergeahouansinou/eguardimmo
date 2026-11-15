'use client';

import { Select, TextField } from '@eguardimmo/ui';
import { QueryState } from '../../outils/kit';
import type { ScreenProps } from '../../outils/kit';
import { FormAlerts } from '../shared/FormAlerts';
import { SettingRow, SettingsCard } from '../shared/SettingRow';
import { SettingsLayout } from '../shared/SettingsLayout';
import { Toggle } from '../shared/Toggle';
import { DocumentPreview } from './DocumentPreview';
import { FileRow } from './FileRow';
import { renderNumber } from './numbering';
import { avisScheduleOptions } from './options';
import { narrow } from '../shared/narrow';
import { AVIS_SCHEDULES, documentsSchema } from './schemas';
import type { DocumentsSettings } from './schemas';
import { useDocumentsSettings, useSaveDocuments } from './source';
import { useSettingsForm } from '../shared/useSettingsForm';

type Update = (patch: Partial<DocumentsSettings>) => void;

function NumberingCard({ value, update, errors }: { value: DocumentsSettings; update: Update; errors: Record<string, string> }) {
  return (
    <SettingsCard id="rd-num" title="Numérotation">
      <div>
        <SettingRow title="Quittances" hint={`Prochain numéro : ${renderNumber(value.quittanceFormat, value.quittanceNext)}`}>
          <TextField
            label="Format des quittances"
            hideLabel
            placeholder="Ex. : QT-{année}-{numéro}"
            className="sm:w-[260px]"
            value={value.quittanceFormat}
            error={errors.quittanceFormat}
            onChange={(event) => { update({ quittanceFormat: event.target.value }); }}
          />
        </SettingRow>
        <SettingRow title="Avis d'échéance" hint={`Prochain numéro : ${renderNumber(value.avisFormat, value.avisNext)}`}>
          <TextField
            label="Format des avis d'échéance"
            hideLabel
            placeholder="Ex. : AV-{année}-{mois}-{lot}"
            className="sm:w-[260px]"
            value={value.avisFormat}
            error={errors.avisFormat}
            onChange={(event) => { update({ avisFormat: event.target.value }); }}
          />
        </SettingRow>
      </div>
      <span className="text-caption text-fg-subtle">Numérotation continue. Un numéro émis n'est jamais réutilisé ni supprimé.</span>
    </SettingsCard>
  );
}

function ContentCard({ value, update, errors }: { value: DocumentsSettings; update: Update; errors: Record<string, string> }) {
  return (
    <SettingsCard id="rd-cont" title="Contenu des documents">
      <div>
        <FileRow title="Logo" hint="PNG ou JPG, 2 Mo maximum" name={value.logoName} inputLabel="Fichier du logo" onChange={(logoName) => { update({ logoName }); }} />
        <FileRow title="Signature" hint="Apposée sur les quittances et les courriers" name={value.signatureName} inputLabel="Fichier de la signature" onChange={(signatureName) => { update({ signatureName }); }} />
        <SettingRow title="Pied de page" hint="Vide : pied de page par défaut">
          <TextField
            label="Pied de page"
            hideLabel
            placeholder="Ex. : SCI Les Tilleuls, SIREN 912 345 678"
            className="sm:w-[300px]"
            value={value.footer}
            error={errors.footer}
            onChange={(event) => { update({ footer: event.target.value }); }}
          />
        </SettingRow>
        <SettingRow title="Code QR de vérification" hint="Permet de contrôler l'authenticité de la quittance">
          <Toggle label="Code QR de vérification" checked={value.qrCode} onCheckedChange={(qrCode) => { update({ qrCode }); }} />
        </SettingRow>
        <SettingRow title="Solde du locataire" hint="Dettes antérieures et solde, sur les avis et les quittances">
          <Toggle label="Solde du locataire" checked={value.tenantBalance} onCheckedChange={(tenantBalance) => { update({ tenantBalance }); }} />
        </SettingRow>
        <SettingRow title="Détail des charges" hint="Une ligne par poste plutôt qu'un total">
          <Toggle label="Détail des charges" checked={value.chargesDetail} onCheckedChange={(chargesDetail) => { update({ chargesDetail }); }} />
        </SettingRow>
      </div>
    </SettingsCard>
  );
}

function SendingCard({ value, update }: { value: DocumentsSettings; update: Update }) {
  return (
    <SettingsCard id="rd-env" title="Envoi automatique">
      <div>
        <SettingRow title="Avis d'échéance" hint="Envoyé par e-mail et déposé sur l'espace locataire">
          <Select
            label="Jour d'envoi des avis d'échéance"
            hideLabel
            placeholder="Choisir"
            className="w-full sm:w-[200px]"
            options={avisScheduleOptions}
            value={value.avisSchedule}
            disabled={!value.avisAuto}
            onValueChange={(next) => {
              const avisSchedule = narrow(AVIS_SCHEDULES, next);
              if (avisSchedule) update({ avisSchedule });
            }}
          />
          <Toggle label="Envoi automatique des avis d'échéance" checked={value.avisAuto} onCheckedChange={(avisAuto) => { update({ avisAuto }); }} />
        </SettingRow>
        <SettingRow title="Quittance" hint="Envoyée dès que l'échéance est entièrement payée">
          <Toggle label="Envoi automatique des quittances" checked={value.quittanceAuto} onCheckedChange={(quittanceAuto) => { update({ quittanceAuto }); }} />
        </SettingRow>
        <SettingRow title="Copie à mon adresse">
          <Toggle label="Copie à mon adresse" checked={value.copyToMe} onCheckedChange={(copyToMe) => { update({ copyToMe }); }} />
        </SettingRow>
      </div>
    </SettingsCard>
  );
}

export function ReglagesDocumentsPage({ Link }: ScreenProps) {
  const query = useDocumentsSettings();
  const save = useSaveDocuments();
  const form = useSettingsForm({
    saved: query.data,
    schema: documentsSchema,
    save: (value) => save.mutateAsync(value),
    success: 'Réglages des documents enregistrés.',
  });
  return (
    <SettingsLayout
      Link={Link}
      section="documents"
      description="Présentation, numérotation et envoi des quittances et des avis d'échéance."
      onCancel={form.reset}
      onSave={form.submit}
      saving={form.saving}
    >
      <FormAlerts errors={form.errors} failed={form.failed} failureTitle="Les réglages n'ont pas pu être enregistrés" />
      <QueryState query={query} errorTitle="Les réglages n'ont pas pu être chargés" loadingLabel="Chargement des réglages">
        {() =>
          form.value ? (
            <div className="grid grid-cols-1 items-start gap-3 min-[1400px]:grid-cols-[minmax(0,1fr)_300px]">
              <div className="flex min-w-0 flex-col gap-3">
                <NumberingCard value={form.value} update={form.update} errors={form.errors} />
                <ContentCard value={form.value} update={form.update} errors={form.errors} />
                <SendingCard value={form.value} update={form.update} />
              </div>
              <DocumentPreview settings={form.value} />
            </div>
          ) : null
        }
      </QueryState>
    </SettingsLayout>
  );
}
