'use client';

import { MailPlus, Pencil } from 'lucide-react';
import { DocumentViewer, Paper, PaperHeader } from './DocumentViewer';
import { FormattedText } from './FormattedText';
import { RecordGate } from './RecordGate';
import { useTemplates } from './hooks';
import { courriersPaths } from './paths';
import { TEMPLATE_FIELDS, renderTemplate, templateCategoryLabel } from './schemas';
import { LinkButton, PageHeader } from '../locataires/kit';
import { longDateFr, todayIso } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';

const SAMPLE: Record<string, string> = Object.fromEntries(TEMPLATE_FIELDS.map((field) => [field.key, field.sample]));
const crumbs = [{ label: 'Accueil', href: links.home }, { label: 'Modèles de courriers', href: courriersPaths.modeles }];

export function ModeleApercuPage({ id }: { id: string }) {
  const templates = useTemplates();
  return (
    <RecordGate
      query={templates}
      find={(item) => item.id === id}
      crumbs={crumbs}
      title="Aperçu du modèle"
      missing={{ title: 'Modèle introuvable', description: 'Il a peut-être été supprimé ou le lien est incorrect.', backHref: courriersPaths.modeles, backLabel: 'Retour aux modèles' }}
    >
      {(template) => (
        <>
          <PageHeader
            crumbs={[...crumbs, { label: template.name }]}
            title={template.name}
            subtitle={`${templateCategoryLabel[template.category]}, aperçu avec des données d’exemple`}
            actions={
              <>
                {template.builtIn || template.archived ? null : <LinkButton href={courriersPaths.editModele(template.id)} icon={Pencil}>Modifier</LinkButton>}
                <LinkButton href={links.newCourrier({ modele: template.id })} variant="primary" icon={MailPlus}>Utiliser ce modèle</LinkButton>
              </>
            }
          />
          <DocumentViewer title={template.name}>
            <Paper label={`Modèle ${template.name}`}>
              <PaperHeader right={<span className="text-body text-fg-muted">{`Paris, le ${longDateFr(todayIso())}`}</span>} />
              <p className="text-body-strong">{`Objet : ${renderTemplate(template.subject, SAMPLE)}`}</p>
              <p className="text-body whitespace-pre-line"><FormattedText text={renderTemplate(template.body, SAMPLE)} /></p>
            </Paper>
          </DocumentViewer>
        </>
      )}
    </RecordGate>
  );
}
