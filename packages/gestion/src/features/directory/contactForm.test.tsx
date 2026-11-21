import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { FIXTURE_CATEGORY, FIXTURE_OTHER_PARTY, FIXTURE_PARTY, FIXTURE_TAG, detailFixture, duplicatesProblem, personDetailFixture } from './api/fixtures';
import { ContactFormPage } from './ContactFormPage';
import { dirUrl, problem, renderDirectory } from './testing';

const SLOW = { timeout: 4000 };
const create = `POST ${dirUrl('/parties')}`;
const detailRoute = dirUrl(`/parties/${FIXTURE_PARTY}`);

async function ready() {
  await screen.findByRole('textbox', { name: /Nom/ }, SLOW);
  await screen.findByRole('button', { name: 'Artisan' }, SLOW);
}

const fillPerson = async () => {
  await userEvent.type(screen.getByRole('textbox', { name: /^Nom/ }), 'Sanvi');
  await userEvent.type(screen.getByRole('textbox', { name: /^Prénom/ }), 'Rodrigue');
};

describe('création d’un contact', () => {
  it('envoie la fiche validée, avec catégories, étiquettes et coordonnée principale, puis ouvre la fiche', async () => {
    const { container, callsTo, push } = renderDirectory(<ContactFormPage />, { [create]: { status: 201, body: { data: personDetailFixture() } } });
    await ready();
    await fillPerson();
    await userEvent.click(screen.getByRole('button', { name: 'Artisan' }));
    await userEvent.click(screen.getByRole('button', { name: 'Plomberie' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter une coordonnée' }));
    await userEvent.type(screen.getByRole('textbox', { name: /^Coordonnée/ }), 'rodrigue@exemple.fr');
    await userEvent.type(screen.getByRole('textbox', { name: 'Interlocuteur' }), 'Rodrigue');
    await userEvent.type(screen.getByRole('textbox', { name: /^Note/ }), 'Intervient sous 48 h');
    await expectNoA11yViolations(container);
    await userEvent.click(screen.getByRole('button', { name: 'Créer le contact' }));

    await waitFor(() => { expect(push).toHaveBeenCalledWith(`/contacts/${FIXTURE_PARTY}`); }, SLOW);
    expect(callsTo('POST', dirUrl('/parties'))[0]?.body).toEqual({
      kind: 'person',
      last_name: 'Sanvi',
      first_name: 'Rodrigue',
      language: 'fr',
      note: 'Intervient sous 48 h',
      contact_category_ids: [FIXTURE_CATEGORY],
      tag_ids: [FIXTURE_TAG],
      contact_points: [{ type: 'email', value: 'rodrigue@exemple.fr', label: 'Rodrigue', primary: true }],
    });
  });

  it('crée une société avec adresse complète', async () => {
    const { callsTo, push } = renderDirectory(<ContactFormPage />, { [create]: { status: 201, body: { data: detailFixture() } } });
    await ready();
    await userEvent.click(screen.getByRole('radio', { name: 'Société' }));
    await userEvent.type(await screen.findByRole('textbox', { name: /Raison sociale/ }), 'Plomberie Sanvi');
    await userEvent.type(screen.getByRole('textbox', { name: 'Rue' }), '1 rue A');
    await userEvent.type(screen.getByRole('textbox', { name: 'Code postal' }), '75001');
    await userEvent.type(screen.getByRole('textbox', { name: 'Ville' }), 'Paris');
    await userEvent.click(screen.getByRole('button', { name: 'Créer le contact' }));
    await waitFor(() => { expect(push).toHaveBeenCalled(); }, SLOW);
    expect(callsTo('POST', dirUrl('/parties'))[0]?.body).toMatchObject({ kind: 'company', company_name: 'Plomberie Sanvi', address: { line1: '1 rue A', line2: null, postal_code: '75001', city: 'Paris', country: 'FR' } });
  });

  it('bloque localement : nom manquant, adresse incomplète, e-mail invalide, note avec chevrons — sans appel serveur', async () => {
    const { callsTo } = renderDirectory(<ContactFormPage />, {});
    await ready();
    await userEvent.type(screen.getByRole('textbox', { name: 'Rue' }), '1 rue A');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter une coordonnée' }));
    await userEvent.type(screen.getByRole('textbox', { name: /^Coordonnée/ }), 'pas-un-mail');
    await userEvent.type(screen.getByRole('textbox', { name: /^Note/ }), 'a <b> b');
    await userEvent.click(screen.getByRole('button', { name: 'Créer le contact' }));
    expect(await screen.findByText('Renseignez le nom.', {}, SLOW)).toBeTruthy();
    expect(screen.getByText('Renseignez le code postal.')).toBeTruthy();
    expect(screen.getByText('Adresse e-mail invalide.')).toBeTruthy();
    expect(screen.getByText(/caractères < et > ne sont pas autorisés dans la note/)).toBeTruthy();
    expect(callsTo('POST', dirUrl('/parties'))).toHaveLength(0);
  });

  it('un doublon propose les fiches existantes puis crée avec allow_duplicate après confirmation', async () => {
    let calls = 0;
    const { callsTo, push } = renderDirectory(<ContactFormPage />, {
      [create]: () => {
        calls += 1;
        return calls === 1 ? duplicatesProblem() : { status: 201, body: { data: personDetailFixture() } };
      },
    });
    await ready();
    await fillPerson();
    await userEvent.click(screen.getByRole('button', { name: 'Créer le contact' }));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    expect(dialog.textContent).toContain('Un contact semblable existe déjà');
    expect(dialog.textContent).toContain('Plomberie Sanvi SARL');
    expect(dialog.textContent).toContain('même e-mail, même nom');
    expect(dialog.querySelector('a')?.getAttribute('href')).toBe(`/contacts/${FIXTURE_OTHER_PARTY}`);
    expect(push).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Créer quand même' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith(`/contacts/${FIXTURE_PARTY}`); }, SLOW);
    const bodies = callsTo('POST', dirUrl('/parties')).map((call) => call.body);
    expect(bodies[0]).not.toHaveProperty('allow_duplicate');
    expect(bodies[1]).toMatchObject({ allow_duplicate: true, last_name: 'Sanvi' });
  });

  it('annuler la confirmation de doublon ne crée rien', async () => {
    const { callsTo, push } = renderDirectory(<ContactFormPage />, { [create]: duplicatesProblem() });
    await ready();
    await fillPerson();
    await userEvent.click(screen.getByRole('button', { name: 'Créer le contact' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Annuler' }, SLOW));
    await waitFor(() => { expect(screen.queryByText('Un contact semblable existe déjà')).toBeNull(); }, SLOW);
    expect(callsTo('POST', dirUrl('/parties'))).toHaveLength(1);
    expect(push).not.toHaveBeenCalled();
  });

  it.each([
    [403, 'role_forbidden', /Votre rôle ne permet pas cette action/],
    [422, 'validation_failed', /Valeur refusée par le serveur/],
    [429, 'too_many_requests', /Trop de requêtes/],
    [401, 'unauthenticated', /Votre session a expiré/],
  ])('affiche l’erreur serveur %i sans quitter le formulaire', async (status, code, message) => {
    const body = status === 422 ? { status, body: { type: 'about:blank', title: 'x', status, code, detail: 'x', errors: { last_name: ['Valeur refusée par le serveur.'] } } } : problem(status, code);
    const { push } = renderDirectory(<ContactFormPage />, { [create]: body });
    await ready();
    await fillPerson();
    await userEvent.click(screen.getByRole('button', { name: 'Créer le contact' }));
    expect(await screen.findByText(message, {}, SLOW)).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Créer le contact' })).toBeTruthy();
  });

  it('un rôle en lecture seule n’accède pas au formulaire', async () => {
    const { calls } = renderDirectory(<ContactFormPage />, {}, { role: 'accountant' });
    expect(await screen.findByText('Accès refusé', {}, SLOW)).toBeTruthy();
    expect(screen.getByText(/pas de les modifier/)).toBeTruthy();
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(0);
  });
});

describe('modification d’un contact', () => {
  const patch = `PATCH ${detailRoute}`;

  it('précharge la fiche, envoie lock_version et ouvre la fiche modifiée', async () => {
    const { callsTo, push } = renderDirectory(<ContactFormPage id={FIXTURE_PARTY} />, {
      [`GET ${detailRoute}`]: { body: { data: personDetailFixture() } },
      [patch]: { body: { data: personDetailFixture({ lock_version: 4 }) } },
    });
    const name = await screen.findByDisplayValue('Sanvi', {}, SLOW);
    expect(screen.getByDisplayValue('Rodrigue')).toBeTruthy();
    expect(screen.getByDisplayValue('12 rue des Lilas')).toBeTruthy();
    expect(screen.getByText('Type : Personne (non modifiable)')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ajouter une coordonnée' })).toBeNull();
    await userEvent.clear(name);
    await userEvent.type(name, 'Sanvi-Dossou');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith(`/contacts/${FIXTURE_PARTY}`); }, SLOW);
    expect(callsTo('PATCH', detailRoute)[0]?.body).toMatchObject({
      lock_version: 3,
      last_name: 'Sanvi-Dossou',
      first_name: 'Rodrigue',
      company_name: null,
      address: { line1: '12 rue des Lilas', line2: null, postal_code: '75011', city: 'Paris', country: 'FR' },
      contact_category_ids: [FIXTURE_CATEGORY],
      tag_ids: [FIXTURE_TAG],
    });
  });

  it('un conflit de version affiche le message et recharge la fiche à jour', async () => {
    let reads = 0;
    const { callsTo, push } = renderDirectory(<ContactFormPage id={FIXTURE_PARTY} />, {
      [`GET ${detailRoute}`]: () => {
        reads += 1;
        return { body: { data: personDetailFixture(reads === 1 ? {} : { lock_version: 5, last_name: 'Modifié ailleurs', display_name: 'Rodrigue Modifié ailleurs' }) } };
      },
      [patch]: problem(409, 'party_version_conflict'),
    });
    await screen.findByDisplayValue('Sanvi', {}, SLOW);
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Fiche modifiée entre-temps', {}, SLOW)).toBeTruthy();
    expect(screen.getAllByText(/modifiée depuis votre lecture/).length).toBeGreaterThan(0);
    expect(push).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Recharger la fiche' }));
    expect(await screen.findByDisplayValue('Modifié ailleurs', {}, SLOW)).toBeTruthy();
    expect(screen.queryByText('Fiche modifiée entre-temps')).toBeNull();
    expect(callsTo('GET', detailRoute).length).toBeGreaterThanOrEqual(2);
  });

  it('404 : fiche introuvable avec retour à la liste', async () => {
    renderDirectory(<ContactFormPage id={FIXTURE_PARTY} />, { [`GET ${detailRoute}`]: problem(404, 'party_not_found') });
    expect(await screen.findByText('Contact introuvable', {}, SLOW)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retour aux contacts' }).getAttribute('href')).toBe('/contacts');
  });

  it('un contact anonymisé ne se modifie pas', async () => {
    renderDirectory(<ContactFormPage id={FIXTURE_PARTY} />, { [`GET ${detailRoute}`]: { body: { data: detailFixture({ is_anonymized: true }) } } });
    expect(await screen.findByText('Un contact anonymisé ne se modifie plus.', {}, SLOW)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull();
  });
});
