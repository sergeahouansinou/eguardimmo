import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { dismissFlash } from '../../outils/kit';
import { renderScreen, screenProps } from '../shared/testing';
import { ReglagesDocumentsPage } from './DocumentsPage';
import { ReglagesPage } from './GeneralPage';
import { ReglagesMenuPage } from './MenuPage';
import { ReglagesNotificationsPage } from './NotificationsPage';
import { renderNumber } from './numbering';
import { documentsSchema } from './schemas';
import { demoDocuments } from './demo';
import { ReglagesSourceProvider, createDemoReglagesSource, resetReglagesDemo } from './source';
import type { ReglagesSource } from './source';

beforeEach(() => {
  resetReglagesDemo();
  dismissFlash();
  document.documentElement.removeAttribute('data-theme');
  window.localStorage.clear();
});

const failing: ReglagesSource = {
  ...createDemoReglagesSource(),
  getGeneral: () => Promise.reject(new Error('panne')),
  getDocuments: () => Promise.reject(new Error('panne')),
  getMenu: () => Promise.reject(new Error('panne')),
  getNotifications: () => Promise.reject(new Error('panne')),
};

describe('ReglagesPage (général)', () => {
  it('affiche les réglages de la maquette et la navigation des sections', async () => {
    const { container } = renderScreen(<ReglagesPage {...screenProps} />);
    expect(await screen.findByRole('combobox', { name: /Affichage des noms/ })).toBeTruthy();
    expect(screen.getByText('Prénom Nom')).toBeTruthy();
    expect(screen.getByText('Français')).toBeTruthy();
    expect(screen.getByText('Euro (€)')).toBeTruthy();
    expect(screen.getByText('jj/mm/aaaa')).toBeTruthy();
    expect(screen.getByText('Europe/Paris (UTC+1)')).toBeTruthy();
    expect(screen.getByText('Mètres carrés (m²)')).toBeTruthy();
    expect(screen.getByText('1er janvier')).toBeTruthy();
    expect(screen.getByText('Revenus fonciers, réel')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Mode expert' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('switch', { name: 'Aide à la saisie' }).getAttribute('aria-checked')).toBe('true');
    const nav = screen.getByRole('navigation', { name: 'Sections des réglages' });
    expect(within(nav).getByRole('link', { name: 'Général' }).getAttribute('aria-current')).toBe('page');
    expect(within(nav).getByRole('link', { name: 'Documents et quittances' }).getAttribute('href')).toBe('/reglages/documents');
    expect(within(nav).getByRole('link', { name: 'Menu et rubriques' }).getAttribute('href')).toBe('/reglages/menu');
    expect(within(nav).getByRole('link', { name: 'Notifications' }).getAttribute('href')).toBe('/reglages/notifications');
    expect(within(nav).getByRole('link', { name: 'Mon compte' }).getAttribute('href')).toBe('/compte');
    expect(within(nav).getByRole('link', { name: 'Abonnement' }).getAttribute('href')).toBe('/compte/abonnement');
    await expectNoA11yViolations(container);
  });

  it('enregistre une modification, affiche le succès puis la relit depuis la source', async () => {
    const source = createDemoReglagesSource();
    renderScreen(
      <ReglagesSourceProvider source={source}>
        <ReglagesPage {...screenProps} />
      </ReglagesSourceProvider>,
    );
    await userEvent.click(await screen.findByRole('combobox', { name: /Devise par défaut/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Franc CFA (FCFA)' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Mode expert' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Réglages généraux enregistrés.')).toBeTruthy();
    const saved = await source.getGeneral();
    expect(saved.currency).toBe('XOF');
    expect(saved.expertMode).toBe(true);
  });

  it('annule les modifications non enregistrées', async () => {
    const source = createDemoReglagesSource();
    renderScreen(
      <ReglagesSourceProvider source={source}>
        <ReglagesPage {...screenProps} />
      </ReglagesSourceProvider>,
    );
    const toggle = await screen.findByRole('switch', { name: 'Mode expert' });
    await userEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.getByRole('switch', { name: 'Mode expert' }).getAttribute('aria-checked')).toBe('false');
    expect((await source.getGeneral()).expertMode).toBe(false);
  });

  it("applique l'apparence immédiatement via le thème partagé", async () => {
    renderScreen(<ReglagesPage {...screenProps} />);
    await userEvent.click(await screen.findByRole('radio', { name: 'Sombre' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    await userEvent.click(screen.getByRole('radio', { name: 'Clair' }));
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it("signale l'échec d'enregistrement", async () => {
    const source: ReglagesSource = { ...createDemoReglagesSource(), saveGeneral: () => Promise.reject(new Error('panne')) };
    renderScreen(
      <ReglagesSourceProvider source={source}>
        <ReglagesPage {...screenProps} />
      </ReglagesSourceProvider>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText("Les réglages n'ont pas pu être enregistrés")).toBeTruthy();
  });

  it('affiche une erreur de chargement avec réessai', async () => {
    renderScreen(
      <ReglagesSourceProvider source={failing}>
        <ReglagesPage {...screenProps} />
      </ReglagesSourceProvider>,
    );
    expect(await screen.findByText("Les réglages n'ont pas pu être chargés")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });
});

describe('ReglagesDocumentsPage', () => {
  it('affiche numérotation, contenu, envoi et aperçu de la maquette', async () => {
    const { container } = renderScreen(<ReglagesDocumentsPage {...screenProps} />);
    expect(await screen.findByText('Prochain numéro : QT-2026-0413')).toBeTruthy();
    expect(screen.getByText('Prochain numéro : AV-2026-1201-A1')).toBeTruthy();
    expect(screen.getByDisplayValue('QT-{année}-{numéro}')).toBeTruthy();
    expect(screen.getByDisplayValue('AV-{année}-{mois}-{lot}')).toBeTruthy();
    expect(screen.getByText('logo-tilleuls.png')).toBeTruthy();
    expect(screen.getByText('signature.png')).toBeTruthy();
    expect(screen.getByPlaceholderText('Ex. : SCI Les Tilleuls, SIREN 912 345 678')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Code QR de vérification' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('switch', { name: 'Solde du locataire' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('switch', { name: 'Détail des charges' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('Le 25 du mois précédent')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Copie à mon adresse' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('button', { name: 'Aperçu du PDF' })).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('refuse un format de numérotation sans {numéro} et affiche l’erreur du champ', async () => {
    const source = createDemoReglagesSource();
    renderScreen(
      <ReglagesSourceProvider source={source}>
        <ReglagesDocumentsPage {...screenProps} />
      </ReglagesSourceProvider>,
    );
    const field = await screen.findByDisplayValue('QT-{année}-{numéro}');
    await userEvent.clear(field);
    await userEvent.type(field, 'QUITTANCE');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findAllByText('Le format doit contenir la variable {numéro}.')).not.toHaveLength(0);
    expect((await source.getDocuments()).quittanceFormat).toBe('QT-{année}-{numéro}');
  });

  it('met à jour le prochain numéro et enregistre', async () => {
    const source = createDemoReglagesSource();
    renderScreen(
      <ReglagesSourceProvider source={source}>
        <ReglagesDocumentsPage {...screenProps} />
      </ReglagesSourceProvider>,
    );
    const field = await screen.findByDisplayValue('QT-{année}-{numéro}');
    await userEvent.clear(field);
    await userEvent.type(field, 'REC-{{numéro}');
    expect(screen.getByText('Prochain numéro : REC-0413')).toBeTruthy();
    await userEvent.click(screen.getByRole('switch', { name: 'Détail des charges' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Réglages des documents enregistrés.')).toBeTruthy();
    const saved = await source.getDocuments();
    expect(saved.quittanceFormat).toBe('REC-{numéro}');
    expect(saved.chargesDetail).toBe(true);
  });

  it('remplace le logo par un PNG valide et refuse un fichier non image', async () => {
    renderScreen(<ReglagesDocumentsPage {...screenProps} />);
    const input = await screen.findByLabelText('Fichier du logo');
    await userEvent.upload(input, new File(['x'], 'nouveau-logo.png', { type: 'image/png' }));
    expect(await screen.findByText('nouveau-logo.png')).toBeTruthy();
    await userEvent.upload(screen.getByLabelText('Fichier du logo'), new File(['x'], 'script.exe', { type: 'application/octet-stream' }), {
      applyAccept: false,
    });
    expect(await screen.findByText('Format refusé : PNG ou JPG uniquement.')).toBeTruthy();
    expect(screen.getByText('nouveau-logo.png')).toBeTruthy();
  });

  it('refuse un fichier de plus de 2 Mo', async () => {
    renderScreen(<ReglagesDocumentsPage {...screenProps} />);
    const input = await screen.findByLabelText('Fichier de la signature');
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'grosse.png', { type: 'image/png' });
    await userEvent.upload(input, big);
    expect(await screen.findByText('Fichier trop lourd : 2 Mo maximum.')).toBeTruthy();
    expect(screen.getByText('signature.png')).toBeTruthy();
  });

  it("ouvre l'aperçu imprimable du PDF avec le numéro et les réglages en cours", async () => {
    renderScreen(<ReglagesDocumentsPage {...screenProps} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Aperçu du PDF' }));
    const dialog = await screen.findByRole('dialog', { name: 'Aperçu de la quittance' });
    expect(within(dialog).getByText('N° QT-2026-0413')).toBeTruthy();
    expect(within(dialog).getByRole('img', { name: 'Code QR de vérification' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: /Imprimer/ })).toBeTruthy();
    expect(within(dialog).getByText('Pied de page par défaut')).toBeTruthy();
  });

  it('bascule l’aperçu sur l’avis d’échéance', async () => {
    renderScreen(<ReglagesDocumentsPage {...screenProps} />);
    await userEvent.click(await screen.findByRole('combobox', { name: /Document à prévisualiser/ }));
    await userEvent.click(await screen.findByRole('option', { name: "Avis d'échéance" }));
    await userEvent.click(screen.getByRole('button', { name: 'Aperçu du PDF' }));
    const dialog = await screen.findByRole('dialog', { name: "Aperçu de l'avis d'échéance" });
    expect(within(dialog).getByText('N° AV-2026-1201-A1')).toBeTruthy();
  });

  it('désactive le jour d’envoi quand les avis automatiques sont coupés', async () => {
    renderScreen(<ReglagesDocumentsPage {...screenProps} />);
    await userEvent.click(await screen.findByRole('switch', { name: "Envoi automatique des avis d'échéance" }));
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /Jour d'envoi/ }).hasAttribute('disabled')).toBe(true);
    });
  });
});

describe('numérotation', () => {
  it('remplace les variables connues et laisse les autres', () => {
    expect(renderNumber('X-{année}-{numéro}-{inconnu}', { '{année}': '2026', '{numéro}': '0001' })).toBe('X-2026-0001-{inconnu}');
  });

  it('refuse une variable inconnue côté schéma', () => {
    expect(documentsSchema.safeParse({ ...demoDocuments, avisFormat: 'AV-{numéro}-{x}' }).success).toBe(false);
    expect(documentsSchema.safeParse({ ...demoDocuments, avisFormat: 'AV-{année}' }).success).toBe(false);
    expect(documentsSchema.safeParse(demoDocuments).success).toBe(true);
  });
});

describe('ReglagesMenuPage', () => {
  it('affiche les trois groupes avec leurs compteurs', async () => {
    const { container } = renderScreen(<ReglagesMenuPage {...screenProps} />);
    expect(await screen.findByRole('region', { name: 'Principal' })).toBeTruthy();
    expect(screen.getByText('6 sur 6')).toBeTruthy();
    expect(screen.getByText('4 sur 5')).toBeTruthy();
    expect(screen.getByText('4 sur 6')).toBeTruthy();
    expect(screen.getAllByText('Toujours affiché')).toHaveLength(6);
    expect(screen.getByRole('switch', { name: 'Candidats masqué' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('switch', { name: 'Messages affiché' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText("Masquer une rubrique la retire du menu. Aucune donnée n'est supprimée.")).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Principal' })).getByText('Accueil')).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('masque une rubrique, met à jour le compteur et persiste dans la source', async () => {
    const source = createDemoReglagesSource();
    renderScreen(
      <ReglagesSourceProvider source={source}>
        <ReglagesMenuPage {...screenProps} />
      </ReglagesSourceProvider>,
    );
    await userEvent.click(await screen.findByRole('switch', { name: 'Messages affiché' }));
    expect(screen.getByText('3 sur 5')).toBeTruthy();
    await userEvent.click(screen.getByRole('combobox', { name: /Page d'accueil/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Finances' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Menu et rubriques enregistrés.')).toBeTruthy();
    const saved = await source.getMenu();
    expect(saved.modules.find((entry) => entry.id === 'messages')?.visible).toBe(false);
    expect(saved.homePage).toBe('finances');
  });
});

describe('ReglagesNotificationsPage', () => {
  it('affiche la matrice de 12 événements et les réglages annexes', async () => {
    const { container } = renderScreen(<ReglagesNotificationsPage {...screenProps} />);
    expect(await screen.findByText('12 événements')).toBeTruthy();
    for (const group of ['Finances', 'Locataires et baux', 'Suivi', 'Documents']) {
      expect(screen.getAllByText(group).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Loyer en retard, E-mail' }).checked).toBe(true);
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Paiement reçu, E-mail' }).checked).toBe(false);
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Paiement reçu, Application' }).checked).toBe(true);
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Signature terminée, Mobile' }).checked).toBe(false);
    expect(screen.getByText('Chaque lundi')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Heures de silence' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('switch', { name: 'Lettre mensuelle' }).getAttribute('aria-checked')).toBe('false');
    await expectNoA11yViolations(container);
  });

  it('modifie un canal et un interrupteur puis persiste dans la source', async () => {
    const source = createDemoReglagesSource();
    renderScreen(
      <ReglagesSourceProvider source={source}>
        <ReglagesNotificationsPage {...screenProps} />
      </ReglagesSourceProvider>,
    );
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Paiement reçu, E-mail' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Offres partenaires' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Réglages des notifications enregistrés.')).toBeTruthy();
    const saved = await source.getNotifications();
    expect(saved.events.find((entry) => entry.id === 'paiement-recu')?.channels.email).toBe(true);
    expect(saved.partnerOffers).toBe(true);
  });
});
