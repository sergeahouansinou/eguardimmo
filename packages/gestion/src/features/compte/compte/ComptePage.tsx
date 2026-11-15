'use client';

import { Download } from 'lucide-react';
import { Badge, Button, Icon, Select, TextField } from '@eguardimmo/ui';
import { QueryState } from '../../outils/kit';
import type { ScreenProps } from '../../outils/kit';
import { useMemo } from 'react';
import { formatDate } from '../shared/dates';
import { FormAlerts } from '../shared/FormAlerts';
import { SettingRow, SettingsCard } from '../shared/SettingRow';
import { SettingsLayout } from '../shared/SettingsLayout';
import { useSettingsForm } from '../shared/useSettingsForm';

import { narrow } from '../shared/narrow';
import { CIVILITIES, LANDLORD_TYPES, profileFormSchema } from './schemas';
import type { Profile, ProfileForm } from './schemas';
import { useProfile, useSaveProfile } from './source';

type Update = (patch: Partial<ProfileForm>) => void;

const LANDLORD_OPTIONS = [
  { value: 'particulier', label: 'Particulier' },
  { value: 'societe', label: 'Société' },
];
const CIVILITY_OPTIONS = [
  { value: 'mme', label: 'Mme' },
  { value: 'm', label: 'M.' },
];

function IdentityCard({ form, update, errors }: { form: ProfileForm; update: Update; errors: Record<string, string> }) {
  return (
    <SettingsCard id="ct-id" title="Identité">
      <Select
        label="Type de bailleur"
        placeholder="Choisir"
        options={LANDLORD_OPTIONS}
        value={form.landlordType}
        onValueChange={(value) => {
          const landlordType = narrow(LANDLORD_TYPES, value);
          if (landlordType) update({ landlordType });
        }}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[96px_minmax(0,1fr)_minmax(0,1fr)]">
        <Select
          label="Civilité"
          placeholder="Choisir"
          options={CIVILITY_OPTIONS}
          value={form.civility}
          onValueChange={(value) => {
            const civility = narrow(CIVILITIES, value);
            if (civility) update({ civility });
          }}
        />
        <TextField label="Prénom *" placeholder="Ex. : Awa" autoComplete="given-name" value={form.firstName} error={errors.firstName} onChange={(event) => { update({ firstName: event.target.value }); }} />
        <TextField label="Nom *" placeholder="Ex. : Diallo" autoComplete="family-name" value={form.lastName} error={errors.lastName} onChange={(event) => { update({ lastName: event.target.value }); }} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label="Date de naissance" placeholder="Ex. : 02/06/1979" inputMode="numeric" value={form.birthDate} error={errors.birthDate} onChange={(event) => { update({ birthDate: event.target.value }); }} />
        <TextField label="Lieu de naissance" placeholder="Ex. : Dakar, Sénégal" value={form.birthPlace} error={errors.birthPlace} onChange={(event) => { update({ birthPlace: event.target.value }); }} />
      </div>
    </SettingsCard>
  );
}

function CompanyCard({ form, update, errors }: { form: ProfileForm; update: Update; errors: Record<string, string> }) {
  return (
    <SettingsCard id="ct-soc" title="Société" aside={<span className="text-caption text-fg-subtle">Facultatif</span>}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label="Raison sociale" placeholder="Ex. : SCI Les Tilleuls" value={form.companyName} error={errors.companyName} onChange={(event) => { update({ companyName: event.target.value }); }} />
        <TextField label="SIREN" placeholder="Ex. : 912 345 678" inputMode="numeric" value={form.siren} error={errors.siren} onChange={(event) => { update({ siren: event.target.value }); }} />
      </div>
      <TextField
        label="Numéro de TVA intracommunautaire"
        placeholder="Ex. : FR40912345678"
        hint="À renseigner si le compte est au nom d'une société."
        value={form.vatNumber}
        error={errors.vatNumber}
        onChange={(event) => { update({ vatNumber: event.target.value.toUpperCase() }); }}
      />
    </SettingsCard>
  );
}

function ContactCard({ form, email, update, errors }: { form: ProfileForm; email: string; update: Update; errors: Record<string, string> }) {
  return (
    <SettingsCard id="ct-cont" title="Coordonnées">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label="Téléphone mobile *" type="tel" placeholder="Ex. : +33 6 00 00 00 09" hint="Vérifié par SMS" autoComplete="tel" value={form.phone} error={errors.phone} onChange={(event) => { update({ phone: event.target.value }); }} />
        <TextField label="E-mail *" type="email" placeholder="Ex. : awa.diallo@example.com" hint="Se modifie dans Connexion et sécurité" readOnly value={email} />
      </div>
      <TextField label="Adresse *" placeholder="Ex. : 12 rue des Lilas, 75011 Paris" autoComplete="street-address" value={form.address} error={errors.address} onChange={(event) => { update({ address: event.target.value }); }} />
    </SettingsCard>
  );
}

function SecurityCard({ Link, profile }: Pick<ScreenProps, 'Link'> & { profile: Profile }) {
  const { security } = profile;
  return (
    <SettingsCard id="ct-sec" title="Connexion et sécurité">
      <div>
        <SettingRow title="E-mail" hint={profile.email}>
          <Button variant="secondary" size="sm" asChild>
            <Link href="/compte/securite">
              Modifier<span className="sr-only"> l'e-mail</span>
            </Link>
          </Button>
        </SettingRow>
        <SettingRow title="Mot de passe" hint={`Modifié le ${formatDate(security.passwordChangedAt)}`}>
          <Button variant="secondary" size="sm" asChild>
            <Link href="/compte/securite">
              Modifier<span className="sr-only"> le mot de passe</span>
            </Link>
          </Button>
        </SettingRow>
        <SettingRow title="Double authentification" hint={security.twoFactorMethod}>
          <Badge tone={security.twoFactorEnabled ? 'success' : 'warning'}>{security.twoFactorEnabled ? 'Activée' : 'Non activée'}</Badge>
        </SettingRow>
        <SettingRow title="Appareils connectés" hint={`${String(security.sessions)} sessions actives`}>
          <Button variant="secondary" size="sm" asChild>
            <Link href="/compte/securite">
              Voir<span className="sr-only"> les appareils connectés</span>
            </Link>
          </Button>
        </SettingRow>
      </div>
    </SettingsCard>
  );
}

function DataCard({ Link }: Pick<ScreenProps, 'Link'>) {
  return (
    <SettingsCard id="ct-data" title="Mes données">
      <span className="text-body text-fg-muted">Biens, baux, paiements et documents.</span>
      <Button variant="secondary" className="self-start" asChild>
        <Link href="/compte/export">
          <Icon icon={Download} />
          Exporter mes données
        </Link>
      </Button>
    </SettingsCard>
  );
}

export function ComptePage({ Link }: ScreenProps) {
  const query = useProfile();
  const save = useSaveProfile();
  const saved = useMemo(() => query.data?.form, [query.data]);
  const form = useSettingsForm({
    saved,
    schema: profileFormSchema,
    save: (value) => save.mutateAsync(value),
    success: 'Profil enregistré.',
  });
  return (
    <SettingsLayout
      Link={Link}
      section="compte"
      description="Identité et coordonnées du bailleur, reprises sur les documents émis."
      onCancel={form.reset}
      onSave={form.submit}
      saving={form.saving}
    >
      <FormAlerts errors={form.errors} failed={form.failed} failureTitle="Le profil n'a pas pu être enregistré" />
      <QueryState query={query} errorTitle="Le profil n'a pas pu être chargé" loadingLabel="Chargement du profil">
        {(profile) =>
          form.value ? (
            <div className="grid grid-cols-1 items-start gap-3 min-[1400px]:grid-cols-[minmax(0,1fr)_300px]">
              <div className="flex min-w-0 flex-col gap-3">
                <IdentityCard form={form.value} update={form.update} errors={form.errors} />
                <CompanyCard form={form.value} update={form.update} errors={form.errors} />
                <ContactCard form={form.value} email={profile.email} update={form.update} errors={form.errors} />
              </div>
              <div className="flex min-w-0 flex-col gap-3">
                <SecurityCard Link={Link} profile={profile} />
                <DataCard Link={Link} />
              </div>
            </div>
          ) : null
        }
      </QueryState>
    </SettingsLayout>
  );
}
