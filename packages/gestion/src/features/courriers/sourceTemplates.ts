import type { DemoCollection } from '../locataires/kit/collection';
import { NotFoundError } from '../locataires/kit/collection';
import { todayIso } from '../locataires/kit/dates';
import { uniqueSlug } from '../locataires/kit/ids';
import { parseOrThrow } from './parse';
import { templateDraftInputSchema, templateInputSchema } from './schemas';
import type { Courrier, Template } from './schemas';
import type { CourriersSource, TemplateMode } from './sourceTypes';

type TemplatesApi = Pick<CourriersSource, 'templates' | 'createTemplate' | 'updateTemplate' | 'duplicateTemplate' | 'restoreTemplate' | 'setTemplateArchived' | 'deleteTemplate'>;

export function createTemplatesSource(templates: DemoCollection<Template>, courriers: DemoCollection<Courrier>): TemplatesApi {
  const parse = (raw: unknown, mode: TemplateMode) => {
    const values = parseOrThrow(mode === 'brouillon' ? templateDraftInputSchema : templateInputSchema, raw);
    return { ...values, unitId: values.unitId === '' ? null : values.unitId, draft: mode === 'brouillon' };
  };

  return {
    templates: () => Promise.resolve(templates.all()),
    createTemplate: (raw, mode = 'actif') => {
      const values = parse(raw, mode);
      return Promise.resolve(
        templates.add({ id: uniqueSlug(values.name, templates.all().map((entry) => entry.id)), ...values, sourceId: null, builtIn: false, archived: false, updatedOn: todayIso() }),
      );
    },
    updateTemplate: (id, raw, mode = 'actif') => {
      if (!templates.find(id)) return Promise.reject(new NotFoundError('Modèle', id));
      return Promise.resolve(templates.patch(id, { ...parse(raw, mode), updatedOn: todayIso() }));
    },
    duplicateTemplate: (id) => {
      const current = templates.find(id);
      if (!current) return Promise.reject(new NotFoundError('Modèle', id));
      const name = `${current.name}, copie`;
      return Promise.resolve(
        templates.add({ ...current, id: uniqueSlug(name, templates.all().map((entry) => entry.id)), name, sourceId: current.builtIn ? current.id : current.sourceId, builtIn: false, archived: false, updatedOn: todayIso() }),
      );
    },
    restoreTemplate: (id) => {
      const current = templates.find(id);
      if (!current) return Promise.reject(new NotFoundError('Modèle', id));
      if (current.builtIn || current.sourceId === null) return Promise.reject(new Error('Ce modèle ne remplace aucun modèle par défaut.'));
      const origin = templates.find(current.sourceId);
      if (!origin?.builtIn) return Promise.reject(new Error('Le modèle par défaut d’origine est introuvable.'));
      return Promise.resolve(
        templates.patch(id, {
          category: origin.category,
          legalFrame: origin.legalFrame,
          description: origin.description,
          subject: origin.subject,
          body: origin.body,
          suggestRegistered: origin.suggestRegistered,
          draft: false,
          updatedOn: todayIso(),
        }),
      );
    },
    setTemplateArchived: (id, archived) => {
      if (!templates.find(id)) return Promise.reject(new NotFoundError('Modèle', id));
      return Promise.resolve(templates.patch(id, { archived }));
    },
    deleteTemplate: (id) => {
      const current = templates.find(id);
      if (!current) return Promise.reject(new NotFoundError('Modèle', id));
      if (current.builtIn) return Promise.reject(new Error('Un modèle fourni ne peut pas être supprimé. Archivez-le.'));
      if (courriers.all().some((courrier) => courrier.templateId === id)) {
        return Promise.reject(new Error('Ce modèle a servi à des courriers. Archivez-le plutôt.'));
      }
      templates.remove(id);
      return Promise.resolve();
    },
  };
}
