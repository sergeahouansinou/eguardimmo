'use client';

import { Button, Card, CardTitle, Checkbox, RadioGroup, Select, TextField } from '@eguardimmo/ui';
import type { z } from 'zod';
import { useCreateEdl, useEdls, useEdlTemplates, useLeases, useUpdateEdl } from './hooks';
import { bauxPaths } from './paths';
import { EDL_TYPES, ROOMS, edlInputSchema, edlTypeLabel } from './schemas';
import type { Edl, EdlType } from './schemas';
import { useTenants, useUnits } from '../locataires/hooks';
import { ListLoading, LoadError, NotFoundPanel, PageHeader, errorMessage, noticeAfterNavigation, useGestionNavigation, useNotify } from '../locataires/kit';
import { todayIso } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';
import { useZodForm } from '../locataires/kit/useZodForm';
import { tenantNameOf, unitFullLabel } from '../locataires/schemas';

type Values = z.input<typeof edlInputSchema>;

const asType = (value: string): EdlType => EDL_TYPES.find((entry) => entry === value) ?? 'entree';

export function EtatLieuxFormPage({ id }: { id?: string }) {
  const { search } = useGestionNavigation();
  const edls = useEdls();
  const crumbs = [{ label: 'Accueil', href: links.home }, { label: 'Baux', href: bauxPaths.list }, { label: 'États des lieux', href: bauxPaths.edls }];
  if (id === undefined) {
    return <EdlForm initial={{ type: 'entree', unitId: search.get('bien') ?? '', date: todayIso(), tenantId: '', templateId: 'appartement-standard', rooms: ['Entrée', 'Séjour'] }} />;
  }
  if (edls.isError) return (<><PageHeader crumbs={[...crumbs, { label: 'Modifier' }]} title="Modifier l’état des lieux" /><LoadError title="L’état des lieux n’a pas pu être chargé" /></>);
  if (!edls.data) return (<><PageHeader crumbs={[...crumbs, { label: 'Modifier' }]} title="Modifier l’état des lieux" /><ListLoading label="Chargement de l’état des lieux" /></>);
  const edl = edls.data.find((entry) => entry.id === id);
  if (!edl) {
    return (
      <>
        <PageHeader crumbs={[...crumbs, { label: 'Introuvable' }]} title="État des lieux introuvable" />
        <NotFoundPanel title="Cet état des lieux n’existe pas" description="Il a peut-être été supprimé ou le lien est incorrect." backHref={bauxPaths.edls} backLabel="Retour aux états des lieux" />
      </>
    );
  }
  return <EdlForm edl={edl} initial={{ type: edl.type, unitId: edl.unitId, date: edl.date ?? todayIso(), tenantId: edl.tenantId ?? '', templateId: edl.templateId, rooms: edl.rooms }} />;
}

function EdlForm({ edl, initial }: { edl?: Edl; initial: Values }) {
  const { push } = useGestionNavigation();
  const notify = useNotify();
  const units = useUnits();
  const tenants = useTenants();
  const leases = useLeases();
  const templates = useEdlTemplates();
  const create = useCreateEdl();
  const update = useUpdateEdl(edl?.id ?? '');
  const form = useZodForm(edlInputSchema, initial);
  const editing = edl !== undefined;
  const pending = create.isPending || update.isPending;
  const loading = units.isPending || tenants.isPending || templates.isPending || leases.isPending;

  const roomOptions = [...new Set([...ROOMS, ...form.values.rooms])];

  const chooseUnit = (unitId: string) => {
    form.setValue('unitId', unitId);
    form.touch('unitId');
    const active = (leases.data ?? []).find((lease) => lease.unitId === unitId && (lease.status === 'en_cours' || lease.status === 'preavis'));
    if (active?.tenantIds[0] && form.values.tenantId === '') form.setValue('tenantId', active.tenantIds[0]);
  };

  const save = async (asDraft: boolean) => {
    const values = form.submit();
    if (!values) return;
    try {
      const saved = edl ? await update.mutateAsync(values) : await create.mutateAsync({ input: values, asDraft });
      noticeAfterNavigation({ title: editing ? 'État des lieux modifié' : asDraft ? 'Brouillon enregistré' : 'État des lieux créé, commencez le relevé', description: saved.reference });
      push(bauxPaths.edl(saved.id));
    } catch (error) {
      notify({ tone: 'danger', title: 'Enregistrement impossible', description: errorMessage(error) });
    }
  };

  return (
    <form noValidate className="flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); void save(false); }}>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Baux', href: bauxPaths.list }, { label: 'États des lieux', href: bauxPaths.edls }, { label: editing ? 'Modifier' : 'Nouveau' }]}
        title={editing ? `Modifier ${edl.reference}` : 'Nouvel état des lieux'}
        subtitle="Un état par pièce. Les anomalies se signalent avec une photo."
      />
      {units.isError || tenants.isError || templates.isError ? <LoadError title="Les données du formulaire n’ont pas pu être chargées" /> : null}
      {loading ? <ListLoading label="Chargement du formulaire" /> : null}
      {units.data && tenants.data && templates.data ? (
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-3">
            <Card className="gap-3" role="group" aria-labelledby="ef-quoi">
              <CardTitle as="h2" id="ef-quoi">Type et bien</CardTitle>
              <RadioGroup
                label="Type d’état des lieux"
                value={form.values.type}
                onValueChange={(value) => { form.setValue('type', asType(value)); }}
                options={EDL_TYPES.map((entry) => ({ value: entry, label: edlTypeLabel[entry] }))}
              />
              <Select
                label="Bien *"
                placeholder="Choisir un bien"
                searchable
                value={form.values.unitId}
                error={form.error('unitId')}
                onValueChange={chooseUnit}
                options={units.data.map((unit) => ({ value: unit.id, label: unitFullLabel(unit) }))}
              />
              <Select
                label="Locataire"
                placeholder="Choisir un locataire (facultatif)"
                searchable
                value={form.values.tenantId}
                onValueChange={(value) => { form.setValue('tenantId', value); }}
                options={tenants.data.filter((tenant) => tenant.status !== 'archive').map((tenant) => ({ value: tenant.id, label: tenantNameOf(tenant) }))}
              />
            </Card>
            <Card className="gap-3" role="group" aria-labelledby="ef-quand">
              <CardTitle as="h2" id="ef-quand">Date et grille</CardTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField
                  label="Date *"
                  type="date"
                  placeholder="jj/mm/aaaa"
                  value={form.values.date}
                  error={form.error('date')}
                  onChange={(event) => { form.setValue('date', event.target.value); }}
                  onBlur={() => { form.touch('date'); }}
                />
                <Select
                  label="Grille *"
                  placeholder="Choisir une grille"
                  value={form.values.templateId}
                  error={form.error('templateId')}
                  onValueChange={(value) => { form.setValue('templateId', value); }}
                  options={templates.data.map((template) => ({ value: template.id, label: template.label }))}
                />
              </div>
            </Card>
            <Card className="gap-3" role="group" aria-labelledby="ef-pieces">
              <CardTitle as="h2" id="ef-pieces">Pièces à contrôler</CardTitle>
              <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {roomOptions.map((room) => (
                  <li key={room}>
                    <Checkbox
                      label={room}
                      checked={form.values.rooms.includes(room)}
                      onChange={() => {
                        form.setValue('rooms', form.values.rooms.includes(room) ? form.values.rooms.filter((entry) => entry !== room) : [...form.values.rooms, room]);
                        form.touch('rooms');
                      }}
                    />
                  </li>
                ))}
              </ul>
              {form.error('rooms') ? <span role="alert" className="text-caption text-fg-danger">{form.error('rooms')}</span> : null}
            </Card>
          </div>
          <aside className="flex min-w-0 flex-col gap-3">
            <Card className="gap-2" role="group" aria-labelledby="ef-aide">
              <CardTitle as="h2" id="ef-aide">À savoir</CardTitle>
              <p className="text-body text-fg-muted">Le locataire reçoit une invitation à la visite. L’état des lieux est signé à la fin de la visite.</p>
            </Card>
          </aside>
        </div>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={() => { push(edl ? bauxPaths.edl(edl.id) : bauxPaths.edls); }}>Annuler</Button>
        {editing ? null : <Button variant="secondary" loading={pending} onClick={() => { void save(true); }}>Enregistrer en brouillon</Button>}
        <Button type="submit" loading={pending}>{editing ? 'Enregistrer les modifications' : 'Créer et commencer le relevé'}</Button>
      </div>
    </form>
  );
}
