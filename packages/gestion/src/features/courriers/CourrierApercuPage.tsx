'use client';

import { Button } from '@eguardimmo/ui';
import { useLeaseLookups } from '../baux/BauxParts';
import { BAILLEUR, DocumentViewer, Paper, PaperHeader } from './DocumentViewer';
import { RecordGate } from './RecordGate';
import { useCourriers, useMarkCourrierSent } from './hooks';
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
            {courrier.status === 'envoye' ? null : <Button loading={send.isPending} onClick={() => { void markSent(); }}>Marquer comme envoyé</Button>}
          </>
        }
      />
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
              <p key={index} className="text-body whitespace-pre-line">{paragraph}</p>
            ))}
          </div>
          <footer className="mt-auto border-t border-line pt-3 text-caption text-fg-subtle">{`${BAILLEUR.name}, ${BAILLEUR.address}, ${BAILLEUR.city}`}</footer>
        </Paper>
      </DocumentViewer>
    </>
  );
}
