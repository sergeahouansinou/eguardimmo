'use client';

import { Badge, Button, Icon, IconButton } from '@eguardimmo/ui';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { SectionCard } from '../locataires/kit';
import { ContactPointDialog } from './ContactPointDialog';
import { pointTypeLabel } from './labels';
import type { ContactDetail, ContactPoint } from './model';

export function ContactPointsSection({ contact, canEdit }: { contact: ContactDetail; canEdit: boolean }) {
  const [editing, setEditing] = useState<{ point: ContactPoint | null } | null>(null);
  return (
    <SectionCard
      id="contact-points"
      title="Coordonnées"
      aside={
        canEdit ? (
          <Button variant="secondary" size="sm" onClick={() => { setEditing({ point: null }); }}>
            <Icon icon={Plus} />
            Ajouter une coordonnée
          </Button>
        ) : null
      }
    >
      {contact.contactPoints.length === 0 ? (
        <p className="text-body text-fg-subtle">Aucune coordonnée enregistrée.</p>
      ) : (
        <ul className="flex flex-col">
          {contact.contactPoints.map((point) => (
            <li key={point.id} className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-t border-line py-1.5 first:border-t-0">
              <span className="flex min-w-0 flex-col">
                <span className="text-body text-fg [overflow-wrap:anywhere]">{point.value}</span>
                <span className="text-caption text-fg-subtle">{[pointTypeLabel[point.type], point.label].filter((part) => part !== null).join(' · ')}</span>
              </span>
              <span className="flex items-center gap-2">
                {point.primary ? <Badge tone="info">Principal</Badge> : null}
                {canEdit ? <IconButton label={`Modifier la coordonnée ${point.value}`} icon={Pencil} onClick={() => { setEditing({ point }); }} /> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
      <ContactPointDialog contactId={contact.id} point={editing?.point ?? null} open={editing !== null} onClose={() => { setEditing(null); }} />
    </SectionCard>
  );
}
