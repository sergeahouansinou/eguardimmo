import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { interventionPageSchema, interventionSchema, optionsSchema } from './interventionSchemas';

const DIRECTORY = join(__dirname, 'releves');
const capture = z.object({ status: z.number(), body: z.unknown() });
const read = (name: string) => capture.parse(JSON.parse(readFileSync(join(DIRECTORY, `${name}.json`), 'utf8')));
const names = readdirSync(DIRECTORY).map((file) => file.replace(/\.json$/, ''));
const problem = z.object({ type: z.string(), title: z.string(), status: z.number(), detail: z.string(), code: z.string(), request_id: z.string().optional() });

const INTERVENTIONS = names.filter((name) => name.startsWith('tenant_detail_') || ['tenant_report_created', 'tenant_report_replayed', 'tenant_file_uploaded', 'tenant_comment_created', 'tenant_visit_confirm', 'tenant_visit_reschedule', 'tenant_cancelled'].includes(name));
const LISTS = ['tenant_list', 'tenant_list_page1', 'tenant_list_empty'];
const OPTIONS = ['tenant_options', 'tenant_options_two_leases', 'tenant_options_voisin'];
const PROBLEMS = names.filter((name) => !INTERVENTIONS.includes(name) && !LISTS.includes(name) && !OPTIONS.includes(name));

describe('réponses réelles du serveur, relevées sur l’API Maintenance', () => {
  it('couvre toutes les captures', () => {
    expect(INTERVENTIONS.length + LISTS.length + OPTIONS.length + PROBLEMS.length).toBe(names.length);
    expect(names.length).toBeGreaterThanOrEqual(28);
  });

  it.each(INTERVENTIONS)('%s respecte le schéma d’une intervention', (name) => {
    expect(() => interventionSchema.parse(read(name).body)).not.toThrow();
  });

  it.each(LISTS)('%s respecte le schéma d’une page', (name) => {
    expect(() => interventionPageSchema.parse(read(name).body)).not.toThrow();
  });

  it.each(OPTIONS)('%s respecte le schéma des choix de signalement', (name) => {
    const parsed = optionsSchema.parse(read(name).body);
    expect(parsed.data.length).toBeGreaterThan(0);
    for (const lease of parsed.data) expect(lease.natures.length).toBeGreaterThan(0);
  });

  it.each(PROBLEMS)('%s est une erreur au format problème', (name) => {
    const { status, body } = read(name);
    expect(status).toBeGreaterThanOrEqual(400);
    expect(problem.parse(body).status).toBe(status);
  });

  it('ne fait fuiter aucun champ interne dans les réponses locataire', () => {
    const text = names.map((name) => JSON.stringify(read(name).body)).join('\n');
    for (const forbidden of ['supplier', 'mandant', 'mandate', 'amount', 'committed', 'quote', 'invoice', 'organization_id', 'tenant_chargeable']) {
      expect(text.toLowerCase()).not.toContain(forbidden);
    }
  });
});
