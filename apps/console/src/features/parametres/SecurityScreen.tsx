'use client';

import { Alert, Badge, Button, Icon, Switch, TextField, Textarea } from '@eguardimmo/ui';
import { Info, KeyRound, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { errorMessage } from '@/console/hooks/core';
import { useRegenerateBackupCodes, useSaveSecuritySettings } from '@/console/hooks/mutations';
import { useSecuritySettings } from '@/console/hooks/queries';
import { securitySettingsInputSchema } from '@/console/schemas';
import type { SecuritySettings } from '@/console/schemas';
import { formatDate, plural } from '@/lib/format';
import { wholeNumber } from '@/lib/formFields';
import { useZodForm } from '@/lib/useZodForm';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { QueryState } from '@/ui/QueryState';
import { ListRow, Section } from '@/ui/Section';
import { useNotify } from '@/ui/notify';
import { LastChange } from './LastChange';
import { SaveBar } from './SaveBar';

const securityFormSchema = z.object({
  hardwareKeys: z.boolean(),
  ipAllowlistEnabled: z.boolean(),
  ipAllowlist: z.string(),
  idleMinutes: wholeNumber('Inactivité', 5, 240),
  maxSessionHours: wholeNumber('Durée de session', 1, 24),
  justifiedAccessMinutes: wholeNumber('Accès justifié', 5, 120),
  lockoutFailures: wholeNumber('Échecs', 3, 10),
  lockoutMinutes: wholeNumber('Verrouillage', 5, 240),
});

function valuesOf(settings: SecuritySettings) {
  return {
    hardwareKeys: settings.hardwareKeys,
    ipAllowlistEnabled: settings.ipAllowlistEnabled,
    ipAllowlist: settings.ipAllowlist.join('\n'),
    idleMinutes: String(settings.idleMinutes),
    maxSessionHours: String(settings.maxSessionHours),
    justifiedAccessMinutes: String(settings.justifiedAccessMinutes),
    lockoutFailures: String(settings.lockoutFailures),
    lockoutMinutes: String(settings.lockoutMinutes),
  };
}

export function SecurityScreen() {
  const query = useSecuritySettings();
  return (
    <QueryState query={query} label="Les paramètres de sécurité">
      {(settings) => <SecurityForm settings={settings} />}
    </QueryState>
  );
}

function SecurityForm({ settings }: { settings: SecuritySettings }) {
  const notify = useNotify();
  const save = useSaveSecuritySettings();
  const regenerate = useRegenerateBackupCodes();
  const [failure, setFailure] = useState<string | null>(null);
  const [codesOpen, setCodesOpen] = useState(false);
  const form = useZodForm(securityFormSchema, valuesOf(settings));
  const { register, handleSubmit, reset, setValue, watch, setError, formState } = form;
  useEffect(() => {
    reset(valuesOf(settings));
  }, [settings, reset]);
  const hardwareKeys = watch('hardwareKeys');
  const allowlistEnabled = watch('ipAllowlistEnabled');

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    const parsed = securitySettingsInputSchema.safeParse({
      adminTwoFactor: settings.adminTwoFactor,
      hardwareKeys: values.hardwareKeys,
      ipAllowlistEnabled: values.ipAllowlistEnabled,
      ipAllowlist: values.ipAllowlist
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== ''),
      idleMinutes: values.idleMinutes,
      maxSessionHours: values.maxSessionHours,
      justifiedAccessMinutes: values.justifiedAccessMinutes,
      lockoutFailures: values.lockoutFailures,
      lockoutMinutes: values.lockoutMinutes,
    });
    if (!parsed.success) {
      setError('ipAllowlist', { message: parsed.error.issues[0]?.message ?? 'Adresses invalides.' });
      return;
    }
    try {
      await save.mutateAsync(parsed.data);
      notify.success('Sécurité enregistrée', 'Le changement est consigné au journal d’audit.');
    } catch (error) {
      setFailure(errorMessage(error));
    }
  });

  return (
    <>
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <Section
          id="identifiants"
          title="Mes identifiants"
          aside={
            <Button variant="secondary" size="sm" asChild>
              <Link href="/parametres/informations">Gérer dans Mon compte</Link>
            </Button>
          }
        >
          <ul>
            <ListRow
              icon={KeyRound}
              title="Mot de passe"
              detail={`Modifié le ${formatDate(settings.me.passwordChangedOn)}`}
              trailing={<Badge tone="success">Forte</Badge>}
            />
            <ListRow
              icon={ShieldCheck}
              title="Double authentification"
              detail={`${settings.me.method} · ${plural(settings.me.backupCodesLeft, 'code de secours', 'codes de secours')}`}
              trailing={
                <>
                  <Badge tone="success">Activée</Badge>
                  <Button variant="secondary" size="sm" onClick={() => { setCodesOpen(true); }}>
                    Régénérer les codes
                  </Button>
                </>
              }
            />
          </ul>
          <p className="pt-2 text-caption text-fg-subtle">
            Vos identifiants personnels se gèrent dans Mon compte. Les règles ci-dessous s’appliquent à tous les opérateurs.
          </p>
        </Section>
        <Section id="double-auth" title="Double authentification">
          <ul>
            <ListRow
              title="Obligatoire pour les opérateurs"
              detail="Application d’authentification ou clé de sécurité"
              trailing={<Badge tone="info">Imposée</Badge>}
            />
            <ListRow
              title="Obligatoire pour les administrateurs d’organisation"
              detail="Appliquée à la prochaine connexion"
              trailing={<Badge tone={settings.adminTwoFactor ? 'info' : 'neutral'}>{settings.adminTwoFactor ? 'Imposée' : 'Facultative'}</Badge>}
            />
            <ListRow
              title="Clés de sécurité matérielles autorisées"
              detail="En plus de l’application d’authentification"
              trailing={
                <Switch
                  label="Clés de sécurité matérielles autorisées"
                  hideLabel
                  checked={hardwareKeys}
                  onCheckedChange={(next) => { setValue('hardwareKeys', next, { shouldDirty: true }); }}
                />
              }
            />
          </ul>
        </Section>
        <Section id="liste-blanche" title="Liste blanche d’adresses IP">
          <div className="flex flex-col gap-3 pt-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-body">Restreindre la connexion à ces adresses</span>
              <Switch
                label="Activer la liste blanche d’adresses IP"
                hideLabel
                checked={allowlistEnabled}
                onCheckedChange={(next) => { setValue('ipAllowlistEnabled', next, { shouldDirty: true }); }}
              />
            </div>
            <Textarea
              label="Adresses autorisées"
              placeholder={'81.250.xx.xx/32 · Bureau, Lyon\n92.184.xx.xx/32 · Astreinte, VPN'}
              rows={4}
              hint="Une adresse par ligne, avec un libellé facultatif après « · »."
              error={formState.errors.ipAllowlist?.message}
              {...register('ipAllowlist')}
            />
            <p className="text-caption text-fg-subtle">
              Votre adresse actuelle : {settings.currentIp}. Les adresses sont masquées à l’affichage. Une connexion hors liste est refusée et consignée.
            </p>
          </div>
        </Section>
        <Section id="sessions" title="Sessions">
          <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
            <TextField label="Inactivité avant déconnexion, minutes *" inputMode="numeric" placeholder="30" error={formState.errors.idleMinutes?.message} {...register('idleMinutes')} />
            <TextField label="Durée maximale d’une session, heures *" inputMode="numeric" placeholder="8" error={formState.errors.maxSessionHours?.message} {...register('maxSessionHours')} />
            <TextField label="Durée maximale d’un accès justifié, minutes *" inputMode="numeric" placeholder="60" error={formState.errors.justifiedAccessMinutes?.message} {...register('justifiedAccessMinutes')} />
            <TextField label="Verrouillage après X échecs *" inputMode="numeric" placeholder="5" error={formState.errors.lockoutFailures?.message} {...register('lockoutFailures')} />
            <TextField label="Durée du verrouillage, minutes *" inputMode="numeric" placeholder="15" error={formState.errors.lockoutMinutes?.message} {...register('lockoutMinutes')} />
          </div>
        </Section>
        <LastChange change={settings.lastChange} />
        <Alert tone="warning">
          <span className="flex items-start gap-2">
            <Icon icon={Info} className="mt-0.5 shrink-0" />
            Avant d’activer la liste blanche, vérifiez que votre adresse y figure : sinon la console devient inaccessible.
          </span>
        </Alert>
        {failure ? <Alert tone="danger">{failure}</Alert> : null}
        <SaveBar pending={formState.isSubmitting} dirty={formState.isDirty} onCancel={() => { reset(valuesOf(settings)); setFailure(null); }} />
      </form>
      <ConfirmDialog
        open={codesOpen}
        onOpenChange={setCodesOpen}
        title="Régénérer les codes de secours"
        description="Les codes actuels sont invalidés et dix nouveaux codes sont générés. L’action est consignée au journal d’audit."
        confirmLabel="Régénérer les codes"
        tone="danger"
        onConfirm={async () => {
          await regenerate.mutateAsync();
          notify.success('Codes de secours régénérés', 'Dix nouveaux codes sont actifs.');
        }}
      />
    </>
  );
}
