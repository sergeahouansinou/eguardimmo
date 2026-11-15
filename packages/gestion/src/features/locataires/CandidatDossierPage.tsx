'use client';

import { Badge, Button, Card, CardTitle } from '@eguardimmo/ui';
import { candidateStatusBadge, useCandidateActions } from './useCandidateActions';
import { useCandidates, useUnits } from './hooks';
import { DescriptionList, LinkButton, ListLoading, LoadError, NotFoundPanel, PageHeader } from './kit';
import { formatDateFr } from './kit/dates';
import { money } from './kit/money';
import { locatairesPaths } from './paths';
import { unitFullLabel } from './schemas';

export function CandidatDossierPage({ id }: { id: string }) {
  const candidates = useCandidates();
  const units = useUnits();
  const { actionsFor, dialogs } = useCandidateActions();
  const candidate = candidates.data?.find((entry) => entry.id === id);

  if (candidates.isError) return <LoadError title="Le dossier n’a pas pu être chargé" />;
  if (!candidates.data) return <ListLoading label="Chargement du dossier" />;
  if (!candidate) {
    return (
      <>
        <PageHeader crumbs={[{ label: 'Candidats', href: locatairesPaths.candidates }, { label: 'Introuvable' }]} title="Candidat introuvable" />
        <NotFoundPanel title="Ce candidat n’existe pas" description="Le lien est incorrect ou le dossier a été retiré." backHref={locatairesPaths.candidates} backLabel="Retour aux candidats" />
      </>
    );
  }
  const unit = units.data?.find((entry) => entry.id === candidate.unitId);
  const badge = candidateStatusBadge[candidate.status];
  const name = `${candidate.firstName} ${candidate.lastName}`;

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Candidats', href: locatairesPaths.candidates }, { label: name }]}
        title={name}
        badges={<Badge tone={badge.tone}>{badge.label}</Badge>}
        subtitle={`Dossier reçu le ${formatDateFr(candidate.receivedOn)}`}
        actions={
          <>
            {actionsFor(candidate, false)
              .filter((action) => action.id !== 'message' && !action.disabled)
              .map((action) => (
                <Button key={action.id} variant={action.tone === 'danger' ? 'danger' : 'secondary'} onClick={action.onSelect}>
                  {action.label}
                </Button>
              ))}
            <LinkButton href={locatairesPaths.candidates}>Retour</LinkButton>
          </>
        }
      />
      <Card role="group" aria-labelledby="cd-infos" className="gap-3">
        <CardTitle as="h2" id="cd-infos">Dossier de candidature</CardTitle>
        <DescriptionList
          termWidth="160px"
          items={[
            { term: 'Bien concerné', detail: unit ? unitFullLabel(unit) : candidate.unitId },
            { term: 'Téléphone', detail: candidate.phone || '—' },
            { term: 'E-mail', detail: candidate.email },
            { term: 'Revenus mensuels', detail: candidate.monthlyIncome > 0 ? money(candidate.monthlyIncome) : 'Non renseignés' },
            { term: 'Pièces demandées', detail: candidate.requestedDocuments.join(', ') || '—' },
            { term: 'Message', detail: candidate.message || '—' },
          ]}
        />
      </Card>
      {dialogs}
    </>
  );
}
