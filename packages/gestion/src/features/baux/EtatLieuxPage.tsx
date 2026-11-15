'use client';

import { CircleCheck } from 'lucide-react';
import { Alert, Button } from '@eguardimmo/ui';
import { useLeaseLookups } from './BauxParts';
import { EdlStatusBadge } from './EdlParts';
import { useEdls, useEdlTemplates, useSetEdlStatus } from './hooks';
import { bauxPaths } from './paths';
import { edlTypeLabel } from './schemas';
import type { Edl } from './schemas';
import { DescriptionList, ItemRow, LinkButton, ListLoading, LoadError, NotFoundPanel, PageHeader, SectionCard, errorMessage, useNotify } from '../locataires/kit';
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
  const template = templates.data?.find((entry) => entry.id === edl.templateId);

  const markSigned = async () => {
    try {
      await sign.mutateAsync({ id: edl.id, status: 'signe' });
      notify({ title: 'État des lieux signé', description: edl.reference });
    } catch (error) {
      notify({ tone: 'danger', title: 'Signature impossible', description: errorMessage(error) });
    }
  };

  return (
    <>
      <PageHeader
        crumbs={[...crumbs, { label: edl.reference }]}
        title={`État des lieux ${edl.reference}`}
        badges={<EdlStatusBadge status={edl.status} />}
        subtitle={`${edlTypeLabel[edl.type]}, ${lookups.unitLabel(edl.unitId)}`}
        actions={
          edl.status === 'signe' || edl.archived ? null : (
            <>
              <LinkButton href={bauxPaths.editEdl(edl.id)}>Modifier</LinkButton>
              <Button loading={sign.isPending} onClick={() => { void markSigned(); }}>Marquer comme signé</Button>
            </>
          )
        }
      />
      {edl.archived ? <Alert tone="info" title="Cet état des lieux est archivé." /> : null}
      {edl.status === 'signe' ? <Alert tone="success" title="État des lieux signé par les deux parties." /> : null}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <SectionCard id="edl-infos" title="Informations">
          <DescriptionList
            termWidth="130px"
            items={[
              { term: 'Type', detail: edlTypeLabel[edl.type] },
              { term: 'Bien', detail: lookups.unitLabel(edl.unitId) },
              { term: 'Locataire', detail: edl.tenantId ? lookups.tenantName(edl.tenantId) : 'Non renseigné' },
              { term: 'Date', detail: edl.date ? formatDateFr(edl.date) : 'À planifier' },
              { term: 'Grille', detail: template?.label ?? edl.templateId },
              { term: 'Créé le', detail: formatDateFr(edl.createdOn) },
            ]}
          />
        </SectionCard>
        <SectionCard id="edl-pieces" title="Pièces contrôlées">
          <ul>
            {edl.rooms.map((room) => (
              <ItemRow key={room} icon={CircleCheck} title={room} detail="Relevé détaillé disponible lors de la visite" />
            ))}
          </ul>
        </SectionCard>
      </div>
    </>
  );
}
