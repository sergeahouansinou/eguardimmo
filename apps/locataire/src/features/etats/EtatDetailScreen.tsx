'use client';

import { Button, Card, CardHeader, CardTitle, Dialog, DialogContent, Icon, StatCard } from '@eguardimmo/ui';
import { Download, ImageIcon } from 'lucide-react';
import { useState } from 'react';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { Async, NotFoundState } from '@/components/ScreenState';
import { SectionCard, TotalsList } from '@/components/Section';
import { StatusBadge } from '@/components/StatusBadge';
import { useInspections } from '@/data/queries';
import type { Inspection } from '@/data/schemas/logement';
import { formatDate, formatDateTime } from '@/lib/dates';
import { downloadDemoPdf } from '@/lib/demoPdf';

export function EtatDetailScreen({ inspectionId }: { inspectionId: string }) {
  const inspections = useInspections();
  return (
    <Async query={inspections} errorTitle="L’état des lieux n’a pas pu être chargé">
      {(items) => {
        const inspection = items.find((item) => item.id === inspectionId && item.status === 'signe');
        return inspection ? (
          <Detail inspection={inspection} />
        ) : (
          <NotFoundState title="État des lieux introuvable" backHref="/etats-des-lieux" backLabel="Revenir aux états des lieux" />
        );
      }}
    </Async>
  );
}

function Detail({ inspection }: { inspection: Inspection }) {
  const [gallery, setGallery] = useState(false);
  const date = inspection.date ? formatDate(inspection.date) : '—';
  const reserves = inspection.rooms.filter((room) => room.reserve).length;
  const title = inspection.kind === 'entree' ? "État des lieux d'entrée" : 'État des lieux de sortie';
  const photos = inspection.rooms.flatMap((room) => Array.from({ length: room.photos }, (_, index) => `${room.name}, photo ${String(index + 1)}`));
  return (
    <>
      <PageHeader
        title={title}
        crumbs={[{ label: 'États des lieux', href: '/etats-des-lieux' }, { label: `Entrée du ${date}` }]}
        badge={<StatusBadge tone="success">Signé</StatusBadge>}
        subtitle={`${date} · ${inspection.address}`}
        actions={
          <Button onClick={() => { downloadDemoPdf(`etat-des-lieux-${inspection.id}.pdf`, title, [inspection.address, date]); }}>
            <Icon icon={Download} />
            Télécharger le PDF
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pièces décrites" value={String(inspection.rooms.length)}>
          <span className="text-caption text-fg-subtle">{inspection.surfaceLabel}</span>
        </StatCard>
        <StatCard label="Photos" value={String(inspection.photosCount)}>
          <span className="text-caption text-fg-subtle">Jointes au document</span>
        </StatCard>
        <StatCard label="Réserves" value={String(reserves)}>
          <span className="text-caption text-fg-subtle">{inspection.reservesNote}</span>
        </StatCard>
        <StatCard label="Signé le" value={date}>
          <span className="text-caption text-fg-subtle">Par les deux parties</span>
        </StatCard>
      </div>
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <SectionCard id="ed-pieces" title="Pièces et observations">
            <DataTable
              label="Pièces et observations"
              rows={inspection.rooms}
              rowKey={(room) => room.name}
              columns={[
                { id: 'piece', header: 'Pièce', primary: true, cell: (room) => room.name },
                {
                  id: 'etat',
                  header: 'État',
                  cell: (room) => (
                    <StatusBadge tone={room.condition === 'bon_etat' ? 'success' : 'warning'}>
                      {room.condition === 'bon_etat' ? 'Bon état' : "État d'usage"}
                    </StatusBadge>
                  ),
                },
                { id: 'observations', header: 'Observations', cell: (room) => room.notes },
                { id: 'photos', header: 'Photos', numeric: true, cell: (room) => String(room.photos) },
              ]}
            />
          </SectionCard>
          <SectionCard
            id="ed-photos"
            title="Galerie photos"
            aside={
              <Button variant="link" size="sm" onClick={() => { setGallery(true); }}>
                Tout voir, {inspection.photosCount}
              </Button>
            }
          >
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {inspection.rooms.map((room) => (
                <PhotoTile key={room.name} label={room.name.replace(' et WC', '')} />
              ))}
            </ul>
          </SectionCard>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <Card role="region" aria-labelledby="ed-signatures" className="px-4 py-3">
            <CardHeader>
              <CardTitle as="h2" id="ed-signatures">Signatures</CardTitle>
            </CardHeader>
            {inspection.signatures.map((signature) => (
              <div key={signature.name} className="flex flex-col gap-1 rounded-md border border-line p-3">
                <span className="text-caption text-fg-subtle">Signature électronique</span>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <b className="text-body-strong">{signature.name}</b>
                    <br />
                    <span className="text-caption text-fg-subtle">{signature.role}</span>
                  </div>
                  <StatusBadge tone="success">Signé</StatusBadge>
                </div>
                <span className="text-caption text-fg-subtle">
                  Signé le {formatDateTime(signature.signedAt).replace(', ', ' à ')}
                </span>
              </div>
            ))}
          </Card>
          <Card role="region" aria-labelledby="ed-compteurs" className="px-4 py-3">
            <CardHeader>
              <CardTitle as="h2" id="ed-compteurs">Relevés des compteurs</CardTitle>
            </CardHeader>
            <TotalsList items={inspection.meters.map((meter) => ({ label: meter.label, value: meter.value, strong: true }))} />
          </Card>
        </div>
      </div>
      <Dialog open={gallery} onOpenChange={setGallery}>
        <DialogContent
          title={`Photos de l'état des lieux (${String(inspection.photosCount)})`}
          description="Aperçu de démonstration : les photos réelles sont jointes au PDF signé."
        >
          <ul className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto p-4 sm:grid-cols-3">
            {photos.map((label) => (
              <PhotoTile key={label} label={label} />
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PhotoTile({ label }: { label: string }) {
  return (
    <li className="flex aspect-[4/3] min-w-0 flex-col items-center justify-center gap-1 rounded-md border border-line bg-muted p-1 text-center text-fg-subtle">
      <Icon icon={ImageIcon} size={20} />
      <span className="max-w-full truncate text-caption">{label}</span>
    </li>
  );
}
