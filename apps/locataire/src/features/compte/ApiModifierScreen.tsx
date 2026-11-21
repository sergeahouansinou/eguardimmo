'use client';

import { FailureAlert } from '@/components/FailureAlert';
import { PageHeader } from '@/components/PageHeader';
import { RouteTabs } from '@/components/RouteTabs';
import { Skeleton } from '@/components/ScreenState';
import { ACCOUNT_WORDING } from '@/tenant/accountLabels';
import { useProfile } from '@/tenant/accountQueries';
import { API_ACCOUNT_TABS } from './ApiAccountScreens';
import { ContactUpdatesCard } from './ContactUpdatesCard';
import { EmailChangeCard } from './EmailChangeCard';
import { NameCard, PhoneCard } from './IdentityCards';

export function ApiModifierScreen() {
  const profile = useProfile();
  return (
    <>
      <PageHeader
        title="Modifier mes informations"
        crumbs={[{ label: 'Mes informations', href: '/compte' }, { label: 'Modifier' }]}
        subtitle="Un changement d’adresse e-mail est confirmé par un code ; le téléphone et l’adresse demandent de confirmer votre identité."
      />
      <RouteTabs label="Mon compte" tabs={API_ACCOUNT_TABS} />
      {profile.data === undefined ? (
        profile.isError ? (
          <FailureAlert title="Vos informations n’ont pas pu être chargées" error={profile.error} wording={ACCOUNT_WORDING} onRetry={() => void profile.refetch()} />
        ) : (
          <Skeleton rows={2} />
        )
      ) : (
        <>
          <NameCard profile={profile.data} />
          <PhoneCard profile={profile.data} />
          <EmailChangeCard profile={profile.data} />
          <ContactUpdatesCard />
        </>
      )}
    </>
  );
}
