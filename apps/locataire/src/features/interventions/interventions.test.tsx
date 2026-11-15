import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDemoSource } from '@/data/demoSource';
import type { LocataireSource } from '@/data/source';
import { expectNoA11yViolations } from '../../../test/axe';
import { nav } from '../../../test/navigation';
import { renderScreen } from '../../../test/render';
import { DetailScreen } from './DetailScreen';
import { InterventionsScreen } from './InterventionsScreen';
import { NouvelleScreen } from './NouvelleScreen';

type User = ReturnType<typeof renderScreen>['user'];

async function pick(user: User, name: RegExp, option: RegExp) {
  await user.click(screen.getByRole('combobox', { name }));
  await user.click(await screen.findByRole('option', { name: option }));
}

async function fillValidReport(user: User) {
  await pick(user, /Type de problème/, /Plomberie/);
  await pick(user, /Pièce concernée/, /Cuisine/);
  await user.type(screen.getByLabelText('Titre *'), 'Robinet qui goutte');
  await user.type(screen.getByLabelText('Description *'), 'Le robinet de la cuisine goutte en continu.');
}

describe('Interventions', () => {
  it('liste les demandes en cours et terminées', async () => {
    const { container } = renderScreen(<InterventionsScreen />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Interventions' })).toBeTruthy();
    expect((await screen.findByRole('link', { name: /Suivre Fuite sous l'évier/ })).getAttribute('href')).toBe('/interventions/INT-2026-0147');
    expect(screen.getByRole('link', { name: /Voir Porte du hall/ }).getAttribute('href')).toBe('/interventions/INT-2026-0061');
    expect(screen.getByRole('link', { name: 'Signaler un problème' }).getAttribute('href')).toBe('/interventions/nouvelle');
    await expectNoA11yViolations(container);
  });

  it('indique l’absence de demande', async () => {
    const source = createDemoSource();
    renderScreen(<InterventionsScreen />, { source: { ...source, interventions: () => Promise.resolve([]) } });
    expect((await screen.findAllByText(/Aucune demande/)).length).toBeGreaterThan(0);
  });
});

describe('Signaler un problème', () => {
  it('envoie un signalement complet avec photo et ouvre son suivi', async () => {
    const source = createDemoSource();
    const { user, container } = renderScreen(<NouvelleScreen />, { source });
    await screen.findByRole('heading', { level: 1, name: 'Signaler un problème' });
    await expectNoA11yViolations(container);
    await fillValidReport(user);
    await user.upload(screen.getByLabelText('Joindre des photos'), new File(['x'], 'robinet.jpg', { type: 'image/jpeg' }));
    expect(screen.getByText('robinet.jpg')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Envoyer le signalement' }));
    await waitFor(() => { expect(nav.push).toHaveBeenCalledWith('/interventions/INT-2026-0148'); });
    const list = (await source.interventions()) as { id: string; title: string; photos: string[] }[];
    expect(list[0]).toMatchObject({ id: 'INT-2026-0148', title: 'Robinet qui goutte', photos: ['robinet.jpg'] });
  });

  it('affiche les erreurs de validation sans envoyer', async () => {
    const source = createDemoSource();
    const create = vi.spyOn(source, 'createIntervention');
    const { user } = renderScreen(<NouvelleScreen />, { source });
    await user.click(await screen.findByRole('button', { name: 'Envoyer le signalement' }));
    expect(await screen.findByText('Choisissez un type de problème.')).toBeTruthy();
    expect(screen.getByText('Choisissez la pièce concernée.')).toBeTruthy();
    expect(screen.getByText('Le titre est obligatoire.')).toBeTruthy();
    expect(screen.getByText('La description est obligatoire.')).toBeTruthy();
    expect(create).not.toHaveBeenCalled();
  });

  it('refuse une photo d’un format non accepté et plus de six photos', async () => {
    renderScreen(<NouvelleScreen />);
    const input = await screen.findByLabelText('Joindre des photos');
    fireEvent.change(input, { target: { files: [new File(['x'], 'doc.pdf', { type: 'application/pdf' })] } });
    expect(await screen.findByText(/n'est pas d'un format accepté/)).toBeTruthy();
    expect(screen.queryByText('doc.pdf')).toBeNull();
    const seven = Array.from({ length: 7 }, (_, index) => new File(['x'], `p${String(index)}.png`, { type: 'image/png' }));
    fireEvent.change(input, { target: { files: seven } });
    expect(await screen.findByText('6 photos au maximum.')).toBeTruthy();
  });

  it('affiche l’erreur de la source quand l’envoi échoue', async () => {
    const source = createDemoSource();
    const createIntervention = vi.fn<LocataireSource['createIntervention']>().mockRejectedValue(new Error('Service indisponible'));
    const { user } = renderScreen(<NouvelleScreen />, { source: { ...source, createIntervention } });
    await screen.findByRole('heading', { level: 1 });
    await fillValidReport(user);
    await user.click(screen.getByRole('button', { name: 'Envoyer le signalement' }));
    expect(await screen.findByText('Service indisponible')).toBeTruthy();
    expect(nav.push).not.toHaveBeenCalled();
  });
});

describe('Détail d’une intervention', () => {
  it('affiche la chronologie et le rendez-vous', async () => {
    const { container } = renderScreen(<DetailScreen interventionId="INT-2026-0147" />);
    expect(await screen.findByRole('heading', { level: 1, name: "Fuite sous l'évier" })).toBeTruthy();
    expect(screen.getByText('Chronologie')).toBeTruthy();
    expect(screen.getByRole('link', { name: '+33 1 00 00 00 12' }).getAttribute('href')).toBe('tel:+33100000012');
    await expectNoA11yViolations(container);
  });

  it('déplace le rendez-vous à une date future', async () => {
    const source = createDemoSource();
    const { user } = renderScreen(<DetailScreen interventionId="INT-2026-0147" />, { source, pathname: '/interventions/INT-2026-0147' });
    await user.click(await screen.findByRole('button', { name: 'Modifier le rendez-vous' }));
    const dialog = await screen.findByRole('dialog', { name: 'Modifier le rendez-vous' });
    fireEvent.change(within(dialog).getByLabelText('Nouvelle date'), { target: { value: '2026-11-20' } });
    await user.click(within(dialog).getByRole('combobox', { name: /Créneau/ }));
    await user.click(await screen.findByRole('option', { name: '14 h à 17 h' }));
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer le créneau' }));
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
    const list = (await source.interventions()) as { id: string; appointment: { date: string; slot: string } }[];
    expect(list.find((item) => item.id === 'INT-2026-0147')?.appointment).toMatchObject({ date: '2026-11-20', slot: '14 h à 17 h' });
    expect(await screen.findByText('Rendez-vous modifié')).toBeTruthy();
  });

  it('refuse une date passée dans le dialogue', async () => {
    const source = createDemoSource();
    const spy = vi.spyOn(source, 'rescheduleIntervention');
    const { user } = renderScreen(<DetailScreen interventionId="INT-2026-0147" />, { source });
    await user.click(await screen.findByRole('button', { name: 'Modifier le rendez-vous' }));
    const dialog = await screen.findByRole('dialog', { name: 'Modifier le rendez-vous' });
    fireEvent.change(within(dialog).getByLabelText('Nouvelle date'), { target: { value: '2026-11-10' } });
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer le créneau' }));
    expect(await within(dialog).findByText('Choisissez une date à partir du 14/11/2026.')).toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
  });

  it('signale une intervention inconnue', async () => {
    renderScreen(<DetailScreen interventionId="INT-0000-0000" />);
    expect(await screen.findByRole('heading', { name: /introuvable/i })).toBeTruthy();
  });
});
