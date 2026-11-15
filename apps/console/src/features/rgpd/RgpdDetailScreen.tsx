'use client';

import { Alert, Badge, Button, Icon, Textarea } from '@eguardimmo/ui';
import { Check, Info, MessageSquare, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { errorMessage } from '@/console/hooks/core';
import { useAdvanceRgpd, useRequestClarification } from '@/console/hooks/mutations';
import { useRgpdRequest } from '@/console/hooks/queries';
import { RGPD_TYPE_LABELS, clarificationInputSchema } from '@/console/schemas';
import type { RgpdDetail, RgpdStep } from '@/console/schemas';
import { formatDate, formatDateTime, formatDayMonth, formatInteger } from '@/lib/format';
import { useZodForm } from '@/lib/useZodForm';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { FormDialog } from '@/ui/FormDialog';
import { PageHeader } from '@/ui/PageHeader';
import { QueryState } from '@/ui/QueryState';
import { EmptyLine, KeyValueList, ListRow, Section } from '@/ui/Section';
import { Timeline } from '@/ui/Timeline';
import { useNotify } from '@/ui/notify';
import { RgpdStateBadge, deadlineLabel } from './RgpdScreen';

const SHORT_LABELS = { acces: 'Accès', effacement: 'Effacement', rectification: 'Rectification' } as const;
const SCOPE_LABELS = { effacer: 'À effacer', conserver: 'À conserver', exporter: 'À exporter', corriger: 'À corriger' } as const;
const SCOPE_TONES = { effacer: 'danger', conserver: 'neutral', exporter: 'info', corriger: 'warning' } as const;

export function RgpdDetailScreen({ id }: { id: string }) {
  const query = useRgpdRequest(id);
  return (
    <QueryState
      query={query}
      label="La demande"
      notFound={{
        title: 'Demande introuvable',
        description: 'Cette demande n’existe pas dans le registre RGPD.',
        backHref: '/rgpd',
        backLabel: 'Retour au registre',
      }}
    >
      {(detail) => <DetailContent detail={detail} />}
    </QueryState>
  );
}

function DetailContent({ detail }: { detail: RgpdDetail }) {
  const { request } = detail;
  const notify = useNotify();
  const advance = useAdvanceRgpd(request.id);
  const clarify = useRequestClarification(request.id);
  const [stepOpen, setStepOpen] = useState(false);
  const [clarifyOpen, setClarifyOpen] = useState(false);
  const closed = request.state === 'cloturee';
  const next = detail.nextStep;
  const typeLabel = RGPD_TYPE_LABELS[request.type];
  const erasure = request.type === 'effacement';
  const counts = {
    effacer: detail.scope.filter((item) => item.action === 'effacer').length,
    conserver: detail.scope.filter((item) => item.action === 'conserver').length,
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        Link={Link}
        breadcrumb={[{ label: 'Conformité RGPD', href: '/rgpd' }, { label: `${SHORT_LABELS[request.type]}, ${request.requester}` }]}
        title={`${typeLabel}, ${request.requester}`}
        badges={
          <>
            <RgpdStateBadge state={request.state} />
            {closed ? null : <Badge tone="neutral">Échéance {formatDate(request.dueOn)}</Badge>}
          </>
        }
        subtitle={`Reçue le ${formatDate(request.receivedOn)} · ${request.organisationName} · profil ${detail.profile.toLowerCase()}`}
        actions={
          <>
            <Button variant="secondary" disabled={closed} onClick={() => { setClarifyOpen(true); }}>
              <Icon icon={MessageSquare} />
              Demander des précisions
            </Button>
            {next ? (
              <Button variant={next.strong ? 'danger' : 'primary'} onClick={() => { setStepOpen(true); }}>
                {next.actionLabel}
              </Button>
            ) : null}
          </>
        }
      />
      <ol aria-label="Étapes de la demande" className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:flex xl:flex-wrap">
        {detail.steps.map((step, index) => (
          <StepItem key={step.key} step={step} index={index} current={next?.key === step.key} />
        ))}
      </ol>
      {erasure && !closed ? (
        <Alert tone="warning" title="Une partie des données doit être conservée">
          <span className="flex items-start gap-2">
            <Icon icon={TriangleAlert} className="mt-0.5 shrink-0" />
            La réponse au demandeur indique ce qui est conservé, la durée et le motif légal.
          </span>
        </Alert>
      ) : null}
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label={erasure ? 'À effacer' : 'À traiter'} value={formatInteger(erasure ? counts.effacer : detail.scope.length)} caption={erasure ? `${String(counts.effacer)} modules concernés` : 'Jeux de données'} />
        <Stat label={erasure ? 'À conserver' : 'Délai légal'} value={erasure ? formatInteger(counts.conserver) : 'Un mois'} caption={erasure ? 'Obligations légales et preuve' : 'À compter de la réception'} />
        <Stat
          label="Délai restant"
          value={closed ? 'Clôturée' : request.daysLeft === null ? '—' : `${formatInteger(request.daysLeft)} jours`}
          caption={closed ? deadlineLabel(request) : `Échéance le ${formatDate(request.dueOn)}`}
        />
      </dl>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Section id="perimetre" title={erasure ? 'Périmètre de l’effacement' : 'Périmètre de la demande'} aside={<span className="text-caption text-fg-subtle">{`${String(detail.scope.length)} jeux de données`}</span>}>
          <ul>
            {detail.scope.map((item) => (
              <ListRow key={item.id} title={item.title} detail={item.detail} trailing={<Badge tone={SCOPE_TONES[item.action]}>{SCOPE_LABELS[item.action]}</Badge>} />
            ))}
          </ul>
        </Section>
        <div className="flex flex-col gap-4">
          <Section id="demandeur" title="Demandeur">
            <KeyValueList
              items={[
                { label: 'Personne', value: request.requester },
                { label: 'Compte', value: detail.email },
                { label: 'Profil', value: detail.profile },
                { label: 'Canal', value: detail.channel },
                { label: 'Reçue le', value: formatDate(request.receivedOn) },
              ]}
            />
          </Section>
          <Section id="chronologie" title="Chronologie">
            <Timeline entries={detail.timeline.map((entry) => ({ id: entry.id, time: formatDayMonth(entry.date), title: entry.title, detail: entry.detail }))} />
          </Section>
          <Section id="messages" title="Échanges avec le demandeur">
            {detail.messages.length === 0 ? (
              <EmptyLine>Aucun message envoyé.</EmptyLine>
            ) : (
              <ul>
                {detail.messages.map((message) => (
                  <ListRow key={message.id} icon={MessageSquare} tone="neutral" title={message.text} detail={formatDateTime(message.at)} />
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
      <Alert tone="info">
        <span className="flex items-start gap-2">
          <Icon icon={Info} className="mt-0.5 shrink-0" />
          {erasure
            ? 'L’exécution de l’effacement est un accès justifié : elle est consignée dans le journal d’audit et validée par un second opérateur.'
            : 'Chaque étape est consignée dans le journal d’audit avec votre nom.'}
        </span>
      </Alert>
      {next ? (
        <ConfirmDialog
          open={stepOpen}
          onOpenChange={setStepOpen}
          title={next.actionLabel}
          description={
            next.strong
              ? `${next.label} : l’action est irréversible et consignée comme accès justifié dans le journal d’audit.`
              : `${next.label} pour ${request.requester}. L’étape est consignée dans le journal d’audit.`
          }
          confirmLabel={next.actionLabel}
          tone={next.strong ? 'danger' : 'primary'}
          requiredPhrase={next.strong ? request.requester : undefined}
          phraseLabel="Nom du demandeur"
          onConfirm={async () => {
            await advance.mutateAsync(next.key);
            notify.success('Étape enregistrée', 'L’étape est consignée au journal d’audit.');
          }}
        />
      ) : null}
      <ClarificationDialog
        open={clarifyOpen}
        onOpenChange={setClarifyOpen}
        requester={request.requester}
        onSend={async (message) => {
          await clarify.mutateAsync({ message });
          notify.success('Message envoyé', `${request.requester} a reçu la demande de précisions.`);
        }}
      />
    </div>
  );
}

function Stat({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-line bg-surface px-4 py-3">
      <dt className="text-caption text-fg-subtle">{label}</dt>
      <dd className="text-[18px] leading-7 font-semibold">{value}</dd>
      <dd className="text-caption text-fg-subtle">{caption}</dd>
    </div>
  );
}

function StepItem({ step, index, current }: { step: RgpdStep; index: number; current: boolean }) {
  const done = step.doneOn !== null;
  return (
    <li
      aria-current={current ? 'step' : undefined}
      className={
        current
          ? 'flex min-h-9 items-center gap-2 rounded-md border border-action bg-action-subtle px-3 py-1.5 text-body-strong'
          : 'flex min-h-9 items-center gap-2 rounded-md border border-line bg-surface px-3 py-1.5 text-body text-fg-muted'
      }
    >
      <span
        aria-hidden="true"
        className={
          done
            ? 'flex size-5 items-center justify-center rounded-full bg-success text-success-fg'
            : 'flex size-5 items-center justify-center rounded-full bg-muted text-caption text-fg-subtle'
        }
      >
        {done ? <Icon icon={Check} size={14} /> : index + 1}
      </span>
      <span>{step.label}</span>
      <span className="sr-only">{done ? ', terminée' : current ? ', en cours' : ', à venir'}</span>
    </li>
  );
}

function ClarificationDialog({
  open,
  onOpenChange,
  requester,
  onSend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requester: string;
  onSend: (message: string) => Promise<void>;
}) {
  const form = useZodForm(clarificationInputSchema, { message: '' });
  const [failure, setFailure] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState } = form;
  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await onSend(values.message);
      reset();
      onOpenChange(false);
    } catch (error) {
      setFailure(errorMessage(error));
    }
  });
  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
          setFailure(null);
        }
        onOpenChange(next);
      }}
      title="Demander des précisions"
      description={`Le message est envoyé à ${requester}. Le délai légal continue de courir.`}
      submitLabel="Envoyer le message"
      pending={formState.isSubmitting}
      failure={failure}
      onSubmit={(event) => void submit(event)}
    >
      <Textarea
        label="Message au demandeur"
        placeholder="Merci de joindre une copie recto verso de votre pièce d’identité."
        rows={4}
        error={formState.errors.message?.message}
        {...register('message')}
      />
    </FormDialog>
  );
}
