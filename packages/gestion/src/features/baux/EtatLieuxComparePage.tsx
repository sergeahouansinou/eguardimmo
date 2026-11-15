'use client';

import { useState } from 'react';
import { Badge, SegmentedControl } from '@eguardimmo/ui';
import type { BadgeTone } from '@eguardimmo/ui';
import { countEvolutions, compareSurveys, findEntryFor } from './compareEdl';
import type { ComparedElement, Evolution } from './compareEdl';
import { useLeaseLookups } from './BauxParts';
import { useEdls } from './hooks';
import { bauxPaths } from './paths';
import { surveyStateLabel } from './schemas';
import { mergeSurvey } from './EdlSurvey';
import { LinkButton, ListLoading, LoadError, NotFoundPanel, PageHeader, SectionCard } from '../locataires/kit';
import { formatDateFr } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';

const evolutionLabel: Record<Evolution, string> = { identique: 'Identique', degradation: 'Dégradation', amelioration: 'Amélioration', non_releve: 'Non relevé' };
const evolutionTone: Record<Evolution, BadgeTone> = { identique: 'success', degradation: 'warning', amelioration: 'info', non_releve: 'neutral' };

type Filter = 'tous' | 'ecarts';

export function EtatLieuxComparePage({ id }: { id: string }) {
  const edls = useEdls();
  const lookups = useLeaseLookups();
  const [filter, setFilter] = useState<Filter>('ecarts');
  const crumbs = [{ label: 'Accueil', href: links.home }, { label: 'Baux', href: bauxPaths.list }, { label: 'États des lieux', href: bauxPaths.edls }];
  if (edls.isError) return (<><PageHeader crumbs={[...crumbs, { label: 'Comparaison' }]} title="Comparaison" /><LoadError title="Les états des lieux n’ont pas pu être chargés" /></>);
  if (!edls.data) return (<><PageHeader crumbs={[...crumbs, { label: 'Comparaison' }]} title="Comparaison" /><ListLoading label="Chargement de la comparaison" /></>);
  const exit = edls.data.find((entry) => entry.id === id);
  if (!exit) {
    return (
      <>
        <PageHeader crumbs={[...crumbs, { label: 'Introuvable' }]} title="État des lieux introuvable" />
        <NotFoundPanel title="Cet état des lieux n’existe pas" description="Il a peut-être été supprimé ou le lien est incorrect." backHref={bauxPaths.edls} backLabel="Retour aux états des lieux" />
      </>
    );
  }
  const entry = findEntryFor(exit, edls.data);
  const pageCrumbs = [...crumbs, { label: exit.reference, href: bauxPaths.edl(exit.id) }, { label: 'Comparaison' }];
  if (exit.type === 'entree' || !entry) {
    return (
      <>
        <PageHeader crumbs={pageCrumbs} title={`Comparer ${exit.reference} avec l’entrée`} />
        <NotFoundPanel
          title={exit.type === 'entree' ? 'Il n’y a rien à comparer' : 'Aucun état des lieux d’entrée trouvé'}
          description={exit.type === 'entree' ? 'Cet état des lieux est lui-même un état d’entrée.' : `Aucun état des lieux d’entrée n’existe pour ${lookups.unitLabel(exit.unitId)}.`}
          backHref={bauxPaths.edl(exit.id)}
          backLabel="Retour à l’état des lieux"
        />
      </>
    );
  }

  const rooms = compareSurveys(mergeSurvey(entry), mergeSurvey(exit));
  const counts = countEvolutions(rooms);
  const visible = rooms
    .map((room) => ({ ...room, elements: room.elements.filter((element) => filter === 'tous' || element.evolution === 'degradation' || element.evolution === 'amelioration') }))
    .filter((room) => room.elements.length > 0);

  return (
    <>
      <PageHeader
        crumbs={pageCrumbs}
        title={`Comparer ${exit.reference} avec l’entrée`}
        subtitle={`${lookups.unitLabel(exit.unitId)}, entrée ${entry.reference}${entry.date ? ` du ${formatDateFr(entry.date)}` : ''}`}
        actions={
          <>
            <LinkButton href={bauxPaths.edl(entry.id)}>{`Voir ${entry.reference}`}</LinkButton>
            <LinkButton href={bauxPaths.edl(exit.id)}>{`Voir ${exit.reference}`}</LinkButton>
          </>
        }
      />
      <section aria-label="Synthèse" className="flex flex-wrap items-center gap-2">
        <Badge tone={counts.degradation > 0 ? 'warning' : 'success'}>{`${String(counts.degradation)} dégradation${counts.degradation > 1 ? 's' : ''}`}</Badge>
        <Badge tone="info">{`${String(counts.amelioration)} amélioration${counts.amelioration > 1 ? 's' : ''}`}</Badge>
        <Badge tone="success">{`${String(counts.identique)} identique${counts.identique > 1 ? 's' : ''}`}</Badge>
        <Badge tone="neutral">{`${String(counts.non_releve)} non relevé${counts.non_releve > 1 ? 's' : ''}`}</Badge>
        <div className="ml-auto">
          <SegmentedControl
            label="Éléments affichés"
            value={filter}
            onValueChange={(value) => { setFilter(value === 'tous' ? 'tous' : 'ecarts'); }}
            options={[{ value: 'ecarts', label: 'Écarts' }, { value: 'tous', label: 'Tous les éléments' }]}
          />
        </div>
      </section>
      {visible.length === 0 ? (
        <NotFoundPanel title="Aucun écart relevé" description="Tous les éléments relevés sont identiques à l’état d’entrée." backHref={bauxPaths.edl(exit.id)} backLabel="Retour à l’état des lieux" />
      ) : (
        visible.map((room, index) => (
          <SectionCard key={room.room} id={`compare-${String(index)}`} title={room.room}>
            <ul>
              {room.elements.map((element) => (
                <ComparedRow key={element.id} element={element} />
              ))}
            </ul>
          </SectionCard>
        ))
      )}
    </>
  );
}

function ComparedRow({ element }: { element: ComparedElement }) {
  return (
    <li className="flex flex-col gap-1 border-t border-line py-2 first:border-t-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="min-w-32 text-body-strong text-fg">{element.label}</span>
        <Badge tone={evolutionTone[element.evolution]}>{evolutionLabel[element.evolution]}</Badge>
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-1 text-body text-fg-muted sm:grid-cols-2">
        <p className="min-w-0 [overflow-wrap:anywhere]"><span className="text-fg-subtle">Entrée : </span>{`${surveyStateLabel[element.entry.state]}${element.entry.note ? `, ${element.entry.note}` : ''}`}</p>
        <p className="min-w-0 [overflow-wrap:anywhere]"><span className="text-fg-subtle">Sortie : </span>{element.exit ? `${surveyStateLabel[element.exit.state]}${element.exit.note ? `, ${element.exit.note}` : ''}` : 'Non relevé'}</p>
      </div>
    </li>
  );
}
