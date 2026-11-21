import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { useCertificates } from '../../conformite/hooks';
import { useInterventions } from '../../maintenance/hooks';
import { MissingSourceError } from '../../locataires/kit/sourceContext';
import { OrgApiError } from '../../orgapi/errors';
import { orgInfoStub } from '../../orgapi/testing';
import { PlanningAgendaPage } from './PlanningAgendaPage';
import { certificateFixture, infoInZone, interventionFixture, occurrence, planningStub, planningTask, renderAgenda } from './testing';

vi.mock('../../maintenance/hooks', () => ({ MAINTENANCE_ROOT: ['gestion', 'maintenance'], useInterventions: vi.fn() }));
vi.mock('../../conformite/hooks', () => ({ CONFORMITE_ROOT: ['gestion', 'conformite'], useCertificates: vi.fn() }));

const ready = <T,>(data: T) => ({ data, isError: false, isPending: false, error: null });
const page = <T,>(items: T[], nextCursor: string | null = null) => ready({ items, nextCursor });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-21T10:00:00Z'));
  vi.mocked(useInterventions).mockReturnValue(page([]));
  vi.mocked(useCertificates).mockReturnValue(page([]));
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

const open = (source = planningStub(), options: Parameters<typeof renderAgenda>[2] = {}) => renderAgenda(<PlanningAgendaPage />, source, { search: '', ...options });

describe('agenda', () => {
  it('affiche le mois courant avec événements, tâches, interventions et certificats reliés à leur fiche', async () => {
    vi.mocked(useInterventions).mockReturnValue(page([interventionFixture()]));
    vi.mocked(useCertificates).mockReturnValue(page([certificateFixture()]));
    const source = planningStub({
      occurrences: vi.fn(() => Promise.resolve([occurrence()])),
      tasks: vi.fn(() => Promise.resolve({ items: [planningTask()], nextCursor: null })),
    });
    const { container } = open(source);
    expect(await screen.findByRole('heading', { level: 2, name: 'Novembre 2026' })).toBeTruthy();
    const visit = await screen.findByRole('link', { name: /Visite appartement 12/ });
    expect(visit.getAttribute('href')).toBe('/agenda/0198a0a0-0000-7000-8000-0000000000e1');
    expect(visit.textContent).toContain('14:00');
    expect((await screen.findByRole('link', { name: /Relancer le locataire/ })).getAttribute('href')).toBe('/taches/0198a0a0-0000-7000-8000-0000000000f1');
    expect(screen.getByRole('link', { name: /Réparer la fuite/ }).getAttribute('href')).toBe('/interventions/0198a0a0-0000-7000-8000-0000000000d1');
    expect(screen.getByRole('link', { name: /Entretien de la chaudière/ }).getAttribute('href')).toBe('/conformite/0198a0a0-0000-7000-8000-0000000000d3');
    expect(source.occurrences).toHaveBeenCalledWith('2026-10-26', '2026-12-07');
    expect(source.tasks).toHaveBeenCalledWith({ status: 'open', dueFrom: '2026-10-26', dueTo: '2026-12-07', perPage: 100 });
    expect(vi.mocked(useInterventions)).toHaveBeenCalledWith({ dueFrom: '2026-10-26', dueTo: '2026-12-07', perPage: 100 });
    expect(vi.mocked(useCertificates)).toHaveBeenCalledWith({ expiresFrom: '2026-10-26', expiresTo: '2026-12-07', perPage: 100 });
    await expectNoA11yViolations(container);
  });

  it('place les événements selon le fuseau de l’organisation', async () => {
    const late = occurrence({ occurrenceOn: '2026-11-22', startsAt: '2026-11-22T03:30:00Z', startTime: '04:30', title: 'Rendez-vous tardif' });
    open(planningStub({ occurrences: vi.fn(() => Promise.resolve([late])) }), { info: infoInZone('America/Toronto'), search: 'vue=jour&date=2026-11-21' });
    const link = await screen.findByRole('link', { name: /Rendez-vous tardif/ });
    expect(link.textContent).toContain('22:30');
    expect(screen.getByRole('heading', { level: 3, name: 'Samedi 21 novembre 2026' })).toBeTruthy();
  });

  it('affiche la visite d’une intervention à sa date et non à son échéance', async () => {
    const withVisit = interventionFixture({ visits: [{ id: 'v1', scheduledOn: '2026-11-18', slot: 'afternoon', status: 'confirmed' }] });
    vi.mocked(useInterventions).mockReturnValue(page([withVisit]));
    open(planningStub(), { search: 'vue=jour&date=2026-11-18' });
    const link = await screen.findByRole('link', { name: /Réparer la fuite/ });
    expect(link.textContent).toContain('Visite d’intervention · après-midi');
    cleanup();
    open(planningStub(), { search: 'vue=jour&date=2026-11-25' });
    await screen.findByRole('heading', { level: 3, name: 'Mercredi 25 novembre 2026' });
    expect(screen.queryByRole('link', { name: /Réparer la fuite/ })).toBeNull();
  });

  it('change de vue et de période avec les bornes attendues', async () => {
    const user = userEvent.setup();
    const source = planningStub();
    open(source);
    await screen.findByRole('heading', { level: 2, name: 'Novembre 2026' });
    await user.click(screen.getByRole('radio', { name: 'Semaine' }));
    await waitFor(() => { expect(source.occurrences).toHaveBeenCalledWith('2026-11-16', '2026-11-23'); });
    await user.click(screen.getByRole('radio', { name: 'Mois' }));
    await user.click(screen.getByRole('button', { name: 'Période suivante' }));
    await waitFor(() => { expect(source.occurrences).toHaveBeenCalledWith('2026-11-30', '2027-01-04'); });
    expect(screen.getByRole('heading', { level: 2, name: 'Décembre 2026' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Aujourd’hui' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Novembre 2026' })).toBeTruthy();
  });

  it('ouvre le détail d’un jour depuis la grille et propose d’y ajouter un événement', async () => {
    const user = userEvent.setup();
    const source = planningStub();
    open(source);
    await screen.findByRole('heading', { level: 2, name: 'Novembre 2026' });
    await user.click(screen.getByRole('button', { name: /samedi 21 novembre/ }));
    await waitFor(() => { expect(source.occurrences).toHaveBeenCalledWith('2026-11-21', '2026-11-22'); });
    expect(screen.getByText('Rien de prévu')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Ajouter un événement ce jour/ }).getAttribute('href')).toBe('/agenda/nouveau?date=2026-11-21');
  });

  it('masque les tâches et ne les charge plus quand le filtre est désactivé', async () => {
    const user = userEvent.setup();
    const tasks = vi.fn(() => Promise.resolve({ items: [planningTask()], nextCursor: null }));
    open(planningStub({ tasks }));
    expect(await screen.findByRole('link', { name: /Relancer le locataire/ })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Tâches' }));
    expect(screen.queryByRole('link', { name: /Relancer le locataire/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Tâches' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('signale une erreur de chargement et recharge sur demande', async () => {
    const user = userEvent.setup();
    const occurrences = vi.fn().mockRejectedValueOnce(new OrgApiError('unavailable', 'Service indisponible', { status: 503 })).mockResolvedValue([occurrence()]);
    open(planningStub({ occurrences }));
    expect(await screen.findByText(/Impossible de charger les événements/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('link', { name: /Visite appartement 12/ })).toBeTruthy();
  });

  it('indique les flux refusés, en erreur ou absents sans casser l’agenda', async () => {
    vi.mocked(useInterventions).mockReturnValue({ data: undefined, isError: true, isPending: false, error: new OrgApiError('forbidden', 'Refusé', { status: 403 }) });
    vi.mocked(useCertificates).mockImplementation(() => { throw new MissingSourceError('Documents'); });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    open();
    expect(await screen.findByText(/Interventions : masquées/)).toBeTruthy();
    expect(await screen.findByText(/Échéances de conformité : non disponibles dans cet espace/)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Novembre 2026' })).toBeTruthy();
  });

  it('propose de réessayer quand un flux d’interventions échoue', async () => {
    vi.mocked(useInterventions).mockReturnValue({ data: undefined, isError: true, isPending: false, error: new OrgApiError('unavailable', 'Indisponible', { status: 503 }) });
    open();
    expect(await screen.findByText(/Interventions : chargement impossible/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });

  it('signale une période tronquée', async () => {
    open(planningStub({ tasks: vi.fn(() => Promise.resolve({ items: [planningTask()], nextCursor: 'suite' })) }));
    expect(await screen.findByText(/Seules les 100 premières tâches/)).toBeTruthy();
  });

  it('réserve la création aux rôles qui peuvent écrire et le réglage du fuseau aux administrateurs', async () => {
    const owner = open();
    expect((await screen.findByRole('link', { name: 'Nouvel événement' })).getAttribute('href')).toBe('/agenda/nouveau');
    expect(screen.getByRole('link', { name: 'Modifier le fuseau horaire' }).getAttribute('href')).toBe('/reglages/fuseau-horaire');
    owner.unmount();
    open(planningStub(), { info: orgInfoStub({ role: 'accountant' }) });
    await screen.findByRole('heading', { level: 2, name: 'Novembre 2026' });
    expect(screen.queryByRole('link', { name: 'Nouvel événement' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Modifier le fuseau horaire' })).toBeNull();
  });

  it('affiche une erreur avec réessai quand le fuseau de l’organisation est introuvable', async () => {
    const user = userEvent.setup();
    const timezone = vi.fn().mockRejectedValueOnce(new OrgApiError('unavailable', 'Indisponible', { status: 503 })).mockResolvedValue('Europe/Paris');
    open(planningStub(), { info: { ...orgInfoStub(), timezone } });
    expect(await screen.findByText(/Impossible de charger l’agenda/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Novembre 2026' })).toBeTruthy();
  });
});
