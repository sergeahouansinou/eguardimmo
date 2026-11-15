'use client';

import { Button, Card, CardTitle, RadioGroup, Select, TextField } from '@eguardimmo/ui';
import type { z } from 'zod';
import { useCreateTenant, useTenants, useUpdateTenant } from './hooks';
import { FileDrop, ListLoading, LoadError, NotFoundPanel, PageHeader, errorMessage, noticeAfterNavigation, useGestionNavigation, useNotify } from './kit';
import { links } from './kit/links';
import { useZodForm } from './kit/useZodForm';
import { locatairesPaths } from './paths';
import { tenantInputSchema, tenantNameOf } from './schemas';
import type { Tenant } from './schemas';

type FormValues = z.input<typeof tenantInputSchema>;

const EMPTY: FormValues = {
  kind: 'particulier',
  civility: 'M.',
  firstName: '',
  lastName: '',
  companyName: '',
  birthDate: '',
  email: '',
  phone: '',
  idDocType: '',
  idExpiry: '',
  idFileName: '',
};

const fromTenant = (tenant: Tenant): FormValues => ({
  kind: tenant.kind,
  civility: tenant.civility,
  firstName: tenant.firstName,
  lastName: tenant.lastName,
  companyName: tenant.companyName,
  birthDate: tenant.birthDate ?? '',
  email: tenant.email,
  phone: tenant.phone,
  idDocType: tenant.idDocType ?? '',
  idExpiry: tenant.idExpiry ?? '',
  idFileName: tenant.idFileName ?? '',
});

const civilityOptions = [{ value: 'M.', label: 'M.' }, { value: 'Mme', label: 'Mme' }];
const docOptions = [
  { value: 'passeport', label: 'Passeport' },
  { value: 'cni', label: 'Carte nationale d’identité' },
  { value: 'titre_sejour', label: 'Titre de séjour' },
];

export function LocataireFormPage({ id }: { id?: string }) {
  const tenants = useTenants();
  if (id === undefined) return <TenantForm />;
  if (tenants.isError) return <LoadError title="Le locataire n’a pas pu être chargé" />;
  if (!tenants.data) return <ListLoading label="Chargement du locataire" />;
  const tenant = tenants.data.find((entry) => entry.id === id);
  if (!tenant) {
    return (
      <>
        <PageHeader crumbs={[{ label: 'Locataires', href: locatairesPaths.list }, { label: 'Introuvable' }]} title="Locataire introuvable" />
        <NotFoundPanel title="Ce locataire n’existe pas" description="Il a peut-être été supprimé ou le lien est incorrect." backHref={locatairesPaths.list} backLabel="Retour aux locataires" />
      </>
    );
  }
  return <TenantForm tenant={tenant} />;
}

function TenantForm({ tenant }: { tenant?: Tenant }) {
  const { push } = useGestionNavigation();
  const notify = useNotify();
  const create = useCreateTenant();
  const update = useUpdateTenant(tenant?.id ?? '');
  const form = useZodForm(tenantInputSchema, tenant ? fromTenant(tenant) : EMPTY);
  const editing = tenant !== undefined;
  const societe = form.values.kind === 'societe';
  const pending = create.isPending || update.isPending;
  const backHref = tenant ? locatairesPaths.detail(tenant.id) : locatairesPaths.list;

  const save = async (next: 'detail' | 'bail') => {
    const values = form.submit();
    if (!values) return;
    try {
      const saved = tenant ? await update.mutateAsync(values) : await create.mutateAsync(values);
      noticeAfterNavigation({
        title: editing ? 'Locataire modifié' : 'Locataire enregistré',
        description: tenantNameOf(saved),
      });
      push(next === 'bail' ? links.newLease({ locataire: saved.id }) : locatairesPaths.detail(saved.id));
    } catch (error) {
      notify({ tone: 'danger', title: 'Enregistrement impossible', description: errorMessage(error) });
    }
  };

  const bind = (name: 'firstName' | 'lastName' | 'companyName' | 'email' | 'phone' | 'birthDate' | 'idExpiry') => ({
    value: form.values[name],
    error: form.error(name),
    onChange: (event: { target: { value: string } }) => { form.setValue(name, event.target.value); },
    onBlur: () => { form.touch(name); },
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void save('detail');
      }}
    >
      <PageHeader
        crumbs={[{ label: 'Locataires', href: locatairesPaths.list }, ...(tenant ? [{ label: tenantNameOf(tenant), href: locatairesPaths.detail(tenant.id) }] : []), { label: editing ? 'Modifier' : 'Nouveau locataire' }]}
        title={editing ? 'Modifier le locataire' : 'Nouveau locataire'}
        subtitle={editing ? 'Les modifications sont visibles tout de suite sur la fiche.' : 'Un locataire peut être ajouté sans compte. Il reçoit une invitation plus tard.'}
      />
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <Card className="gap-3" role="group" aria-labelledby="lf-type">
            <CardTitle as="h2" id="lf-type">Type de locataire</CardTitle>
            <RadioGroup
              label="Type de locataire"
              value={form.values.kind}
              onValueChange={(value) => { form.setValue('kind', value === 'societe' ? 'societe' : 'particulier'); }}
              options={[{ value: 'particulier', label: 'Particulier' }, { value: 'societe', label: 'Société' }]}
            />
          </Card>
          <Card className="gap-3" role="group" aria-labelledby="lf-id">
            <CardTitle as="h2" id="lf-id">Identité</CardTitle>
            {societe ? (
              <TextField label="Raison sociale *" placeholder="Ex. SCI Les Tilleuls" {...bind('companyName')} />
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Select label="Civilité" placeholder="Civilité" value={form.values.civility} onValueChange={(value) => { form.setValue('civility', value === 'Mme' ? 'Mme' : 'M.'); }} options={civilityOptions} />
                  <TextField label="Prénom *" placeholder="Ex. Koffi" {...bind('firstName')} />
                  <TextField label="Nom *" placeholder="Ex. Adjovi" {...bind('lastName')} />
                </div>
                <TextField label="Date de naissance" type="date" placeholder="jj/mm/aaaa" hint="Format jj/mm/aaaa" {...bind('birthDate')} />
              </>
            )}
          </Card>
          <Card className="gap-3" role="group" aria-labelledby="lf-contact">
            <CardTitle as="h2" id="lf-contact">Contact</CardTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField label="E-mail *" type="email" placeholder="prenom.nom@example.com" {...bind('email')} />
              <TextField label="Téléphone mobile *" type="tel" placeholder="+33 6 00 00 00 01" {...bind('phone')} />
            </div>
          </Card>
          <Card className="gap-3" role="group" aria-labelledby="lf-piece">
            <CardTitle as="h2" id="lf-piece">Pièce d’identité</CardTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="Type"
                placeholder="Choisir un type"
                value={form.values.idDocType}
                onValueChange={(value) => { form.setValue('idDocType', value === 'passeport' || value === 'cni' || value === 'titre_sejour' ? value : ''); }}
                options={docOptions}
              />
              <TextField label="Date d’expiration" type="date" placeholder="jj/mm/aaaa" {...bind('idExpiry')} />
            </div>
            <FileDrop
              title="Joindre la pièce d’identité"
              hint="PDF ou image, 10 Mo au maximum. Stockage privé."
              accept="application/pdf,image/*"
              allowedTypes={['application/pdf', 'image/*']}
              maxBytes={10 * 1_048_576}
              fileName={form.values.idFileName}
              onFile={(name) => { form.setValue('idFileName', name); }}
            />
          </Card>
        </div>
        <aside className="flex min-w-0 flex-col gap-3">
          <Card className="gap-2" role="group" aria-labelledby="lf-apres">
            <CardTitle as="h2" id="lf-apres">Après l’enregistrement</CardTitle>
            <p className="text-body text-fg-muted">Vous pourrez créer un bail, envoyer une invitation et partager des documents.</p>
          </Card>
        </aside>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={() => { push(backHref); }}>Annuler</Button>
        {editing ? null : (
          <Button variant="secondary" loading={pending} onClick={() => { void save('bail'); }}>
            Enregistrer et créer un bail
          </Button>
        )}
        <Button type="submit" loading={pending}>
          {editing ? 'Enregistrer les modifications' : 'Enregistrer le locataire'}
        </Button>
      </div>
    </form>
  );
}
