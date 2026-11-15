'use client';

import { Button, Card, CardTitle, RadioGroup, Select, Textarea, TextField } from '@eguardimmo/ui';
import type { z } from 'zod';
import { useLeases } from '../baux/hooks';
import { useCreateCourrier, useTemplates } from './hooks';
import { activeLeaseOf, templateValues } from './fields';
import { courriersPaths } from './paths';
import { CHANNELS, channelLabel, courrierInputSchema, renderTemplate } from './schemas';
import type { Channel, Template } from './schemas';
import { useTenants, useUnits } from '../locataires/hooks';
import { ListLoading, LoadError, PageHeader, errorMessage, noticeAfterNavigation, useGestionNavigation, useNotify } from '../locataires/kit';
import { links } from '../locataires/kit/links';
import { useZodForm } from '../locataires/kit/useZodForm';
import { tenantNameOf } from '../locataires/schemas';
import type { Tenant, Unit } from '../locataires/schemas';
import type { Lease } from '../baux/schemas';

type Values = z.input<typeof courrierInputSchema>;

const asChannel = (value: string): Channel => CHANNELS.find((entry) => entry === value) ?? 'email';

export function CourrierFormPage() {
  const { search } = useGestionNavigation();
  const tenants = useTenants();
  const units = useUnits();
  const leases = useLeases();
  const templates = useTemplates();
  const crumbs = [{ label: 'Accueil', href: links.home }, { label: 'Documents', href: courriersPaths.documents }, { label: 'Courriers', href: courriersPaths.courriers }, { label: 'Nouveau courrier' }];

  if (tenants.isError || units.isError || leases.isError || templates.isError) {
    return (<><PageHeader crumbs={crumbs} title="Nouveau courrier" /><LoadError title="Le formulaire n’a pas pu être chargé" /></>);
  }
  if (!tenants.data || !units.data || !leases.data || !templates.data) {
    return (<><PageHeader crumbs={crumbs} title="Nouveau courrier" /><ListLoading label="Chargement du formulaire" /></>);
  }
  return (
    <CourrierForm
      tenants={tenants.data.filter((tenant) => tenant.status !== 'archive')}
      units={units.data}
      leases={leases.data}
      templates={templates.data.filter((template) => !template.archived)}
      presetTemplate={search.get('modele') ?? ''}
      presetTenant={search.get('locataire') ?? ''}
      presetUnit={search.get('bien') ?? ''}
    />
  );
}

function CourrierForm({
  tenants,
  units,
  leases,
  templates,
  presetTemplate,
  presetTenant,
  presetUnit,
}: {
  tenants: Tenant[];
  units: Unit[];
  leases: Lease[];
  templates: Template[];
  presetTemplate: string;
  presetTenant: string;
  presetUnit: string;
}) {
  const { push } = useGestionNavigation();
  const notify = useNotify();
  const create = useCreateCourrier();

  const compose = (templateId: string, tenantId: string, unitHint: string): Pick<Values, 'subject' | 'body' | 'unitId'> => {
    const template = templates.find((entry) => entry.id === templateId);
    const tenant = tenants.find((entry) => entry.id === tenantId);
    const lease = activeLeaseOf(leases, tenantId);
    const unitId = lease?.unitId ?? tenant?.unitId ?? unitHint;
    const unit = units.find((entry) => entry.id === unitId);
    if (!template) return { subject: '', body: '', unitId };
    const values = templateValues({ tenant, unit, lease });
    return { subject: renderTemplate(template.subject, values), body: renderTemplate(template.body, values), unitId };
  };

  const startTemplate = templates.some((entry) => entry.id === presetTemplate) ? presetTemplate : '';
  const startTenant = tenants.some((entry) => entry.id === presetTenant) ? presetTenant : '';
  const form = useZodForm(courrierInputSchema, {
    templateId: startTemplate,
    tenantId: startTenant,
    channel: 'email',
    ...compose(startTemplate, startTenant, presetUnit),
  });

  const recompose = (templateId: string, tenantId: string) => {
    const next = compose(templateId, tenantId, '');
    form.setValue('subject', next.subject);
    form.setValue('body', next.body);
    form.setValue('unitId', next.unitId);
  };

  const save = async (status: 'brouillon' | 'genere') => {
    const values = form.submit();
    if (!values) return;
    try {
      const saved = await create.mutateAsync({ input: values, status });
      noticeAfterNavigation({ title: status === 'brouillon' ? 'Brouillon enregistré' : 'Courrier généré', description: saved.reference });
      push(courriersPaths.courrier(saved.id));
    } catch (error) {
      notify({ tone: 'danger', title: 'Enregistrement impossible', description: errorMessage(error) });
    }
  };

  const tenant = tenants.find((entry) => entry.id === form.values.tenantId);

  return (
    <form noValidate className="flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); void save('genere'); }}>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Documents', href: courriersPaths.documents }, { label: 'Courriers', href: courriersPaths.courriers }, { label: 'Nouveau courrier' }]}
        title="Nouveau courrier"
        subtitle="Choisissez un modèle et un destinataire, les champs sont remplis automatiquement."
      />
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <Card className="gap-3" role="group" aria-labelledby="cf-qui">
            <CardTitle as="h2" id="cf-qui">Modèle et destinataire</CardTitle>
            <Select
              label="Modèle"
              placeholder="Choisir un modèle (facultatif)"
              value={form.values.templateId}
              onValueChange={(value) => { form.setValue('templateId', value); recompose(value, form.values.tenantId); }}
              options={templates.map((template) => ({ value: template.id, label: template.name }))}
            />
            <Select
              label="Destinataire *"
              placeholder="Choisir un locataire"
              searchable
              value={form.values.tenantId}
              error={form.error('tenantId')}
              onValueChange={(value) => { form.setValue('tenantId', value); form.touch('tenantId'); recompose(form.values.templateId, value); }}
              options={tenants.map((entry) => ({ value: entry.id, label: tenantNameOf(entry) }))}
            />
            <RadioGroup
              label="Canal d’envoi"
              value={form.values.channel}
              onValueChange={(value) => { form.setValue('channel', asChannel(value)); }}
              options={CHANNELS.map((entry) => ({ value: entry, label: channelLabel[entry] }))}
            />
          </Card>
          <Card className="gap-3" role="group" aria-labelledby="cf-contenu">
            <CardTitle as="h2" id="cf-contenu">Contenu</CardTitle>
            <TextField
              label="Objet *"
              placeholder="Ex. Relance, loyer de novembre impayé"
              value={form.values.subject}
              error={form.error('subject')}
              onChange={(event) => { form.setValue('subject', event.target.value); }}
              onBlur={() => { form.touch('subject'); }}
            />
            <Textarea
              label="Message *"
              placeholder="Rédigez votre courrier ou choisissez un modèle"
              rows={12}
              value={form.values.body}
              error={form.error('body')}
              onChange={(event) => { form.setValue('body', event.target.value); }}
              onBlur={() => { form.touch('body'); }}
            />
          </Card>
        </div>
        <aside className="flex min-w-0 flex-col gap-3">
          <Card className="gap-2" role="group" aria-labelledby="cf-apercu">
            <CardTitle as="h2" id="cf-apercu">Aperçu</CardTitle>
            <p className="text-caption text-fg-subtle">{tenant ? `À l’attention de ${tenantNameOf(tenant)}` : 'Aucun destinataire choisi'}</p>
            <b className="text-body-strong text-fg">{form.values.subject === '' ? 'Objet du courrier' : form.values.subject}</b>
            <p className="text-body whitespace-pre-wrap text-fg-muted">{form.values.body === '' ? 'Le contenu apparaît ici au fil de la saisie.' : form.values.body}</p>
          </Card>
        </aside>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={() => { push(courriersPaths.courriers); }}>Annuler</Button>
        <Button variant="secondary" loading={create.isPending} onClick={() => { void save('brouillon'); }}>Enregistrer en brouillon</Button>
        <Button type="submit" loading={create.isPending}>Générer le courrier</Button>
      </div>
    </form>
  );
}
