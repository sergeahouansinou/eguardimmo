'use client';

import { Alert, Badge, Button, Icon } from '@eguardimmo/ui';
import { Archive, ArchiveRestore, Eraser, Pencil } from 'lucide-react';
import { useState } from 'react';
import { DescriptionList, LinkButton, PageHeader, SectionCard, useNotify } from '../locataires/kit';
import { ActionError } from '../orgapi/ActionError';
import { ConfirmAction } from '../orgapi/ConfirmAction';
import { QueryState } from '../orgapi/QueryState';
import { ContactPointsSection } from './ContactPointsSection';
import { PropertyLinksSection } from './PropertyLinksSection';
import { useAnonymizeContact, useArchiveContact, useContact, useDirectoryPermissions, useReloadDirectory, useRestoreContact } from './hooks';
import { NOTE_HINT, kindLabel, languageText } from './labels';
import type { ContactDetail } from './model';
import { ContactBadges, DIRECTORY_CRUMBS, DirectoryGate } from './parts';
import { directoryPaths } from './paths';

const NOT_FOUND = { title: 'Contact introuvable', description: 'Ce contact n’existe pas ou n’est plus accessible.', backHref: directoryPaths.contacts, backLabel: 'Retour aux contacts' };

export function ContactDetailPage({ id }: { id: string }) {
  return (
    <DirectoryGate need="read" title="Contact">
      <ContactDetailContent id={id} />
    </DirectoryGate>
  );
}

function ContactDetailContent({ id }: { id: string }) {
  const contact = useContact(id);
  const reload = useReloadDirectory();
  if (contact.data === undefined) {
    return (
      <>
        <PageHeader crumbs={[...DIRECTORY_CRUMBS, { label: 'Contact' }]} title="Contact" />
        <QueryState query={contact} label="Chargement du contact" title="Impossible de charger le contact" notFound={NOT_FOUND} onRetry={reload} />
      </>
    );
  }
  return <ContactView contact={contact.data} />;
}

function ContactView({ contact }: { contact: ContactDetail }) {
  const permissions = useDirectoryPermissions();
  const archived = contact.archivedAt !== null;
  const editable = permissions.write && !contact.anonymized;
  return (
    <>
      <PageHeader
        crumbs={[...DIRECTORY_CRUMBS, { label: contact.displayName }]}
        title={contact.displayName}
        subtitle={kindLabel[contact.kind]}
        badges={<ContactBadges anonymized={contact.anonymized} archived={archived} account={contact.hasAccount} />}
        actions={editable ? <LinkButton href={directoryPaths.contactEdit(contact.id)} icon={Pencil}>Modifier</LinkButton> : undefined}
      />
      {contact.anonymized ? <Alert tone="info" title="Contact anonymisé">Les données personnelles de cette fiche ont été effacées. Elle reste liée à l’historique des biens.</Alert> : null}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <IdentitySection contact={contact} />
        <ContactPointsSection contact={contact} canEdit={editable} />
        <ClassificationSection contact={contact} />
        <NoteSection contact={contact} />
      </div>
      <PropertyLinksSection contactId={contact.id} canLink={permissions.link && !contact.anonymized && !archived} />
      {permissions.write || permissions.anonymize ? <LifecycleActions contact={contact} canArchive={permissions.write && !contact.anonymized} canAnonymize={permissions.anonymize && !contact.anonymized} /> : null}
    </>
  );
}

function IdentitySection({ contact }: { contact: ContactDetail }) {
  const address = contact.address;
  return (
    <SectionCard id="identity" title="Identité">
      <DescriptionList
        items={[
          { term: 'Type', detail: kindLabel[contact.kind] },
          ...(contact.kind === 'person'
            ? [
                { term: 'Nom', detail: contact.lastName ?? '—' },
                { term: 'Prénom', detail: contact.firstName ?? '—' },
              ]
            : [{ term: 'Raison sociale', detail: contact.companyName ?? '—' }]),
          { term: 'Langue', detail: languageText(contact.language) },
          { term: 'Adresse', detail: address ? [address.line1, address.line2, `${address.postalCode} ${address.city}`, address.country].filter((part) => part !== null && part !== '').join(', ') : '—' },
          ...(contact.identifiers.length > 0
            ? [{ term: 'Identifiants', detail: contact.identifiers.map((identifier) => `${identifier.scheme.toUpperCase()} ${identifier.country} ${identifier.value ?? `•••• ${identifier.last4 ?? ''}`}`).join(' · ') }]
            : []),
        ]}
      />
    </SectionCard>
  );
}

function ClassificationSection({ contact }: { contact: ContactDetail }) {
  return (
    <SectionCard id="classification" title="Catégories et étiquettes">
      {contact.categories.length === 0 && contact.tags.length === 0 ? <p className="text-body text-fg-subtle">Aucune catégorie ni étiquette.</p> : null}
      <ul aria-label="Catégories et étiquettes" className="flex flex-wrap gap-1.5">
        {contact.categories.map((category) => (
          <li key={category.id}><Badge tone="info">{category.label}</Badge></li>
        ))}
        {contact.tags.map((tag) => (
          <li key={tag.id}><Badge tone="neutral">{tag.name}</Badge></li>
        ))}
      </ul>
    </SectionCard>
  );
}

function NoteSection({ contact }: { contact: ContactDetail }) {
  return (
    <SectionCard id="note" title="Note">
      {contact.note === null ? <p className="text-body text-fg-subtle">Aucune note.</p> : <p className="whitespace-pre-wrap text-body text-fg [overflow-wrap:anywhere]">{contact.note}</p>}
      <p className="text-caption text-fg-subtle">{NOTE_HINT}</p>
    </SectionCard>
  );
}

type Pending = 'archive' | 'anonymize' | null;

function LifecycleActions({ contact, canArchive, canAnonymize }: { contact: ContactDetail; canArchive: boolean; canAnonymize: boolean }) {
  const [pending, setPending] = useState<Pending>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const archive = useArchiveContact();
  const restore = useRestoreContact();
  const anonymize = useAnonymizeContact();
  const notify = useNotify();
  const archived = contact.archivedAt !== null;

  const doRestore = async () => {
    setFailure(null);
    try {
      await restore.mutateAsync(contact.id);
      notify({ title: 'Contact restauré', description: contact.displayName });
    } catch (error) {
      setFailure(error);
    }
  };

  return (
    <SectionCard id="lifecycle" title="Archivage et effacement">
      <p className="text-body text-fg-muted">
        Un contact ne se supprime pas : on l’archive pour le retirer des listes et des choix, ou on efface ses données personnelles. Il n’existe pas de fusion de fiches.
      </p>
      {failure === null ? null : <ActionError title="Action impossible" error={failure} />}
      <div className="flex flex-wrap gap-2">
        {canArchive && !archived ? (
          <Button variant="secondary" onClick={() => { setPending('archive'); }}>
            <Icon icon={Archive} />
            Archiver le contact
          </Button>
        ) : null}
        {canArchive && archived ? (
          <Button variant="secondary" loading={restore.isPending} onClick={() => { void doRestore(); }}>
            <Icon icon={ArchiveRestore} />
            Restaurer le contact
          </Button>
        ) : null}
        {canAnonymize ? (
          <Button variant="danger" onClick={() => { setPending('anonymize'); }}>
            <Icon icon={Eraser} />
            Effacer les données personnelles
          </Button>
        ) : null}
      </div>
      <ConfirmAction
        open={pending === 'archive'}
        title="Archiver ce contact ?"
        description="Il disparaît des listes et des choix de formulaire. Ses liens avec les biens et l’historique sont conservés, et vous pourrez le restaurer."
        confirmLabel="Archiver"
        failureTitle="Contact non archivé"
        run={async () => {
          await archive.mutateAsync(contact.id);
          notify({ title: 'Contact archivé', description: contact.displayName });
        }}
        onClose={() => { setPending(null); }}
      />
      <ConfirmAction
        open={pending === 'anonymize'}
        title="Effacer les données personnelles ?"
        description="Le nom, les coordonnées, les identifiants et la note sont effacés définitivement. La fiche reste liée à l’historique des biens. Cette action est irréversible."
        confirmLabel="Effacer les données"
        tone="danger"
        failureTitle="Données non effacées"
        run={async () => {
          await anonymize.mutateAsync(contact.id);
          notify({ title: 'Données effacées' });
        }}
        onClose={() => { setPending(null); }}
      />
    </SectionCard>
  );
}
