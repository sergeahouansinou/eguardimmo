import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { shellSchema } from '@eguardimmo/shell';
import { describe, expect, it, vi } from 'vitest';
import { createDemoSource } from '@/data/demoSource';
import type { LocataireSource } from '@/data/source';
import { expectNoA11yViolations } from '../../../test/axe';
import { nav } from '../../../test/navigation';
import { renderScreen } from '../../../test/render';
import { InformationsScreen } from './InformationsScreen';
import { ModifierScreen } from './ModifierScreen';
import { NotificationsScreen } from './NotificationsScreen';
import { SecuriteScreen } from './SecuriteScreen';

describe('Mes informations', () => {
  it('affiche l’identité, les coordonnées et l’IBAN masqué', async () => {
    const { container } = renderScreen(<InformationsScreen />, { pathname: '/compte' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Mes informations' })).toBeTruthy();
    expect(await screen.findByText('koffi.adjovi@example.com')).toBeTruthy();
    expect(screen.getByText('•••• 4417')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Modifier' }).getAttribute('href')).toBe('/compte/modifier');
    expect(screen.getByRole('link', { name: 'Informations' }).getAttribute('aria-current')).toBe('page');
    await expectNoA11yViolations(container);
  });

  it('enregistre la demande d’export une seule fois', async () => {
    const source = createDemoSource();
    const { user } = renderScreen(<InformationsScreen />, { source });
    await user.click(await screen.findByRole('button', { name: 'Exporter' }));
    expect(await screen.findByText('Demande d’export enregistrée')).toBeTruthy();
    const button = await screen.findByRole('button', { name: 'Demandé' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(((await source.profile()) as { dataExportRequestedOn: string }).dataExportRequestedOn).toBe('2026-11-13');
  });

  it('affiche l’erreur quand la demande d’export échoue', async () => {
    const source = createDemoSource();
    const requestDataExport = vi.fn<LocataireSource['requestDataExport']>().mockRejectedValue(new Error('Export indisponible'));
    const { user } = renderScreen(<InformationsScreen />, { source: { ...source, requestDataExport } });
    await user.click(await screen.findByRole('button', { name: 'Exporter' }));
    expect(await screen.findByText('Export indisponible')).toBeTruthy();
  });
});

describe('Modifier mes informations', () => {
  it('enregistre sans code quand ni l’e-mail ni le mobile ne changent', async () => {
    const source = createDemoSource();
    const { user, container } = renderScreen(<ModifierScreen />, { source, pathname: '/compte/modifier' });
    const profession = await screen.findByLabelText('Profession');
    await expectNoA11yViolations(container);
    await user.clear(profession);
    await user.type(profession, 'Architecte');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => { expect(nav.push).toHaveBeenCalledWith('/compte'); });
    expect(((await source.profile()) as { profession: string }).profession).toBe('Architecte');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('refuse un e-mail invalide et un prénom vide', async () => {
    const source = createDemoSource();
    const spy = vi.spyOn(source, 'updateProfile');
    const { user } = renderScreen(<ModifierScreen />, { source });
    await user.clear(await screen.findByLabelText('Prénom *'));
    const email = screen.getByLabelText('E-mail *');
    await user.clear(email);
    await user.type(email, 'pas-un-email');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Le prénom est obligatoire.')).toBeTruthy();
    expect(screen.getByText('Saisissez une adresse e-mail valide.')).toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
  });

  it('demande le code de confirmation quand l’e-mail change et refuse un mauvais code', async () => {
    const source = createDemoSource();
    const { user } = renderScreen(<ModifierScreen />, { source });
    const email = await screen.findByLabelText('E-mail *');
    await user.clear(email);
    await user.type(email, 'nouvelle.adresse@example.com');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    const dialog = await screen.findByRole('dialog', { name: 'Confirmer le changement de coordonnées' });
    expect(((await source.profile()) as { email: string }).email).toBe('koffi.adjovi@example.com');

    await user.type(within(dialog).getByLabelText('Code de confirmation'), '12');
    await user.click(within(dialog).getByRole('button', { name: 'Confirmer' }));
    expect(await within(dialog).findByText('Le code comporte 6 chiffres.')).toBeTruthy();

    await user.clear(within(dialog).getByLabelText('Code de confirmation'));
    await user.type(within(dialog).getByLabelText('Code de confirmation'), '000000');
    await user.click(within(dialog).getByRole('button', { name: 'Confirmer' }));
    expect(await within(dialog).findByText('Le code de confirmation est incorrect.')).toBeTruthy();
    expect(((await source.profile()) as { email: string }).email).toBe('koffi.adjovi@example.com');
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('enregistre le nouvel e-mail avec le bon code', async () => {
    const source = createDemoSource();
    const { user } = renderScreen(<ModifierScreen />, { source });
    const email = await screen.findByLabelText('E-mail *');
    await user.clear(email);
    await user.type(email, 'nouvelle.adresse@example.com');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    const dialog = await screen.findByRole('dialog', { name: 'Confirmer le changement de coordonnées' });
    await user.type(within(dialog).getByLabelText('Code de confirmation'), '123456');
    await user.click(within(dialog).getByRole('button', { name: 'Confirmer' }));
    await waitFor(() => { expect(nav.push).toHaveBeenCalledWith('/compte'); });
    expect(((await source.profile()) as { email: string }).email).toBe('nouvelle.adresse@example.com');
  });

  it('contrôle le type et la taille de la photo de profil', async () => {
    renderScreen(<ModifierScreen />);
    const input = await screen.findByLabelText('Choisir une photo');
    fireEvent.change(input, { target: { files: [new File(['x'], 'cv.pdf', { type: 'application/pdf' })] } });
    expect(await screen.findByText(/n'est pas d'un format accepté/)).toBeTruthy();
    const heavy = new File(['x'], 'grosse.png', { type: 'image/png' });
    Object.defineProperty(heavy, 'size', { value: 6 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [heavy] } });
    expect(await screen.findByText(/dépasse 5 Mo/)).toBeTruthy();
  });

  it('accepte une photo conforme et l’enregistre avec le profil', async () => {
    const source = createDemoSource();
    const { user } = renderScreen(<ModifierScreen />, { source });
    await user.upload(await screen.findByLabelText('Choisir une photo'), new File(['x'], 'moi.png', { type: 'image/png' }));
    expect((await screen.findAllByText('moi.png')).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => { expect(nav.push).toHaveBeenCalledWith('/compte'); });
    expect(((await source.profile()) as { photoName: string }).photoName).toBe('moi.png');
  });
});

describe('Sécurité', () => {
  it('résume la sécurité et renvoie vers la gestion du compte', async () => {
    const { container } = renderScreen(<SecuriteScreen />, { pathname: '/compte/securite' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Sécurité' })).toBeTruthy();
    expect(await screen.findByText(/6 codes de secours restants sur 8/)).toBeTruthy();
    for (const link of screen.getAllByRole('link', { name: 'Gérer dans Mon compte' })) {
      expect(link.getAttribute('href')).toBe('/compte/gestion');
    }
    await expectNoA11yViolations(container);
  });
});

describe('Notifications', () => {
  it('modifie une préférence et la conserve dans la source', async () => {
    const source = createDemoSource();
    const { user, container } = renderScreen(<NotificationsScreen />, { source, pathname: '/notifications' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Notifications' })).toBeTruthy();
    await expectNoA11yViolations(container);
    const toggle = await screen.findByRole('switch', { name: 'Quittance disponible, notification push' });
    const before = toggle.getAttribute('aria-checked');
    await user.click(toggle);
    await waitFor(() => {
      expect(screen.getByRole('switch', { name: 'Quittance disponible, notification push' }).getAttribute('aria-checked')).not.toBe(before);
    });
    const saved = (await source.preferences()) as { id: string; push: boolean }[];
    const stored = saved.find((item) => item.id === 'quittance');
    expect(stored?.push).toBe(before !== 'true');
    expect(await screen.findByText('Enregistré')).toBeTruthy();
  });

  it('signale l’échec d’enregistrement d’une préférence', async () => {
    const source = createDemoSource();
    const setPreference = vi.fn<LocataireSource['setPreference']>().mockRejectedValue(new Error('hors ligne'));
    const { user } = renderScreen(<NotificationsScreen />, { source: { ...source, setPreference } });
    await user.click(await screen.findByRole('switch', { name: 'Avis d\'échéance, e-mail' }));
    expect(await screen.findByText('L’enregistrement a échoué, réessayez.')).toBeTruthy();
  });

  it('marque toutes les notifications comme lues', async () => {
    const source = createDemoSource();
    const { user } = renderScreen(<NotificationsScreen />, { source });
    await screen.findByText(/Loyer de novembre à régler/);
    await user.click(screen.getByRole('button', { name: 'Tout marquer comme lu' }));
    await waitFor(() => { expect(screen.queryByText(/\(non lue\)/)).toBeNull(); });
    expect(shellSchema.parse(await source.shell()).notifications.every((item) => !item.unread)).toBe(true);
  });
});
