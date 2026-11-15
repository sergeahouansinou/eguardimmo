'use client';

import { Badge, Button, Card, CardTitle, Menu, MenuContent, MenuItem, MenuTrigger, Select, Switch, Textarea, TextField } from '@eguardimmo/ui';
import { useRef } from 'react';
import type { z } from 'zod';
import { FormatToolbar } from './FormatToolbar';
import { FormattedText } from './FormattedText';
import { ModeleFieldsCard, ModeleUsageCard } from './ModeleFields';
import { RecordGate } from './RecordGate';
import { useCreateTemplate, useTemplates, useUpdateTemplate } from './hooks';
import { courriersPaths } from './paths';
import { LEGAL_FRAMES, TEMPLATE_CATEGORIES, TEMPLATE_FIELDS, legalFrameLabel, renderTemplate, templateCategoryLabel, templateDraftInputSchema, templateInputSchema } from './schemas';
import type { LegalFrame, Template, TemplateCategory, TemplateInput } from './schemas';
import { downloadTemplateFile } from './templateExchange';
import { useUnits } from '../locataires/hooks';
import { unitFullLabel } from '../locataires/schemas';
import { LinkButton, PageHeader, errorMessage, noticeAfterNavigation, useGestionNavigation, useNotify } from '../locataires/kit';
import { links } from '../locataires/kit/links';
import { useZodForm } from '../locataires/kit/useZodForm';

type Values = z.input<typeof templateInputSchema>;

const crumbs = [{ label: 'Accueil', href: links.home }, { label: 'Modèles de courriers', href: courriersPaths.modeles }];
const asCategory = (value: string): TemplateCategory => TEMPLATE_CATEGORIES.find((entry) => entry === value) ?? 'general';
const asLegalFrame = (value: string): LegalFrame => LEGAL_FRAMES.find((entry) => entry === value) ?? 'autre';
const ALL_UNITS = 'tous';
const SAMPLE: Record<string, string> = Object.fromEntries(TEMPLATE_FIELDS.map((field) => [field.key, field.sample]));

export function ModeleFormPage({ id }: { id?: string }) {
  const templates = useTemplates();
  if (id === undefined) return <TemplateForm initial={{ name: '', category: 'loyers', legalFrame: 'loi_1989', unitId: '', description: '', subject: '', body: '', suggestRegistered: false }} />;
  return (
    <RecordGate
      query={templates}
      find={(item) => item.id === id}
      crumbs={crumbs}
      title="Modifier le modèle"
      missing={{ title: 'Modèle introuvable', description: 'Il a peut-être été supprimé ou le lien est incorrect.', backHref: courriersPaths.modeles, backLabel: 'Retour aux modèles' }}
    >
      {(template) =>
        template.builtIn ? (
          <PageHeader
            crumbs={[...crumbs, { label: template.name }]}
            title={template.name}
            subtitle="Ce modèle fourni ne peut pas être modifié. Dupliquez-le depuis la liste pour l’adapter."
            actions={<LinkButton href={courriersPaths.modeles}>Retour aux modèles</LinkButton>}
          />
        ) : (
          <TemplateForm template={template} initial={{ name: template.name, category: template.category, legalFrame: template.legalFrame, unitId: template.unitId ?? '', description: template.description, subject: template.subject, body: template.body, suggestRegistered: template.suggestRegistered }} />
        )
      }
    </RecordGate>
  );
}

function TemplateForm({ template, initial }: { template?: Template; initial: Values }) {
  const { push } = useGestionNavigation();
  const notify = useNotify();
  const create = useCreateTemplate();
  const units = useUnits();
  const update = useUpdateTemplate(template?.id ?? '');
  const form = useZodForm(templateInputSchema, initial);
  const area = useRef<HTMLDivElement>(null);
  const editing = template !== undefined;
  const pending = create.isPending || update.isPending;

  const insertField = (key: string) => {
    const textarea = area.current?.querySelector('textarea');
    const token = `{${key}}`;
    const start = textarea?.selectionStart ?? form.values.body.length;
    const end = textarea?.selectionEnd ?? start;
    form.setValue('body', `${form.values.body.slice(0, start)}${token}${form.values.body.slice(end)}`);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const persist = async (input: TemplateInput, mode: 'actif' | 'brouillon') => {
    try {
      const saved = template ? await update.mutateAsync({ input, mode }) : await create.mutateAsync({ input, mode });
      noticeAfterNavigation({ title: mode === 'brouillon' ? 'Brouillon enregistré' : editing ? 'Modèle modifié' : 'Modèle créé', description: saved.name });
      push(courriersPaths.modeles);
    } catch (error) {
      notify({ tone: 'danger', title: 'Enregistrement impossible', description: errorMessage(error) });
    }
  };

  const save = async () => {
    const values = form.submit();
    if (values) await persist(values, 'actif');
  };

  const saveDraft = async () => {
    const parsed = templateDraftInputSchema.safeParse(form.values);
    if (!parsed.success) {
      form.touch('name');
      notify({ tone: 'danger', title: 'Brouillon impossible', description: parsed.error.issues[0]?.message ?? 'Saisie invalide.' });
      return;
    }
    await persist(parsed.data, 'brouillon');
  };

  return (
    <form noValidate className="flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <PageHeader
        crumbs={[...crumbs, { label: editing ? 'Modifier' : 'Nouveau modèle' }]}
        title={editing ? `Modifier ${template.name}` : 'Nouveau modèle'}
        subtitle="Rédigez le texte une fois. Les champs entre accolades se remplissent à l’envoi de chaque courrier."
        actions={
          editing ? (
            <>
              {template.draft ? <Badge tone="warning">Brouillon</Badge> : null}
              <Badge tone="info">Personnalisé</Badge>
              <Button variant="secondary" onClick={() => { downloadTemplateFile(template); }}>Exporter</Button>
            </>
          ) : undefined
        }
      />
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="gap-3" role="group" aria-labelledby="mf-edit">
          <CardTitle as="h2" id="mf-edit">Contenu du modèle</CardTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField
              label="Nom du modèle *"
              placeholder="Ex. Relance amiable"
              value={form.values.name}
              error={form.error('name')}
              onChange={(event) => { form.setValue('name', event.target.value); }}
              onBlur={() => { form.touch('name'); }}
            />
            <Select
              label="Catégorie *"
              placeholder="Choisir une catégorie"
              value={form.values.category}
              onValueChange={(value) => { form.setValue('category', asCategory(value)); }}
              options={TEMPLATE_CATEGORIES.map((entry) => ({ value: entry, label: templateCategoryLabel[entry] }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Cadre légal *"
              placeholder="Choisir un cadre légal"
              value={form.values.legalFrame}
              onValueChange={(value) => { form.setValue('legalFrame', asLegalFrame(value)); }}
              options={LEGAL_FRAMES.map((entry) => ({ value: entry, label: legalFrameLabel[entry] }))}
            />
            <Select
              label="Bien"
              placeholder="Choisir un bien"
              searchable
              value={form.values.unitId === '' ? ALL_UNITS : form.values.unitId}
              onValueChange={(value) => { form.setValue('unitId', value === ALL_UNITS ? '' : value); }}
              options={[{ value: ALL_UNITS, label: 'Tous les biens' }, ...(units.data ?? []).map((unit) => ({ value: unit.id, label: unitFullLabel(unit) }))]}
            />
          </div>
          <TextField
            label="Description"
            placeholder="Ex. : envoyée après deux relances sans réponse"
            value={form.values.description}
            onChange={(event) => { form.setValue('description', event.target.value); }}
          />
          <TextField
            label="Objet *"
            placeholder="Ex. Relance, loyer de {mois} impayé"
            value={form.values.subject}
            error={form.error('subject')}
            onChange={(event) => { form.setValue('subject', event.target.value); }}
            onBlur={() => { form.touch('subject'); }}
          />
          <div role="toolbar" aria-label="Outils de rédaction" className="flex flex-wrap items-center gap-2">
            <Menu>
              <MenuTrigger asChild>
                <Button variant="secondary" size="sm">Insérer un champ</Button>
              </MenuTrigger>
              <MenuContent>
                {TEMPLATE_FIELDS.map((field) => (
                  <MenuItem key={field.key} onSelect={() => { insertField(field.key); }}>{`${field.label}, {${field.key}}`}</MenuItem>
                ))}
              </MenuContent>
            </Menu>
            <FormatToolbar fieldRef={area} value={form.values.body} onChange={(value) => { form.setValue('body', value); }} />
            <Button variant="ghost" size="sm" onClick={() => { form.setValue('body', `${form.values.body}${form.values.body === '' ? '' : '\n\n'}Cordialement,\n{bailleur}`); }}>
              Ajouter la formule de politesse
            </Button>
          </div>
          <div ref={area}>
            <Textarea
              label="Message *"
              placeholder="Bonjour {civilite} {locataire}, ..."
              rows={14}
              value={form.values.body}
              error={form.error('body')}
              onChange={(event) => { form.setValue('body', event.target.value); }}
              onBlur={() => { form.touch('body'); }}
            />
          </div>
          <Switch
            label="Proposer l’envoi en lettre recommandée"
            checked={form.values.suggestRegistered}
            onCheckedChange={(checked) => { form.setValue('suggestRegistered', checked); }}
          />
        </Card>
        <aside className="flex min-w-0 flex-col gap-3">
          <ModeleFieldsCard onInsert={insertField} />
          <Card className="gap-2" role="group" aria-labelledby="mf-apercu">
            <div className="flex items-center justify-between gap-2">
              <CardTitle as="h2" id="mf-apercu">Aperçu avec des données d’exemple</CardTitle>
              {template ? <LinkButton href={courriersPaths.modele(template.id)} size="sm">Ouvrir le PDF</LinkButton> : null}
            </div>
            <b className="text-body-strong text-fg">{form.values.subject === '' ? 'Objet du courrier' : renderTemplate(form.values.subject, SAMPLE)}</b>
            <p className="text-body whitespace-pre-wrap text-fg-muted">{form.values.body === '' ? 'Le contenu apparaît ici au fil de la saisie.' : <FormattedText text={renderTemplate(form.values.body, SAMPLE)} />}</p>
          </Card>
          {template ? <ModeleUsageCard templateId={template.id} /> : null}
        </aside>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={() => { push(courriersPaths.modeles); }}>Annuler</Button>
        <Button variant="secondary" loading={pending} onClick={() => { void saveDraft(); }}>Enregistrer en brouillon</Button>
        <Button type="submit" loading={pending}>{editing ? 'Enregistrer les modifications' : 'Créer le modèle'}</Button>
      </div>
    </form>
  );
}
