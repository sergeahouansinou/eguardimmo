import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { norm } from '../../../test/lots';
import * as api from './api/responses.fixtures';
import { ReportPage } from './ReportPage';
import { renderReporting, reportUrl } from './testing';
import type { ReportingRole } from './permissions';
import type { MockRoute } from './api/testing';

const SLOW = { timeout: 4000 };
const generatedId = api.IDS.reportGenerated;
const publishedId = api.IDS.reportPublished;
const get = (id: string) => `GET ${reportUrl(id)}`;
const post = (id: string, suffix: string) => `POST ${reportUrl(id, suffix)}`;

const generatedRoutes = (extra: Record<string, MockRoute> = {}): Record<string, MockRoute> => ({ [get(generatedId)]: { body: api.reportGeneratedDetail }, ...extra });
const publishedRoutes = (extra: Record<string, MockRoute> = {}): Record<string, MockRoute> => ({ [get(publishedId)]: { body: api.reportPublishedDetail }, ...extra });

function renderGenerated(extra: Record<string, MockRoute> = {}, role: ReportingRole = 'owner') {
  return renderReporting(<ReportPage id={generatedId} />, generatedRoutes(extra), { role });
}

const button = (name: string | RegExp) => screen.findByRole('button', { name }, SLOW);
const dialog = () => screen.findByRole('dialog', undefined, SLOW);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-18T10:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('compte rendu généré : lecture', () => {
  it('affiche les totaux et les lignes du serveur et les actions du propriétaire', async () => {
    const { container } = renderGenerated();
    await button('Publier');
    const body = await waitFor(() => {
      const text = norm(container.textContent);
      expect(text).toContain('Loyer octobre');
      return text;
    }, SLOW);
    expect(body).toContain('700 €');
    expect(body).toContain('641,20 €');
    expect(body).toContain('Honoraires de gestion');
    expect(screen.getByRole('button', { name: 'Régénérer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Aperçu PDF (projet)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Exporter les lignes (CSV)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Écarter' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Rectifier' })).toBeNull();
    await expectNoA11yViolations(container);
  });

  it('un compte rendu inconnu affiche l’introuvable', async () => {
    renderReporting(<ReportPage id={generatedId} />, { [get(generatedId)]: { status: 404, body: api.problem('report_not_found', 'x') } });
    expect(await screen.findByText('Compte rendu introuvable', undefined, SLOW)).toBeTruthy();
  });

  it('une organisation de type particulier ne lit rien', async () => {
    const { callsTo } = renderReporting(<ReportPage id={generatedId} />, generatedRoutes(), { kind: 'individual' });
    expect(await screen.findByText('Comptes rendus indisponibles pour ce compte', undefined, SLOW)).toBeTruthy();
    expect(callsTo('GET', reportUrl(generatedId))).toHaveLength(0);
  });
});

describe('droits par rôle', () => {
  it('le comptable exporte mais ne publie pas', async () => {
    renderGenerated({}, 'accountant');
    await button('Exporter les lignes (CSV)');
    expect(screen.queryByRole('button', { name: 'Publier' })).toBeNull();
    expect(screen.getByText(/la publication est réservée aux propriétaires, administrateurs et gestionnaires/)).toBeTruthy();
  });

  it('le gestionnaire publie mais n’exporte pas', async () => {
    renderGenerated({}, 'manager');
    await button('Publier');
    expect(screen.queryByRole('button', { name: 'Exporter les lignes (CSV)' })).toBeNull();
  });

  it('seul un rôle de publication voit Rectifier sur un compte rendu publié', async () => {
    const first = renderReporting(<ReportPage id={publishedId} />, publishedRoutes(), { role: 'accountant' });
    await button('Télécharger le PDF');
    expect(screen.queryByRole('button', { name: 'Rectifier' })).toBeNull();
    first.unmount();
    renderReporting(<ReportPage id={publishedId} />, publishedRoutes(), { role: 'admin' });
    expect(await button('Rectifier')).toBeTruthy();
  });
});

describe('publication', () => {
  it('publie maintenant et recharge le compte rendu', async () => {
    const { callsTo } = renderGenerated({ [post(generatedId, '/publish')]: { body: api.reportPublishedDetail } });
    const user = userEvent.setup();
    await user.click(await button('Publier'));
    const modal = within(await dialog());
    expect(modal.getByText('Publication définitive')).toBeTruthy();
    await user.click(modal.getByRole('button', { name: 'Publier' }));
    await waitFor(() => { expect(callsTo('POST', reportUrl(generatedId, '/publish'))).toHaveLength(1); }, SLOW);
    expect(callsTo('POST', reportUrl(generatedId, '/publish'))[0]?.body).toEqual({});
    await waitFor(() => { expect(callsTo('GET', reportUrl(generatedId)).length).toBeGreaterThan(1); }, SLOW);
  });

  it('planifie la publication à la date choisie', async () => {
    const { callsTo } = renderGenerated({ [post(generatedId, '/publish')]: { body: api.reportScheduledDetail } });
    const user = userEvent.setup();
    await user.click(await button('Publier'));
    const modal = within(await dialog());
    await user.click(modal.getByRole('radio', { name: 'Planifier la publication' }));
    fireEvent.change(modal.getByLabelText('Date et heure de publication'), { target: { value: '2026-12-20T10:00' } });
    await user.click(modal.getByRole('button', { name: 'Planifier' }));
    await waitFor(() => { expect(callsTo('POST', reportUrl(generatedId, '/publish'))).toHaveLength(1); }, SLOW);
    expect(callsTo('POST', reportUrl(generatedId, '/publish'))[0]?.body).toEqual({ scheduled_for: new Date('2026-12-20T10:00').toISOString() });
  });

  it('refuse une date passée sans appeler le serveur', async () => {
    const { callsTo } = renderGenerated();
    const user = userEvent.setup();
    await user.click(await button('Publier'));
    const modal = within(await dialog());
    await user.click(modal.getByRole('radio', { name: 'Planifier la publication' }));
    fireEvent.change(modal.getByLabelText('Date et heure de publication'), { target: { value: '2026-11-01T10:00' } });
    await user.click(modal.getByRole('button', { name: 'Planifier' }));
    expect(await modal.findByText('Choisissez une date et une heure dans le futur.')).toBeTruthy();
    expect(callsTo('POST', reportUrl(generatedId, '/publish'))).toHaveLength(0);
  });

  it('une période non close est expliquée en français', async () => {
    renderGenerated({ [post(generatedId, '/publish')]: { status: 422, body: api.problem('report_period_not_closed', 'x') } });
    const user = userEvent.setup();
    await user.click(await button('Publier'));
    const modal = within(await dialog());
    await user.click(modal.getByRole('button', { name: 'Publier' }));
    expect(await modal.findByText('Un compte rendu ne se publie que lorsque tous les mois de sa période sont clos en comptabilité : clôturez les mois concernés, puis publiez.')).toBeTruthy();
  });

  it('un papier à en-tête incomplet bloque la publication avec son message', async () => {
    renderGenerated({ [post(generatedId, '/publish')]: { status: 422, body: api.problem('report_issuer_incomplete', 'x') } });
    const user = userEvent.setup();
    await user.click(await button('Publier'));
    const modal = within(await dialog());
    await user.click(modal.getByRole('button', { name: 'Publier' }));
    expect(await modal.findByText('Renseignez l’identité légale de l’agence (raison sociale, adresse, SIREN) avant de générer un compte rendu.')).toBeTruthy();
  });

  it('annule une publication planifiée', async () => {
    const { callsTo } = renderReporting(<ReportPage id={generatedId} />, {
      [get(generatedId)]: { body: api.reportScheduledDetail },
      [`DELETE ${reportUrl(generatedId, '/schedule')}`]: { body: api.reportGeneratedDetail },
    });
    const user = userEvent.setup();
    expect(await screen.findByText(/Publication planifiée le/, undefined, SLOW)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Annuler la planification' }));
    const modal = within(await dialog());
    await user.click(modal.getByRole('button', { name: 'Annuler la planification' }));
    await waitFor(() => { expect(callsTo('DELETE', reportUrl(generatedId, '/schedule'))).toHaveLength(1); }, SLOW);
  });
});

describe('rectificatif et écart', () => {
  it('rectifie un compte rendu publié et ouvre le rectificatif', async () => {
    const { callsTo, push } = renderReporting(<ReportPage id={publishedId} />, publishedRoutes({ [post(publishedId, '/rectify')]: { status: 201, body: api.reportRectifiedDetail } }));
    const user = userEvent.setup();
    await user.click(await button('Rectifier'));
    const modal = within(await dialog());
    await user.type(modal.getByLabelText(/Motif de la rectification/), 'Loyer imputé au mauvais lot');
    await user.click(modal.getByRole('button', { name: 'Créer le rectificatif' }));
    await waitFor(() => { expect(callsTo('POST', reportUrl(publishedId, '/rectify'))).toHaveLength(1); }, SLOW);
    expect(callsTo('POST', reportUrl(publishedId, '/rectify'))[0]?.body).toEqual({ reason: 'Loyer imputé au mauvais lot' });
    await waitFor(() => { expect(push).toHaveBeenCalledWith(`/comptes-rendus/${api.IDS.reportRectified}/apercu`); }, SLOW);
  });

  it('un motif trop court est refusé sans appel', async () => {
    const { callsTo } = renderReporting(<ReportPage id={publishedId} />, publishedRoutes());
    const user = userEvent.setup();
    await user.click(await button('Rectifier'));
    const modal = within(await dialog());
    await user.type(modal.getByLabelText(/Motif de la rectification/), 'court');
    await user.click(modal.getByRole('button', { name: 'Créer le rectificatif' }));
    expect((await modal.findAllByText(/10 à 500 caractères/)).length).toBeGreaterThan(0);
    expect(callsTo('POST', reportUrl(publishedId, '/rectify'))).toHaveLength(0);
  });

  it('écarte un brouillon généré et revient à la liste', async () => {
    const { callsTo, push } = renderGenerated({ [post(generatedId, '/discard')]: { body: api.reportDraftDetail } });
    const user = userEvent.setup();
    await user.click(await button('Écarter'));
    const modal = within(await dialog());
    await user.click(modal.getByRole('button', { name: 'Écarter' }));
    await waitFor(() => { expect(callsTo('POST', reportUrl(generatedId, '/discard'))).toHaveLength(1); }, SLOW);
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/comptes-rendus'); }, SLOW);
  });
});

describe('génération, PDF et CSV', () => {
  it('régénère puis recharge', async () => {
    const { callsTo } = renderGenerated({ [post(generatedId, '/generate')]: { body: api.reportGeneratedDetail } });
    const user = userEvent.setup();
    await user.click(await button('Régénérer'));
    await waitFor(() => { expect(callsTo('POST', reportUrl(generatedId, '/generate'))).toHaveLength(1); }, SLOW);
  });

  it('télécharge l’aperçu PDF filigrané sans l’afficher dans la page', async () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:pdf');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const { callsTo } = renderGenerated({ [`GET ${reportUrl(generatedId, '/pdf')}`]: { pdf: '%PDF-1.7' } });
    const user = userEvent.setup();
    await user.click(await button('Aperçu PDF (projet)'));
    await waitFor(() => { expect(createObjectURL).toHaveBeenCalledTimes(1); }, SLOW);
    expect(callsTo('GET', reportUrl(generatedId, '/pdf'))).toHaveLength(1);
    expect(document.querySelector('iframe, object, embed')).toBeNull();
  });

  it('un PDF indisponible n’est pas présenté comme un échec définitif', async () => {
    renderGenerated({ [`GET ${reportUrl(generatedId, '/pdf')}`]: { status: 503, body: api.problem('report_pdf_unavailable', 'x'), headers: { 'Retry-After': '30' } } });
    const user = userEvent.setup();
    await user.click(await button('Aperçu PDF (projet)'));
    expect(await screen.findByText(/dans 30 secondes/, undefined, SLOW)).toBeTruthy();
  });

  it('exporte les lignes en CSV', async () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:csv');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    renderGenerated({ [`GET ${reportUrl(generatedId, '/lines.csv')}`]: { csv: 'date;type\n' } });
    const user = userEvent.setup();
    await user.click(await button('Exporter les lignes (CSV)'));
    await waitFor(() => { expect(createObjectURL).toHaveBeenCalledTimes(1); }, SLOW);
  });

  it('sans double authentification, l’export renvoie vers Connexion et sécurité', async () => {
    renderGenerated({ [`GET ${reportUrl(generatedId, '/lines.csv')}`]: { status: 403, body: api.problem('two_factor_required', 'x') } });
    const user = userEvent.setup();
    await user.click(await button('Exporter les lignes (CSV)'));
    const link = await screen.findByRole('link', { name: 'Ouvrir Connexion et sécurité' }, SLOW);
    expect(link.getAttribute('href')).toBe('/compte/securite');
  });
});

describe('options', () => {
  it('enregistre une option avec la version de verrou lue', async () => {
    const { callsTo } = renderGenerated({ [`PATCH ${reportUrl(generatedId)}`]: { body: api.reportGeneratedDetail } });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('switch', { name: 'Papier à en-tête' }, SLOW));
    await waitFor(() => { expect(callsTo('PATCH', reportUrl(generatedId))).toHaveLength(1); }, SLOW);
    expect(callsTo('PATCH', reportUrl(generatedId))[0]?.body).toEqual({ lock_version: 3, options: { letterhead: false } });
  });

  it('une version périmée demande de recharger', async () => {
    renderGenerated({ [`PATCH ${reportUrl(generatedId)}`]: { status: 409, body: api.problem('report_stale_version', 'x') } });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('switch', { name: 'Détail des relances' }, SLOW));
    expect(await screen.findByText('Ce compte rendu a été modifié depuis votre lecture, ou le grand livre a changé depuis sa génération : rechargez-le, régénérez-le si besoin, puis recommencez.', undefined, SLOW)).toBeTruthy();
  });

  it('une section est conservée au minimum, et un compte rendu publié n’est plus modifiable', async () => {
    renderReporting(<ReportPage id={publishedId} />, publishedRoutes());
    const toggle = await screen.findByRole('switch', { name: 'Papier à en-tête' }, SLOW);
    expect((toggle as HTMLButtonElement).disabled || toggle.getAttribute('aria-disabled') === 'true' || toggle.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Ce compte rendu n’est plus modifiable.')).toBeTruthy();
  });
});
