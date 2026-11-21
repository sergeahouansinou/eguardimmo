'use client';

import { Alert, Button, EmptyState } from '@eguardimmo/ui';
import { Building2, Link2Off } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FailureAlert } from '@/components/FailureAlert';
import { PageHeader } from '@/components/PageHeader';
import { Skeleton } from '@/components/ScreenState';
import { ListRow, SectionCard } from '@/components/Section';
import { useFlash } from '@/components/flash';
import { describeFailure } from '@/tenant/errors';
import { NOT_AVAILABLE } from '@/tenant/format';
import type { TenantLink } from '@/tenant/model';
import { useLinks, useRevokeLink } from '@/tenant/queries';

const ALREADY_REVOKED = 'Cet accès a déjà été retiré. La liste est mise à jour.';

export function LinksScreen() {
  const links = useLinks();
  const revoke = useRevokeLink();
  const showFlash = useFlash((store) => store.show);
  const pathname = usePathname();
  const [target, setTarget] = useState<TenantLink | null>(null);

  if (links.data === undefined) {
    return links.isError ? (
      <FailureAlert title="Vos accès n’ont pas pu être chargés" error={links.error} onRetry={() => void links.refetch()} />
    ) : (
      <Skeleton rows={2} />
    );
  }

  const close = (open: boolean) => {
    if (open) return;
    setTarget(null);
    revoke.reset();
  };
  const confirm = () => {
    if (target === null) return;
    const name = target.organization.name ?? NOT_AVAILABLE;
    revoke.mutate(target.partyId, {
      onSuccess: () => {
        setTarget(null);
        showFlash({ tone: 'success', title: 'Accès retiré', detail: `Votre compte n’est plus relié à ${name}.`, path: pathname });
      },
    });
  };
  const error = revoke.error === null ? undefined : describeFailure(revoke.error, { notFound: ALREADY_REVOKED }).message;

  return (
    <>
      <PageHeader
        title="Mes accès"
        crumbs={[{ label: 'Mon logement' }, { label: 'Mes accès' }]}
        subtitle="Les organisations dont vous êtes le locataire et qui ont relié votre compte à votre fiche."
      />
      <Alert tone="info" title="Comment obtenir un accès ?">
        Un accès est créé quand vous acceptez l’invitation envoyée par votre agence ou votre bailleur. Pour en retrouver un après l’avoir retiré,
        demandez-leur de vous inviter de nouveau.
      </Alert>
      <SectionCard id="acces-liste" title="Organisations reliées à mon compte">
        {links.data.length === 0 ? (
          <EmptyState icon={Link2Off} title="Aucun accès" description="Votre compte n’est relié à aucune organisation." />
        ) : (
          <ul>
            {links.data.map((link) => {
              const name = link.organization.name ?? NOT_AVAILABLE;
              return (
                <ListRow
                  key={link.partyId}
                  icon={Building2}
                  title={name}
                  detail="Accès à vos baux et à leurs conditions"
                  trailing={
                    <Button variant="secondary" size="sm" aria-label={`Retirer mon accès à ${name}`} onClick={() => { setTarget(link); }}>
                      Retirer
                    </Button>
                  }
                />
              );
            })}
          </ul>
        )}
      </SectionCard>
      <ConfirmDialog
        open={target !== null}
        onOpenChange={close}
        title={`Retirer votre accès à ${target?.organization.name ?? NOT_AVAILABLE} ?`}
        description="Vous ne verrez plus vos baux de cette organisation dans votre espace. Elle conserve vos baux et leurs pièces, et devra vous inviter de nouveau pour que vous retrouviez l’accès. L’action est immédiate."
        confirmLabel="Retirer mon accès"
        loading={revoke.isPending}
        onConfirm={confirm}
        error={error}
      />
    </>
  );
}
