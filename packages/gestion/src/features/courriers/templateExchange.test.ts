import { describe, expect, it } from 'vitest';
import { demoTemplates } from './demo';
import { TEMPLATE_FILE_FORMAT, parseTemplateFile, serializeTemplate } from './templateExchange';

const source = demoTemplates.find((item) => item.id === 'mise-en-demeure-de-payer');
if (!source) throw new Error('modèle de démonstration absent');

const wrap = (template: Record<string, unknown>) => JSON.stringify({ format: TEMPLATE_FILE_FORMAT, version: 1, template });
const failure = (text: string): string => {
  const result = parseTemplateFile(text);
  if (result.ok) throw new Error('Le fichier aurait dû être refusé');
  return result.message;
};
const valid = { name: 'Rappel', category: 'loyers', legalFrame: 'autre', description: '', subject: 'Rappel, {mois}', body: 'Bonjour {locataire}, merci de régler votre loyer.', suggestRegistered: false };

describe('échange de modèles au format JSON', () => {
  it('exporte puis réimporte un modèle à l’identique, sans données propres à l’installation', () => {
    const json = serializeTemplate(source);
    expect(JSON.parse(json)).toEqual({
      format: TEMPLATE_FILE_FORMAT,
      version: 1,
      template: { name: source.name, category: source.category, legalFrame: source.legalFrame, description: source.description, subject: source.subject, body: source.body, suggestRegistered: source.suggestRegistered },
    });
    const result = parseTemplateFile(json);
    expect(result).toEqual({ ok: true, input: { name: source.name, category: source.category, legalFrame: source.legalFrame, unitId: '', description: source.description, subject: source.subject, body: source.body, suggestRegistered: source.suggestRegistered } });
  });

  it('accepte un fichier valide écrit à la main', () => {
    expect(parseTemplateFile(wrap(valid)).ok).toBe(true);
  });

  it('refuse un fichier qui n’est pas du JSON', () => {
    expect(parseTemplateFile('{ pas du json')).toEqual({ ok: false, message: 'Ce fichier n’est pas un JSON valide.' });
  });

  it('refuse un JSON d’une autre forme, un autre format ou une autre version', () => {
    expect(failure('[]')).toContain('Fichier de modèle invalide');
    expect(failure(JSON.stringify({ format: 'autre', version: 1, template: valid }))).toContain('« format »');
    expect(failure(JSON.stringify({ format: TEMPLATE_FILE_FORMAT, version: 2, template: valid }))).toContain('« version »');
  });

  it('refuse un champ manquant, mal typé, inconnu ou en trop', () => {
    expect(failure(wrap({ ...valid, name: undefined }))).toContain('« template.name »');
    expect(failure(wrap({ ...valid, category: 'inconnue' }))).toContain('« template.category »');
    expect(failure(wrap({ ...valid, suggestRegistered: 'oui' }))).toContain('« template.suggestRegistered »');
    expect(failure(wrap({ ...valid, builtIn: true }))).toContain('champ inattendu « builtIn »');
  });

  it('applique les règles métier des modèles : nom, objet, longueur et champs connus', () => {
    expect(failure(wrap({ ...valid, name: ' ' }))).toBe('Fichier de modèle invalide : Donnez un nom au modèle');
    expect(failure(wrap({ ...valid, body: 'Court' }))).toContain('trop court');
    expect(failure(wrap({ ...valid, body: 'Bonjour {inconnu}, merci de votre retour.' }))).toContain('Champ inconnu : {inconnu}');
  });
});
