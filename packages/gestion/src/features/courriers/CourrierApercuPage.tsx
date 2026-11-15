'use client';

import { Button, Card, CardTitle, ConfirmDialog } from '@eguardimmo/ui';
import { useState } from 'react';
import { useLeaseLookups } from '../baux/BauxParts';
import { BAILLEUR, DocumentViewer, Paper, PaperHeader } from './DocumentViewer';
import { FormattedText } from './FormattedText';
import { RecordGate } from './RecordGate';
import { useCourriers, useMarkCourrierSent, useResendCourrier } from './hooks';
import { courriersPaths } from './paths';
import { channelLabel } from './schemas';
import type { Courrier } from './schemas';
import { LinkButton, PageHeader, errorMessage, useNotify } from '../locataires/kit';
import { formatDateFr, longDateFr } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';

const crumbs = [{ label: 'Accueil', href: links.home }, { label: 'Documents', href: courriersPaths.documents }, { label: 'Courriers', href: courriersPaths.courriers }];

export function CourrierApercuPage({ id }: { id: string }) {
  const courriers = useCourriers();
  return (
    <RecordGate
      query={courriers}
      find={(item) => item.id === id}
      crumbs={crumbs}
      title="Courrier"
      missing={{ title: 'Courrier introuvable', description: 'Il a peut-être été supprimé ou le lien est incorrect.', backHref: courriersPaths.courriers, backLabel: 'Retour aux courriers' }}
    >
      {(courrier) => <CourrierSheet courrier={courrier} />}
    </RecordGate>
  );
}

function CourrierSheet({ courrier }: { courrier: Courrier }) {
  const lookups = useLeaseLookups();
  const send = useMarkCourrierSent();
  const resend = useResendCourrier();
  const [resending, setResending] = useState(false);
  const notify = useNotify();
  const tenantName = lookups.tenantName(courrier.tenantId);

  const markSent = async () => {
    try {
      await send.mutateAsync(courrier.id);
      notify({ title: 'Courrier envoyé', description: `${courrier.reference}, ${tenantName}` });
    } catch (error) {
      notify({ tone: 'danger', title: 'Envoi impossible', description: errorMessage(error) });
    }
  };

  const resendNow = async () => {
    setResending(false);
    try {
      await resend.mutateAsync(courrier.id);
      notify({ title: 'Courrier renvoyé', description: `${courrier.reference}, ${tenantName}` });
    } catch (error) {
      notify({ tone: 'danger', title: 'Renvoi impossible', description: errorMessage(error) });
    }
  };

  const paragraphs = courrier.body.split(/\n{2,}/);
  return (
    <>
      <PageHeader
        crumbs={[...crumbs, { label: courrier.reference }]}
        title={courrier.subject}
        subtitle={`${courrier.reference}, ${channelLabel[courrier.channel]}, ${courrier.sentOn ? `envoyé le ${formatDateFr(courrier.sentOn)}` : 'pas encore envoyé'}`}
        actions={
          <>
            <LinkButton href={courriersPaths.courriers}>Retour aux courriers</LinkButton>
            {courrier.status === 'envoye' ? (
              <Button variant="secondary" disabled={courrier.archived} loading={resend.isPending} onClick={() => { setResending(true); }}>Renvoyer</Button>
            ) : (
              <Button loading={send.isPending} disabled={courrier.archived} onClick={() => { void markSent(); }}>Marquer comme envoyé</Button>
            )}
          </>
        }
      />
      {courrier.sendings.length > 0 ? (
        <Card role="region" aria-label="Historique des envois" className="gap-2">
          <CardTitle as="h2">Historique des envois</CardTitle>
          <ul className="flex flex-col">
            {courrier.sendings.map((sending, index) => (
              <li key={`${sending.on}-${String(index)}`} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-1 text-body first:border-t-0">
                <span>{`${sending.resend ? 'Renvoi' : 'Envoi'} du ${formatDateFr(sending.on)}`}</span>
                <span className="text-caption text-fg-subtle">{channelLabel[sending.channel]}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <DocumentViewer title={courrier.reference}>
        <Paper label={`Courrier ${courrier.reference}`}>
          <PaperHeader right={<span className="text-body text-fg-muted">{`Paris, le ${longDateFr(courrier.sentOn ?? courrier.createdOn)}`}</span>} />
          <div className="flex flex-col">
            <b className="text-body-strong">{tenantName}</b>
            <span className="text-body text-fg-muted">{lookups.unitLabel(courrier.unitId ?? '')}</span>
          </div>
          <p className="text-body-strong">{`Objet : ${courrier.subject}`}</p>
          <div className="flex flex-col gap-3">
            {paragraphs.map((paragraph, index) => (
              <p key={index} className="text-body whitespace-pre-line"><FormattedText text={paragraph} /></p>
            ))}
          </div>
          <footer className="mt-auto border-t border-line pt-3 text-caption text-fg-subtle">{`${BAILLEUR.name}, ${BAILLEUR.address}, ${BAILLEUR.city}`}</footer>
        </Paper>
      </DocumentViewer>
      <ConfirmDialog
        open={resending}
        onOpenChange={setResending}
        title="Renvoyer ce courrier ?"
        description={`« ${courrier.subject} » sera envoyé de nouveau à ${tenantName} (${channelLabel[courrier.channel]}). Le nouvel envoi sera daté et ajouté à l’historique.`}
        confirmLabel="Renvoyer le courrier"
        onConfirm={() => { void resendNow(); }}
      />
    </>
  );
}
