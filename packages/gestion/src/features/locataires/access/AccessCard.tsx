'use client';

import { Alert, Badge, Button, ConfirmDialog, Icon, TextField } from '@eguardimmo/ui';
import { Mail, UserX } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { ListLoading, LoadError, SectionCard, errorMessage, useNotify } from '../kit';
import { formatDateFr } from '../kit/dates';
import { useInviteTenant, useRevokeTenantAccess, useTenantAccess } from './hooks';
import { accessBadge } from './labels';
import type { TenantChoice } from './model';

const isEmail = (value: string): boolean => z.email().safeParse(value).success;

export function AccessCard({ tenant }: { tenant: TenantChoice }) {
  const access = useTenantAccess(tenant.id);
  const invite = useInviteTenant();
  const revoke = useRevokeTenantAccess();
  const notify = useNotify();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [confirming, setConfirming] = useState(false);

  const status = access.data?.status;

  const submit = async () => {
    const value = email.trim();
    if (value !== '' && !isEmail(value)) {
      setEmailError('Saisissez une adresse e-mail valide.');
      return;
    }
    setEmailError(undefined);
    try {
      const result = await invite.mutateAsync({ partyId: tenant.id, email: value === '' ? null : value });
      setEmail('');
      notify({ title: status === 'invited' ? 'Invitation renvoyée' : 'Invitation envoyée', description: `${tenant.name} recevra un lien${result.emailHint ? ` à ${result.emailHint}` : ''}.` });
    } catch (error) {
      notify({ tone: 'danger', title: 'Invitation impossible', description: errorMessage(error) });
    }
  };

  const confirmRevoke = async () => {
    setConfirming(false);
    try {
      await revoke.mutateAsync(tenant.id);
      notify({ title: 'Accès révoqué', description: `${tenant.name} n’a plus accès à l’espace locataire.` });
    } catch (error) {
      notify({ tone: 'danger', title: 'Révocation impossible', description: errorMessage(error) });
    }
  };

  return (
    <SectionCard id="acces-locataire" title={tenant.name} aside={access.data ? <Badge tone={accessBadge[access.data.status].tone}>{accessBadge[access.data.status].label}</Badge> : null}>
      {access.isError ? <LoadError title={access.error?.message ?? 'L’accès du locataire n’a pas pu être chargé'} /> : null}
      {access.isPending && !access.isError ? <ListLoading label="Chargement de l’accès du locataire" /> : null}
      {access.data ? (
        <>
          <p className="text-body text-fg-muted">
            {access.data.status === 'none' ? 'Ce contact n’a pas encore été invité à l’espace locataire.' : null}
            {access.data.status === 'invited' ? `Invitation envoyée${access.data.emailHint ? ` à ${access.data.emailHint}` : ''}, valable jusqu’au ${formatDateFr(access.data.expiresAt)}.` : null}
            {access.data.status === 'linked' ? `Compte rattaché${access.data.emailHint ? ` (${access.data.emailHint})` : ''}${access.data.linkedAt ? ` depuis le ${formatDateFr(access.data.linkedAt)}` : ''}.` : null}
          </p>
          {access.data.status === 'linked' ? null : (
            <form
              noValidate
              className="flex flex-col gap-2 sm:max-w-md"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <TextField
                label="Adresse e-mail à inviter"
                type="email"
                placeholder={tenant.email ?? 'prenom.nom@example.com'}
                value={email}
                error={emailError}
                hint={tenant.email ? 'Laissez vide pour utiliser l’e-mail principal du contact.' : 'Ce contact n’a pas d’e-mail principal : indiquez l’adresse à inviter.'}
                onChange={(event) => { setEmail(event.target.value); }}
              />
              <div>
                <Button type="submit" loading={invite.isPending}>
                  <Icon icon={Mail} />
                  {status === 'invited' ? 'Renvoyer l’invitation' : 'Inviter à l’espace locataire'}
                </Button>
              </div>
            </form>
          )}
          {access.data.status === 'none' ? null : (
            <div>
              <Button variant="secondary" loading={revoke.isPending} onClick={() => { setConfirming(true); }}>
                <Icon icon={UserX} />
                {status === 'linked' ? 'Révoquer l’accès' : 'Révoquer l’invitation'}
              </Button>
            </div>
          )}
          <Alert tone="info" title="Ce que fait l’invitation">
            Le locataire reçoit un lien par e-mail pour créer ou relier son compte. Le renvoi remplace l’invitation en attente.
          </Alert>
        </>
      ) : null}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={status === 'linked' ? 'Révoquer l’accès du locataire ?' : 'Révoquer l’invitation ?'}
        description={status === 'linked' ? `${tenant.name} perd l’accès à son espace locataire. L’historique de ses baux n’est pas modifié.` : `Le lien envoyé à ${tenant.name} ne fonctionnera plus.`}
        confirmLabel="Révoquer"
        tone="danger"
        loading={revoke.isPending}
        onConfirm={() => { void confirmRevoke(); }}
      />
    </SectionCard>
  );
}
