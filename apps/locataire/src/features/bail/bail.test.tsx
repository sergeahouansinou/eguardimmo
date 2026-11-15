import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDemoSource } from '@/data/demoSource';
import type { LocataireSource } from '@/data/source';
import { expectNoA11yViolations } from '../../../test/axe';
import { nav } from '../../../test/navigation';
import { renderScreen } from '../../../test/render';
import { AssuranceScreen } from '../assurance/AssuranceScreen';
import { DepotScreen } from '../assurance/DepotScreen';
import { DocumentsScreen } from '../documents/DocumentsScreen';
import { EtatDetailScreen } from '../etats/EtatDetailScreen';
import { EtatsScreen } from '../etats/EtatsScreen';
import { BailScreen } from './BailScreen';
import { CongeScreen } from './CongeScreen';

const NOTICE_ADDRESS = { street: '22 avenue Jean Jaurès', postalCode: '69007', city: 'Lyon' };

describe('Mon bail', () => {
  it('présente les conditions du bail et propose de donner congé', async () => {
    const { container } = renderScreen(<BailScreen />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Mon bail' })).toBeTruthy();
    expect(await screen.findByText('Conditions du bail')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Donner congé' }).getAttribute('href')).toBe('/bail/conge');
    await expectNoA11yViolations(container);
  });

  it('télécharge le bail en PDF de démonstration', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const { user } = renderScreen(<BailScreen />);
    await user.click(await screen.findByRole('button', { name: 'Télécharger le bail' }));
    expect(click).toHaveBeenCalledOnce();
    click.mockRestore();
  });
});

describe('Donner congé', () => {
  async function fillAddress(user: ReturnType<typeof renderScreen>['user']) {
    await user.type(await screen.findByPlaceholderText('22 avenue Jean Jaurès'), NOTICE_ADDRESS.street);
    await user.type(screen.getByPlaceholderText('69007'), NOTICE_ADDRESS.postalCode);
    await user.type(screen.getByPlaceholderText('Lyon'), NOTICE_ADDRESS.city);
  }

  it('affiche le formulaire et reste accessible', async () => {
    const { container } = renderScreen(<CongeScreen />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Donner congé' })).toBeTruthy();
    await screen.findByText('Adresse de réexpédition');
    await expectNoA11yViolations(container);
  });

  it('refuse l’envoi sans adresse ni confirmation, sans ouvrir le dialogue', async () => {
    const { user } = renderScreen(<CongeScreen />);
    await user.click(await screen.findByRole('button', { name: 'Envoyer mon congé' }));
    expect(await screen.findByText('Vous devez confirmer le congé.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('refuse un départ avant la fin du préavis', async () => {
    const { user } = renderScreen(<CongeScreen />);
    await fillAddress(user);
    fireEvent.change(screen.getByPlaceholderText('JJ/MM/AAAA'), { target: { value: '2026-12-01' } });
    await user.click(screen.getByRole('checkbox', { name: /Je confirme donner congé/ }));
    await user.click(screen.getByRole('button', { name: 'Envoyer mon congé' }));
    expect(await screen.findByText('Le départ est possible au plus tôt le 13/12/2026.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('demande une confirmation puis enregistre le congé', async () => {
    const source = createDemoSource();
    const { user } = renderScreen(<CongeScreen />, { source });
    await fillAddress(user);
    await user.click(screen.getByRole('checkbox', { name: /Je confirme donner congé/ }));
    await user.click(screen.getByRole('button', { name: 'Envoyer mon congé' }));
    const dialog = await screen.findByRole('dialog');
    expect(((await source.lease()) as { status: string }).status).not.toBe('conge_donne');
    await user.click(within(dialog).getByRole('button', { name: "Confirmer l'envoi du congé" }));
    await waitFor(() => { expect(nav.push).toHaveBeenCalledWith('/bail'); });
    const lease = (await source.lease()) as { status: string; notice: { departureOn: string } };
    expect(lease.status).toBe('conge_donne');
    expect(lease.notice.departureOn).toBe('2026-12-31');
  });

  it('n’enregistre rien quand la confirmation est annulée', async () => {
    const source = createDemoSource();
    const { user } = renderScreen(<CongeScreen />, { source });
    await fillAddress(user);
    await user.click(screen.getByRole('checkbox', { name: /Je confirme donner congé/ }));
    await user.click(screen.getByRole('button', { name: 'Envoyer mon congé' }));
    await user.click(await screen.findByRole('button', { name: 'Annuler', hidden: false }));
    expect(((await source.lease()) as { status: string }).status).not.toBe('conge_donne');
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('affiche l’erreur de la source quand l’envoi échoue', async () => {
    const source = createDemoSource();
    const giveNotice = vi.fn<LocataireSource['giveNotice']>().mockRejectedValue(new Error('Service indisponible'));
    const { user } = renderScreen(<CongeScreen />, { source: { ...source, giveNotice } });
    await fillAddress(user);
    await user.click(screen.getByRole('checkbox', { name: /Je confirme donner congé/ }));
    await user.click(screen.getByRole('button', { name: 'Envoyer mon congé' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: "Confirmer l'envoi du congé" }));
    expect(await within(dialog).findByText('Service indisponible')).toBeTruthy();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('indique qu’un congé a déjà été envoyé', async () => {
    const source = createDemoSource();
    await source.giveNotice({ departureOn: '2026-12-31', reason: '', ...NOTICE_ADDRESS, confirm: true });
    renderScreen(<CongeScreen />, { source });
    expect(await screen.findByText('Votre congé a été envoyé')).toBeTruthy();
  });
});

describe('États des lieux', () => {
  it('liste l’état des lieux d’entrée signé et la sortie à planifier', async () => {
    const { container } = renderScreen(<EtatsScreen />);
    expect(await screen.findByRole('heading', { level: 1, name: 'États des lieux' })).toBeTruthy();
    expect(await screen.findByRole('link', { name: 'Voir le détail' })).toBeTruthy();
    expect(screen.getByText('État des lieux de sortie à planifier')).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('propose la sortie une fois le congé donné', async () => {
    const source = createDemoSource();
    await source.giveNotice({ departureOn: '2026-12-31', reason: '', ...NOTICE_ADDRESS, confirm: true });
    renderScreen(<EtatsScreen />, { source });
    expect((await screen.findAllByText(/Proposé/)).length).toBeGreaterThan(0);
  });

  it('affiche le détail avec pièces, signatures et compteurs', async () => {
    const { container } = renderScreen(<EtatDetailScreen inspectionId="entree-2023-04-01" />);
    expect(await screen.findByRole('heading', { level: 1, name: "État des lieux d'entrée" })).toBeTruthy();
    expect(screen.getByText('Pièces et observations')).toBeTruthy();
    expect(screen.getByText('Relevés des compteurs')).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('signale un état des lieux inconnu', async () => {
    renderScreen(<EtatDetailScreen inspectionId="inconnu" />);
    expect(await screen.findByRole('heading', { name: /introuvable/i })).toBeTruthy();
  });
});

describe('Documents', () => {
  it('liste les 7 documents et reste accessible', async () => {
    const { container } = renderScreen(<DocumentsScreen />);
    const table = await screen.findByRole('table', { name: 'Documents' });
    expect(within(table).getAllByRole('row')).toHaveLength(8);
    await expectNoA11yViolations(container);
  });

  it('filtre par catégorie', async () => {
    const { user } = renderScreen(<DocumentsScreen />);
    await screen.findByRole('table', { name: 'Documents' });
    await user.click(screen.getByRole('tab', { name: /Quittances/ }));
    const table = await screen.findByRole('table', { name: 'Documents' });
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getByText("Quittance d'octobre 2026")).toBeTruthy();
  });

  it('recherche sans tenir compte des accents ni de la casse', async () => {
    const { user } = renderScreen(<DocumentsScreen />);
    await screen.findByRole('table', { name: 'Documents' });
    await user.type(screen.getByRole('searchbox', { name: 'Rechercher un document' }), 'ETAT');
    const table = await screen.findByRole('table', { name: 'Documents' });
    expect(within(table).getByText("État des lieux d'entrée")).toBeTruthy();
    expect(within(table).queryByText('Bail signé')).toBeNull();
  });

  it('indique l’absence de résultat', async () => {
    const { user } = renderScreen(<DocumentsScreen />);
    await screen.findByRole('table', { name: 'Documents' });
    await user.type(screen.getByRole('searchbox', { name: 'Rechercher un document' }), 'zzzz');
    expect(await screen.findByText('Aucun document ne correspond à votre recherche.')).toBeTruthy();
  });
});

describe('Assurance habitation', () => {
  it('signale l’attestation à renouveler et liste l’historique', async () => {
    const { container } = renderScreen(<AssuranceScreen />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Assurance habitation' })).toBeTruthy();
    expect(await screen.findByText('Attestation à renouveler avant le 31/03/2027')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Déposer une attestation' }).getAttribute('href')).toBe('/assurance/deposer');
    await expectNoA11yViolations(container);
  });
});

describe('Déposer une attestation', () => {
  const pdf = () => new File(['%PDF-1.4'], 'attestation.pdf', { type: 'application/pdf' });

  it('dépose une attestation valide, l’ajoute à la liste et revient à l’assurance', async () => {
    const source = createDemoSource();
    const { user, container } = renderScreen(<DepotScreen />, { source });
    await screen.findByRole('heading', { level: 1, name: 'Déposer une attestation' });
    await screen.findByLabelText('N° de contrat *');
    await expectNoA11yViolations(container);
    await user.upload(screen.getByLabelText('Déposer l’attestation d’assurance'), pdf());
    await user.type(screen.getByLabelText('N° de contrat *'), 'HAB-2027-48213');
    await user.click(screen.getByRole('button', { name: 'Envoyer l’attestation' }));
    await waitFor(() => { expect(nav.push).toHaveBeenCalledWith('/assurance'); });
    const attestations = (await source.attestations()) as { fileName: string; contractNumber: string }[];
    expect(attestations[0]).toMatchObject({ fileName: 'attestation.pdf', contractNumber: 'HAB-2027-48213' });
  });

  it('refuse l’envoi sans fichier ni numéro de contrat', async () => {
    const source = createDemoSource();
    const deposit = vi.spyOn(source, 'depositAttestation');
    const { user } = renderScreen(<DepotScreen />, { source });
    await user.click(await screen.findByRole('button', { name: 'Envoyer l’attestation' }));
    expect(await screen.findByText(/Le numéro de contrat comporte/)).toBeTruthy();
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    expect(deposit).not.toHaveBeenCalled();
  });

  it('refuse un fichier d’un type non accepté', async () => {
    renderScreen(<DepotScreen />);
    const input = await screen.findByLabelText('Déposer l’attestation d’assurance');
    fireEvent.change(input, { target: { files: [new File(['MZ'], 'virus.exe', { type: 'application/x-msdownload' })] } });
    expect(await screen.findByText(/n'est pas d'un format accepté/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retirer virus.exe' })).toBeNull();
  });

  it('refuse un fichier de plus de 10 Mo', async () => {
    renderScreen(<DepotScreen />);
    const input = await screen.findByLabelText('Déposer l’attestation d’assurance');
    const heavy = new File(['x'], 'lourd.pdf', { type: 'application/pdf' });
    Object.defineProperty(heavy, 'size', { value: 11 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [heavy] } });
    expect(await screen.findByText(/dépasse 10 Mo/)).toBeTruthy();
  });

  it('refuse une date de fin antérieure au début', async () => {
    const { user } = renderScreen(<DepotScreen />);
    await user.upload(await screen.findByLabelText('Déposer l’attestation d’assurance'), pdf());
    await user.type(screen.getByLabelText('N° de contrat *'), 'HAB-2027-48213');
    fireEvent.change(screen.getByLabelText('Date de fin *'), { target: { value: '2027-03-01' } });
    await user.click(screen.getByRole('button', { name: 'Envoyer l’attestation' }));
    expect(await screen.findByText('La date de fin doit suivre la date de début.')).toBeTruthy();
  });
});
