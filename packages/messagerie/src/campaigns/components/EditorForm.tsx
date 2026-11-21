'use client';

import { CircleCheck, Save, Send } from 'lucide-react';
import { useRef, useState } from 'react';
import { Alert, Button, Checkbox, ConfirmDialog, Icon, TextField, Textarea } from '@eguardimmo/ui';
import { CampaignTestButton, CampaignTestFeedback } from '../../components/CampaignTestSend';
import type { CampaignTestFeedbackState } from '../../components/CampaignTestSend';
import type { FieldErrors } from '../../components/formErrors';
import { campaignErrorMessage } from '../api/errors';
import { reachLabel, reachOf } from '../audience';
import { useCampaignsConfig } from '../context';
import { NO_PROSPECTING_TEXT, PLAIN_TEXT_NOTICE } from '../copy';
import { validateEditor } from '../editorValidation';
import type { BuildingScope, EditorValues } from '../editorValidation';
import { mergeToken } from '../mergeFields';
import { BODY_MAX, SUBJECT_MAX } from '../model';
import type { AudienceOption, Campaign, CampaignAudienceKind } from '../model';
import { useCampaign, useSendTest } from '../queries';
import { useFinalize } from '../useFinalize';
import { AttachmentsPanel } from './AttachmentsPanel';
import { AudienceFieldset } from './AudienceFieldset';
import { MergeFieldBar } from './MergeFieldBar';
import { Preview } from './Preview';
import { ScheduleDialog } from './ScheduleDialog';

export interface EditorFormProps {
  existing: Campaign | null;
  audiences: readonly AudienceOption[];
  onReload: () => void;
}

function LiveAttachments({ campaign }: { campaign: Campaign }) {
  const live = useCampaign(campaign.id);
  return <AttachmentsPanel campaignId={campaign.id} attachments={live.data?.attachments ?? campaign.attachments} editable />;
}

export function EditorForm({ existing, audiences, onReload }: EditorFormProps) {
  const { capabilities, navigate, routes, now, senderName } = useCampaignsConfig();
  const options = audiences.filter((option) => capabilities.audiences.includes(option.audience));
  const [current, setCurrent] = useState(existing);
  const [subject, setSubject] = useState(existing?.subject ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [audience, setAudience] = useState<CampaignAudienceKind>(existing?.audience ?? options[0]?.audience ?? 'tenants');
  const [buildingIds, setBuildingIds] = useState<string[]>(existing?.buildingIds ?? []);
  const [scope, setScope] = useState<BuildingScope>((existing?.buildingIds.length ?? 0) > 0 ? 'some' : 'all');
  const [copyToHistory, setCopyToHistory] = useState(existing?.copyToHistory ?? true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const test = useSendTest();

  const values: EditorValues = { subject, body, audience, buildingIds, copyToHistory, scope };
  const flow = useFinalize({
    current,
    setCurrent,
    draft: () => ({ subject: subject.trim(), body, audience, buildingIds: audience === 'tenants' ? buildingIds : [], copyToHistory }),
  });
  const selected = options.find((option) => option.audience === audience);
  const reach = selected ? reachOf(selected, buildingIds) : null;
  const locked = flow.busy || flow.saving;
  const testFeedback: CampaignTestFeedbackState = test.isSuccess
    ? { kind: 'success', to: test.data.sentTo }
    : test.isError
      ? { kind: 'error', message: campaignErrorMessage(test.error) }
      : null;

  const clear = (key: string) => { if (errors[key]) setErrors({ ...errors, [key]: undefined }); };
  const check = (strict: boolean): boolean => {
    const found = validateEditor(values, strict);
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const insertField = (field: string) => {
    const target = bodyRef.current;
    const token = mergeToken(field);
    const start = target?.selectionStart ?? body.length;
    const end = target?.selectionEnd ?? body.length;
    setBody(`${body.slice(0, start)}${token}${body.slice(end)}`);
    clear('body');
    requestAnimationFrame(() => {
      target?.focus();
      target?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const saveDraft = async () => {
    setNotice(null);
    if (!check(false)) return;
    const saved = await flow.save();
    if (saved) setNotice(saved.lockVersion === 1 ? 'Brouillon enregistré. Vous pouvez maintenant ajouter des pièces jointes.' : 'Brouillon enregistré.');
  };

  const requestTest = () => {
    setNotice(null);
    if (!check(true)) return;
    test.mutate({ subject: subject.trim(), body, audience });
  };

  const startSend = () => {
    setNotice(null);
    if (check(true)) setConfirming(true);
  };

  const startSchedule = () => {
    setNotice(null);
    if (check(true)) setScheduling(true);
  };

  const confirmSend = () => {
    void flow.finalize({ kind: 'send' }, () => { setConfirming(false); }).then(() => { setConfirming(false); });
  };

  const showFailure = flow.failure !== null && !scheduling;

  return (
    <form
      noValidate
      aria-label={current ? 'Modifier la campagne' : 'Nouvelle campagne'}
      className="flex max-w-3xl min-w-0 flex-col gap-4 rounded-lg border border-line bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <AudienceFieldset
        options={options}
        audience={audience}
        buildingIds={buildingIds}
        scope={scope}
        disabled={locked}
        error={errors.buildingIds}
        onAudienceChange={(next) => { setAudience(next); setBuildingIds([]); clear('buildingIds'); }}
        onBuildingsChange={(ids) => { setBuildingIds(ids); clear('buildingIds'); }}
        onScopeChange={setScope}
      />
      <div className="flex min-w-0 flex-col gap-0.5 rounded-md border border-line px-3 py-2">
        <span className="text-caption text-fg-subtle">Expéditeur</span>
        <span className="text-body font-medium text-fg">{senderName ?? 'Votre organisation'}</span>
        <span className="text-caption text-fg-muted">{`${NO_PROSPECTING_TEXT} ${PLAIN_TEXT_NOTICE}`}</span>
      </div>
      <TextField
        label="Objet *"
        placeholder="Ex. Coupure d’eau lundi 16 novembre"
        value={subject}
        maxLength={SUBJECT_MAX}
        disabled={locked}
        onChange={(event) => { setSubject(event.target.value); clear('subject'); }}
        {...(errors.subject ? { error: errors.subject } : {})}
      />
      <div className="flex flex-col gap-1.5">
        <Textarea
          ref={bodyRef}
          label="Message *"
          placeholder="Ex. Bonjour {{ Prénom }}, une coupure d’eau est prévue lundi de 9 h à 12 h."
          hint={`${String(body.length)} / ${String(BODY_MAX).replace(/\B(?=(\d{3})+$)/g, ' ')} caractères`}
          rows={8}
          value={body}
          disabled={locked}
          onChange={(event) => { setBody(event.target.value); clear('body'); }}
          {...(errors.body ? { error: errors.body } : {})}
        />
        <MergeFieldBar audience={audience} disabled={locked} onInsert={insertField} />
      </div>
      <Preview subject={subject} body={body} audience={audience} senderName={senderName} />
      {current ? (
        <LiveAttachments campaign={current} />
      ) : (
        <p className="text-caption text-fg-subtle">Enregistrez le brouillon pour ajouter des pièces jointes (PDF, 5 Mo au plus, 3 pièces).</p>
      )}
      <Checkbox
        label="Copier le message dans l’espace des destinataires qui ont un compte"
        checked={copyToHistory}
        disabled={locked}
        onChange={(event) => { setCopyToHistory(event.target.checked); }}
      />
      <CampaignTestFeedback state={testFeedback} />
      {notice ? <Alert tone="success" title={notice} /> : null}
      {showFailure && flow.failure ? (
        <Alert tone="danger" title="Action impossible">
          {flow.failure.message}
          {flow.failure.kind === 'versionConflict' ? (
            <Button variant="secondary" size="sm" className="mt-2" onClick={onReload}>
              Recharger la dernière version
            </Button>
          ) : null}
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" disabled={locked} onClick={() => { navigate(routes.list); }}>
            Annuler
          </Button>
          <CampaignTestButton pending={test.isPending} disabled={locked} onClick={requestTest} />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" loading={flow.saving} disabled={flow.busy} onClick={() => { void saveDraft(); }}>
            <Icon icon={Save} />
            Enregistrer le brouillon
          </Button>
          <Button variant="secondary" disabled={locked} onClick={startSchedule}>
            <Icon icon={CircleCheck} />
            Programmer l’envoi
          </Button>
          <Button loading={flow.busy} disabled={flow.saving} onClick={startSend}>
            <Icon icon={Send} />
            Envoyer
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Envoyer cette campagne ?"
        description={`${selected?.label ?? 'Les destinataires'} : ${reach ? reachLabel(reach) : 'destinataires'}. L’envoi est définitif et exige une double authentification récente.`}
        confirmLabel="Envoyer maintenant"
        loading={flow.busy}
        onConfirm={confirmSend}
      />
      <ScheduleDialog
        open={scheduling}
        loading={flow.busy}
        failure={scheduling ? (flow.failure?.message ?? null) : null}
        now={now}
        onClose={() => { setScheduling(false); flow.clearFailure(); }}
        onSubmit={(scheduledAt) => { void flow.finalize({ kind: 'schedule', scheduledAt }, () => { setScheduling(false); }); }}
      />
      {flow.proofDialog}
    </form>
  );
}
