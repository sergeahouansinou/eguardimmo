'use client';

import { LogOut, PenLine, Printer } from 'lucide-react';
import { useEffect } from 'react';
import { Alert, Badge, Button, IconButton, ProgressBar, Tab, TabList, TabPanel, Tabs } from '@eguardimmo/ui';
import { useLeaseLookups } from './BauxParts';
import { EdlStatusBadge } from './EdlParts';
import { EdlSurveyEditor, SurveyReadOnly, mergeSurvey } from './EdlSurvey';
import { useEdls, useEdlTemplates, useSetEdlStatus } from './hooks';
import { useEdlActions } from './useEdlActions';
import { bauxPaths } from './paths';
import { edlTypeLabel, surveyStateLabel } from './schemas';
import type { Edl } from './schemas';
import { DocumentViewer, Paper, PaperHeader } from '../courriers/DocumentViewer';
import { LinkButton, ListLoading, LoadError, NotFoundPanel, PageHeader, SectionCard, errorMessage, useGestionNavigation, useNotify } from '../locataires/kit';
import { formatDateFr } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';

export function EtatLieuxPage({ id }: { id: string }) {
  const edls = useEdls();
  const crumbs = [{ label: 'Accueil', href: links.home }, { label: 'Baux', href: bauxPaths.list }, { label: 'États des lieux', href: bauxPaths.edls }];
  if (edls.isError) return (<><PageHeader crumbs={[...crumbs, { label: 'Détail' }]} title="État des lieux" /><LoadError title="L’état des lieux n’a pas pu être chargé" /></>);
  if (!edls.data) return (<><PageHeader crumbs={[...crumbs, { label: 'Détail' }]} title="État des lieux" /><ListLoading label="Chargement de l’état des lieux" /></>);
  const edl = edls.data.find((entry) => entry.id === id);
  if (!edl) {
    return (
      <>
        <PageHeader crumbs={[...crumbs, { label: 'Introuvable' }]} title="État des lieux introuvable" />
        <NotFoundPanel title="Cet état des lieux n’existe pas" description="Il a peut-être été supprimé ou le lien est incorrect." backHref={bauxPaths.edls} backLabel="Retour aux états des lieux" />
      </>
    );
  }
  return <EdlSheet edl={edl} crumbs={crumbs} />;
}

function EdlSheet({ edl, crumbs }: { edl: Edl; crumbs: { label: string; href: string }[] }) {
  const lookups = useLeaseLookups();
  const templates = useEdlTemplates();
  const sign = useSetEdlStatus();
  const notify = useNotify();
  const { search } = useGestionNavigation();
  const { sendForSignature, prepareExitState, signaturePending, preparePending } = useEdlActions();
  const editable = edl.status !== 'signe' && !edl.archived;
  const printRequested = search.get('imprimer') === '1';
  useEffect(() => {
    if (printRequested) window.print();
  }, [printRequested]);
  const survey = mergeSurvey(edl);
  const template = templates.data?.find((entry) => entry.id === edl.templateId);

  const markSigned = async () => {
    try {
      await sign.mutateAsync({ id: edl.id, status: 'signe' });
      notify({ title: 'État des lieux signé', description: edl.reference });
    } catch (error) {
      notify({ tone: 'danger', title: 'Signature impossible', description: errorMessage(error) });
    }
  };

  const facts = [
    { term: 'Type', detail: edlTypeLabel[edl.type] },
    { term: 'Bien', detail: lookups.unitLabel(edl.unitId) },
    { term: 'Locataire', detail: edl.tenantId ? lookups.tenantName(edl.tenantId) : 'Non renseigné' },
    { term: 'Date', detail: edl.date ? formatDateFr(edl.date) : 'À planifier' },
    { term: 'Grille', detail: template?.label ?? edl.templateId },
    { term: 'Créé le', detail: formatDateFr(edl.createdOn) },
  ];
  const totalElements = survey.reduce((sum, room) => sum + room.elements.length, 0);
  const controlled = survey.reduce((sum, room) => sum + room.elements.filter((element) => element.state !== 'non_controle').length, 0);
  const anomalies = survey.flatMap((room) => room.elements.filter((element) => element.state === 'degrade' || element.state === 'absent').map((element) => ({ room: room.room, element })));

  return (
    <>
      <PageHeader
        crumbs={[...crumbs, { label: edl.reference }]}
        title={`État des lieux ${edl.reference}`}
        badges={<EdlStatusBadge status={edl.status} />}
        subtitle={`${edlTypeLabel[edl.type]}, ${lookups.unitLabel(edl.unitId)}`}
        actions={
          <>
            <IconButton variant="secondary" label="Télécharger le PDF" icon={Printer} onClick={() => { window.print(); }} />
            {edl.type !== 'entree' ? <LinkButton href={bauxPaths.compareEdl(edl.id)}>Comparer avec l’entrée</LinkButton> : null}
            {edl.type === 'entree' && !edl.archived ? (
              <Button variant="secondary" loading={preparePending} onClick={() => { void prepareExitState(edl); }}>
                <LogOut size={14} aria-hidden="true" />
                Préparer l’état de sortie
              </Button>
            ) : null}
            {editable ? (
              <>
                <LinkButton href={bauxPaths.editEdl(edl.id)}>Modifier</LinkButton>
                <Button variant="secondary" loading={signaturePending} onClick={() => { void sendForSignature(edl); }}>
                  <PenLine size={14} aria-hidden="true" />
                  Envoyer pour signature
                </Button>
                <Button loading={sign.isPending} onClick={() => { void markSigned(); }}>Marquer comme signé</Button>
              </>
            ) : null}
          </>
        }
      />
      {edl.archived ? <Alert tone="info" title="Cet état des lieux est archivé." /> : null}
      {edl.status === 'signe' ? <Alert tone="success" title="État des lieux signé par les deux parties." /> : null}
      <section aria-labelledby="edl-infos" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        <h2 id="edl-infos" className="sr-only">Informations</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3 xl:grid-cols-6">
          {facts.map((fact) => (
            <div key={fact.term} className="min-w-0">
              <dt className="text-caption text-fg-subtle">{fact.term}</dt>
              <dd className="truncate text-body-strong text-fg" title={fact.detail}>{fact.detail}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="edl-pieces" className="text-block-title text-fg">Synthèse du relevé</h2>
            <Badge tone={anomalies.length > 0 ? 'warning' : 'info'}>{`${String(controlled)} éléments contrôlés`}</Badge>
          </div>
          <ProgressBar value={totalElements === 0 ? 0 : (controlled / totalElements) * 100} label={`${String(controlled)} éléments contrôlés sur ${String(totalElements)}`} />
          {anomalies.length === 0 ? (
            <p className="text-body text-fg-muted">{controlled === 0 ? 'Aucun élément relevé pour le moment. Renseignez le relevé ci-dessous.' : 'Aucune anomalie relevée.'}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {anomalies.map(({ room, element }) => (
                <li key={`${room}-${element.id}`} className="text-body text-fg-muted">{`${room}, ${element.label} : ${surveyStateLabel[element.state].toLowerCase()}${element.note ? `, ${element.note}` : ''}`}</li>
              ))}
            </ul>
          )}
        </div>
      </section>
      <Tabs defaultValue="releve">
        <TabList aria-label="Sections de l’état des lieux">
          <Tab value="releve">Relevé</Tab>
          <Tab value="apercu">Aperçu du document</Tab>
        </TabList>
        <TabPanel value="releve" keepMounted>
          {editable ? (
            <EdlSurveyEditor edl={edl} />
          ) : (
            <SectionCard id="edl-releve" title="Relevé pièce par pièce">
              <SurveyReadOnly survey={survey} />
            </SectionCard>
          )}
        </TabPanel>
        <TabPanel value="apercu" keepMounted className="print:block">
      <section aria-label="Aperçu du document" id="apercu">
        <DocumentViewer title={edl.reference}>
          <Paper label={`État des lieux ${edl.reference}`}>
            <PaperHeader right={<><b className="text-block-title">{`État des lieux ${edlTypeLabel[edl.type].toLowerCase()}`}</b><span className="text-body text-fg-muted">{`N° ${edl.reference}`}</span></>} />
            <p className="text-body">{`${lookups.unitLabel(edl.unitId)}${edl.tenantId ? `, locataire ${lookups.tenantName(edl.tenantId)}` : ''}${edl.date ? `, le ${formatDateFr(edl.date)}` : ''}.`}</p>
            {survey.map((room) => (
              <div key={room.room} className="flex flex-col">
                <b className="text-body-strong">{room.room}</b>
                {room.elements.map((element) => (
                  <span key={element.id} className="flex justify-between gap-3 border-t border-line py-0.5 text-caption">
                    <span>{element.label}</span>
                    <span>{`${surveyStateLabel[element.state]}${element.note ? `, ${element.note}` : ''}`}</span>
                  </span>
                ))}
              </div>
            ))}
            <div className="mt-auto grid grid-cols-2 gap-6 pt-6">
              <div className="flex flex-col gap-8"><span className="text-body-strong">Le bailleur</span><span aria-hidden="true" className="h-px bg-line-strong" /></div>
              <div className="flex flex-col gap-8"><span className="text-body-strong">Le locataire</span><span aria-hidden="true" className="h-px bg-line-strong" /></div>
            </div>
          </Paper>
        </DocumentViewer>
      </section>
        </TabPanel>
      </Tabs>
    </>
  );
}
