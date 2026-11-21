'use client';

import { Button, Dialog, DialogClose, DialogContent } from '@eguardimmo/ui';
import { DescriptionList, useGestionNavigation } from '../locataires/kit';
import { QueryState } from '../orgapi/QueryState';
import { formatDateTimeFr } from '../orgapi/zone';
import { useActivityDetail, useActivityRetry } from './hooks';
import { actorText, subjectHref, subjectTypeLabel, typeBadge } from './labels';
import type { ActivityDetail } from './model';

export function ActivityDetailDialog({ id, timezone, onClose }: { id: string | null; timezone: string; onClose: () => void }) {
  return (
    <Dialog open={id !== null} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title="Détail de l’entrée" description="Ce que le journal a enregistré pour cette action." className="max-w-[560px]">
        {id === null ? null : <DetailBody id={id} timezone={timezone} />}
        <div className="flex justify-end p-4 pt-0">
          <DialogClose asChild>
            <Button variant="ghost">Fermer</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailBody({ id, timezone }: { id: string; timezone: string }) {
  const detail = useActivityDetail(id);
  const retry = useActivityRetry();
  if (detail.isPending || detail.isError || detail.data === undefined) {
    return (
      <div className="p-4">
        <QueryState query={detail} label="Chargement du détail" title="Impossible de charger le détail" onRetry={retry} />
      </div>
    );
  }
  return <DetailContent detail={detail.data} timezone={timezone} />;
}

function DetailContent({ detail, timezone }: { detail: ActivityDetail; timezone: string }) {
  const { Link } = useGestionNavigation();
  const href = detail.subject === null ? null : subjectHref(detail.subject);
  return (
    <div
      role="region"
      aria-label="Contenu du détail"
      // Zone défilante : le clavier doit pouvoir la focaliser pour la faire défiler.
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto p-4"
    >
      <DescriptionList
        termWidth="110px"
        items={[
          { term: 'Date', detail: formatDateTimeFr(detail.occurredAt, timezone) },
          { term: 'Libellé', detail: detail.label },
          { term: 'Type', detail: typeBadge[detail.type].label },
          { term: 'Action', detail: <code className="[overflow-wrap:anywhere]">{detail.action}</code> },
          { term: 'Auteur', detail: actorText(detail.actor) },
          {
            term: 'Élément',
            detail:
              detail.subject === null ? '—' : href === null ? subjectTypeLabel(detail.subject.type) : <Link href={href} className="text-action-on-subtle underline underline-offset-2">{`${subjectTypeLabel(detail.subject.type)} : ouvrir la fiche`}</Link>,
          },
          { term: 'Origine', detail: detail.ip ?? '—' },
          { term: 'Appareil', detail: detail.device ?? '—' },
          { term: 'Référence', detail: detail.reference ?? '—' },
        ]}
      />
      <section aria-labelledby="activity-changes" className="flex flex-col gap-1">
        <h3 id="activity-changes" className="text-body-strong text-fg">Modifications</h3>
        {detail.changes.length === 0 ? (
          <p className="m-0 text-body text-fg-subtle">Aucun différentiel enregistré pour cette action.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {detail.changes.map((change) => (
              <li key={change.field} className="text-body text-fg-muted [overflow-wrap:anywhere]">
                <span className="font-medium text-fg">{change.field}</span>
                {` : ${change.before} → ${change.after}`}
              </li>
            ))}
          </ul>
        )}
      </section>
      {detail.metadata.length === 0 ? null : (
        <section aria-labelledby="activity-metadata" className="flex flex-col gap-1">
          <h3 id="activity-metadata" className="text-body-strong text-fg">Informations complémentaires</h3>
          <DescriptionList termWidth="110px" items={detail.metadata.map((item) => ({ term: item.key, detail: item.value }))} />
        </section>
      )}
    </div>
  );
}
