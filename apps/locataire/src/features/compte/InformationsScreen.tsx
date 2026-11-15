'use client';

import { Alert, Avatar, Button, Icon } from '@eguardimmo/ui';
import { Download, Mail, Pencil } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { ACCOUNT_TABS, RouteTabs } from '@/components/RouteTabs';
import { Async3 } from '@/components/ScreenState';
import { KeyValueList, ListRow, SectionCard } from '@/components/Section';
import { StatusBadge } from '@/components/StatusBadge';
import { useLease, useMandate, useProfile, useRequestDataExport } from '@/data/queries';
import type { Lease } from '@/data/schemas/logement';
import type { Profile } from '@/data/schemas/compte';
import type { Mandate } from '@/data/schemas/loyers';
import { formatDate } from '@/lib/dates';
import { maskIban } from '@/lib/iban';

export function InformationsScreen() {
  const profile = useProfile();
  const lease = useLease();
  const mandate = useMandate();
  return (
    <>
      <PageHeader
        title="Mes informations"
        crumbs={[{ label: 'Mes informations' }]}
        subtitle="Votre identité, vos coordonnées et votre banque."
        actions={
          <Button asChild>
            <Link href="/compte/modifier">
              <Icon icon={Pencil} />
              Modifier
            </Link>
          </Button>
        }
      />
      <RouteTabs label="Mon compte" tabs={ACCOUNT_TABS} />
      <Async3 a={profile} b={lease} c={mandate} errorTitle="Vos informations n’ont pas pu être chargées">
        {(profileData, leaseData, mandateData) => <InformationsContent profile={profileData} lease={leaseData} mandate={mandateData} />}
      </Async3>
    </>
  );
}

function InformationsContent({ profile, lease, mandate }: { profile: Profile; lease: Lease; mandate: Mandate }) {
  const exportRequest = useRequestDataExport();
  const initials = `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`;
  const requested = profile.dataExportRequestedOn;
  const active = mandate.status === 'actif';
  return (
    <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
      <SectionCard id="mi-identite" title="Identité">
        <div className="flex items-center gap-3">
          <Avatar initials={initials} size="lg" />
          <div>
            <b className="text-body-strong">{profile.firstName} {profile.lastName}</b>
            <br />
            <span className="text-caption text-fg-subtle">Locataire depuis le {formatDate(profile.tenantSince)}</span>
          </div>
        </div>
        <KeyValueList
          labelWidth="6rem"
          items={[
            { label: 'Profession', value: profile.profession || '—' },
            { label: 'Logement', value: lease.property.label },
            { label: 'Bailleur', value: lease.landlord.name },
          ]}
        />
      </SectionCard>
      <SectionCard id="mi-coordonnees" title="Coordonnées">
        <KeyValueList
          labelWidth="6rem"
          items={[
            { label: 'Mobile', value: profile.mobile },
            { label: 'E-mail', value: profile.email },
            { label: 'Adresse', value: `${lease.property.unit}, ${lease.property.street}` },
            { label: 'Ville', value: `${lease.property.postalCode} ${lease.property.city}` },
          ]}
        />
      </SectionCard>
      <SectionCard id="mi-banque" title="Banque">
        <KeyValueList
          labelWidth="6rem"
          items={[
            { label: 'Titulaire', value: profile.bankHolder },
            { label: 'IBAN', value: profile.bankLast4 ? maskIban(profile.bankLast4) : 'Non renseigné' },
            { label: 'Prélèvement', value: active ? 'Activé' : 'Non activé' },
          ]}
        />
        <Button variant="secondary" size="sm" asChild className="self-start">
          <Link href="/loyers/prelevement">{active ? 'Gérer le prélèvement SEPA' : 'Activer le prélèvement SEPA'}</Link>
        </Button>
        {active ? <StatusBadge tone="success">Mandat actif</StatusBadge> : null}
      </SectionCard>
      <SectionCard id="mi-donnees" title="Mes données personnelles">
        <ul>
          <ListRow
            icon={Download}
            title="Exporter mes données"
            detail={requested ? `Demande du ${formatDate(requested)} : archive envoyée à ${profile.email}` : 'Archive de vos informations et documents'}
            trailing={
              <Button
                variant="link"
                size="sm"
                disabled={requested !== null}
                loading={exportRequest.isPending}
                onClick={() => { exportRequest.mutate(); }}
              >
                {requested ? 'Demandé' : 'Exporter'}
              </Button>
            }
          />
          <ListRow
            icon={Mail}
            title="Droits d'accès et de rectification"
            detail="Demande au gestionnaire de vos données"
            trailing={
              <Button variant="link" size="sm" asChild>
                <Link href="/messages/nouveau">Écrire</Link>
              </Button>
            }
          />
        </ul>
        {exportRequest.isError ? (
          <Alert tone="danger" title="La demande d’export n’a pas pu être enregistrée">
            {exportRequest.error.message}
          </Alert>
        ) : null}
        {exportRequest.isSuccess ? (
          <Alert tone="success" title="Demande d’export enregistrée">
            Vous recevrez l’archive par e-mail sous 48 h.
          </Alert>
        ) : null}
      </SectionCard>
    </div>
  );
}
