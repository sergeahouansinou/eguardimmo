import type { ReactElement } from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { dismissFlash } from '../../outils/kit';
import { renderScreen, screenProps } from '../shared/testing';
import { AbonnementPage } from './AbonnementPage';
import { ComptePage } from './ComptePage';
import { invoicesToCsv } from './InvoicesCard';
import { demoInvoices } from './demo';
import { limitsExceeded, planOf, priceLabel, priceOf } from './plans';
import { profileFormSchema } from './schemas';
import { demoProfile } from './demo';
import { CompteSourceProvider, PlanChangeError, createDemoCompteSource, resetCompteDemo } from './source';
import type { CompteSource } from './source';

beforeEach(() => {
  resetCompteDemo();
  dismissFlash();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function withSource(source: CompteSource, ui: ReactElement) {
  return renderScreen(<CompteSourceProvider source={source}>{ui}</CompteSourceProvider>);
}

describe('ComptePage', () => {
  it('affiche le profil de la maquette, la sécurité résumée et les liens', async () => {
    const { container } = renderScreen(<ComptePage {...screenProps} />);
    expect(await screen.findByDisplayValue('Awa')).toBeTruthy();
    expect(screen.getByDisplayValue('Diallo')).toBeTruthy();
    expect(screen.getByDisplayValue('02/06/1979')).toBeTruthy();
    expect(screen.getByPlaceholderText('Ex. : Dakar, Sénégal')).toBeTruthy();
    expect(screen.getByPlaceholderText('Ex. : SCI Les Tilleuls')).toBeTruthy();
    expect(screen.getByPlaceholderText('Ex. : 912 345 678')).toBeTruthy();
    expect(screen.getByPlaceholderText('Ex. : FR40912345678')).toBeTruthy();
    expect(screen.getByDisplayValue('+33 6 00 00 00 09')).toBeTruthy();
    expect(screen.getByDisplayValue('12 rue des Lilas, 75011 Paris')).toBeTruthy();
    const email = screen.getByLabelText<HTMLInputElement>('E-mail *');
    expect(email.readOnly).toBe(true);
    expect(email.value).toBe('awa.diallo@example.com');
    expect(screen.getByText('Se modifie dans Connexion et sécurité')).toBeTruthy();
    expect(screen.getByText('Modifié le 02/09/2026')).toBeTruthy();
    expect(screen.getByText('2 sessions actives')).toBeTruthy();
    expect(screen.getByText('Code par application')).toBeTruthy();
    const security = screen.getByRole('region', { name: 'Connexion et sécurité' });
    expect(within(security).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(['/compte/securite', '/compte/securite', '/compte/securite']);
    expect(screen.getByRole('link', { name: 'Exporter mes données' }).getAttribute('href')).toBe('/compte/export');
    expect(screen.getByRole('link', { name: 'Abonnement' }).getAttribute('href')).toBe('/compte/abonnement');
    await expectNoA11yViolations(container);
  });

  it('valide les champs obligatoires et le format du téléphone avec un message par champ', async () => {
    const source = createDemoCompteSource();
    withSource(source, <ComptePage {...screenProps} />);
    const first = await screen.findByDisplayValue('Awa');
    await userEvent.clear(first);
    await userEvent.clear(screen.getByDisplayValue('+33 6 00 00 00 09'));
    await userEvent.type(screen.getByLabelText('Téléphone mobile *'), 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(screen.getAllByText('Saisissez le prénom.').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Prénom *').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getAllByText(/Saisissez un numéro valide/).length).toBeGreaterThan(0);
    expect((await source.getProfile()).form.firstName).toBe('Awa');
  });

  it('exige la raison sociale pour une société et refuse un SIREN invalide', () => {
    const base = demoProfile.form;
    const societe = profileFormSchema.safeParse({ ...base, landlordType: 'societe' });
    expect(societe.success).toBe(false);
    expect(profileFormSchema.safeParse({ ...base, landlordType: 'societe', companyName: 'SCI Les Tilleuls', siren: '912 345 678', vatNumber: 'FR40912345678' }).success).toBe(true);
    expect(profileFormSchema.safeParse({ ...base, siren: '12' }).success).toBe(false);
    expect(profileFormSchema.safeParse({ ...base, birthDate: '31/02/1979' }).success).toBe(false);
    expect(profileFormSchema.safeParse({ ...base, birthDate: '01/01/2030' }).success).toBe(false);
  });

  it('enregistre les modifications dans la source avec un message de succès', async () => {
    const source = createDemoCompteSource();
    withSource(source, <ComptePage {...screenProps} />);
    const place = await screen.findByLabelText('Lieu de naissance');
    await userEvent.type(place, 'Dakar, Sénégal');
    const company = screen.getByLabelText('Raison sociale');
    await userEvent.type(company, 'SCI Les Tilleuls');
    await userEvent.type(screen.getByLabelText('SIREN'), '912345678');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Profil enregistré.')).toBeTruthy();
    const saved = (await source.getProfile()).form;
    expect(saved.birthPlace).toBe('Dakar, Sénégal');
    expect(saved.companyName).toBe('SCI Les Tilleuls');
    expect(saved.siren).toBe('912345678');
  });

  it('change le type de bailleur et annule les modifications', async () => {
    const source = createDemoCompteSource();
    withSource(source, <ComptePage {...screenProps} />);
    await userEvent.click(await screen.findByRole('combobox', { name: /Type de bailleur/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Société' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect((await screen.findAllByText('Saisissez la raison sociale.')).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByText('Saisissez la raison sociale.')).toBeNull();
    expect(screen.getByRole('combobox', { name: /Type de bailleur/ }).textContent).toContain('Particulier');
  });

  it('affiche une erreur de chargement', async () => {
    const source: CompteSource = { ...createDemoCompteSource(), getProfile: () => Promise.reject(new Error('panne')) };
    withSource(source, <ComptePage {...screenProps} />);
    expect(await screen.findByText("Le profil n'a pas pu être chargé")).toBeTruthy();
  });
});

describe('AbonnementPage', () => {
  it('affiche formule, offres, utilisation et factures de la maquette', async () => {
    const { container } = renderScreen(<AbonnementPage {...screenProps} />);
    expect(await screen.findByText('Essentiel, paiement mensuel')).toBeTruthy();
    expect(screen.getByText('Prochain prélèvement le 01/12/2026, Visa •••• 4242')).toBeTruthy();
    expect(screen.getAllByText(/9,90\s€/).length).toBeGreaterThan(0);
    const plans = screen.getByRole('region', { name: 'Changer de formule' });
    expect(within(plans).getByText('Découverte')).toBeTruthy();
    expect(within(plans).getByText('Actuelle')).toBeTruthy();
    expect(within(plans).getByText('24,90 €', { exact: false })).toBeTruthy();
    expect(within(plans).getByRole('button', { name: 'Formule actuelle' }).hasAttribute('disabled')).toBe(true);
    expect(within(plans).getByRole('button', { name: 'Passer à Pro' })).toBeTruthy();
    expect(within(plans).getByRole('button', { name: 'Passer à Découverte' })).toBeTruthy();
    const usage = screen.getByRole('region', { name: 'Utilisation' });
    expect(within(usage).getByText('11 / 15')).toBeTruthy();
    expect(within(usage).getByText('2 / 3')).toBeTruthy();
    expect(within(usage).getByText('8 / 10')).toBeTruthy();
    expect(within(usage).getByText('1,2 Go / 5 Go')).toBeTruthy();
    expect(within(usage).getByRole('img', { name: '73 % utilisé' })).toBeTruthy();
    expect(within(usage).getByRole('img', { name: '80 % utilisé' })).toBeTruthy();
    expect(await screen.findByText('FA-2026-0011')).toBeTruthy();
    expect(screen.getByText('FA-2026-0009')).toBeTruthy();
    expect(screen.queryByText('FA-2026-0008')).toBeNull();
    expect(screen.getByRole('button', { name: 'Aperçu du PDF de la facture FA-2026-0010' })).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("ne demande aucune donnée de carte : le dialogue du moyen de paiement n'a pas de champ et renvoie vers un lien externe sûr", async () => {
    renderScreen(<AbonnementPage {...screenProps} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Modifier le moyen de paiement' }));
    const dialog = await screen.findByRole('dialog', { name: 'Moyen de paiement' });
    expect(within(dialog).getByText('Visa se terminant par 4242')).toBeTruthy();
    expect(within(dialog).queryAllByRole('textbox')).toHaveLength(0);
    expect(dialog.querySelectorAll('input')).toHaveLength(0);
    const link = within(dialog).getByRole('link', { name: /Ouvrir l'espace sécurisé/ });
    expect(link.getAttribute('href')).toMatch(/^https:\/\//);
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('change de formule après confirmation et met à jour la source', async () => {
    const source = createDemoCompteSource();
    withSource(source, <AbonnementPage {...screenProps} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Passer à Pro' }));
    const dialog = await screen.findByRole('dialog', { name: 'Passer à la formule Pro ?' });
    expect(within(dialog).getByText(/24,90\s€ par mois\) prend effet immédiatement/)).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmer le changement' }));
    expect(await screen.findByText('Formule Pro activée.')).toBeTruthy();
    expect((await source.getSubscription()).planId).toBe('pro');
    expect(await screen.findByText('Pro, paiement mensuel')).toBeTruthy();
    expect(screen.getByText('11 / illimité')).toBeTruthy();
  });

  it("n'applique pas le changement si on annule dans le dialogue", async () => {
    const source = createDemoCompteSource();
    withSource(source, <AbonnementPage {...screenProps} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Passer à Pro' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Annuler' }));
    expect((await source.getSubscription()).planId).toBe('essentiel');
  });

  it("refuse un passage à Découverte quand l'utilisation dépasse les limites", async () => {
    const source = createDemoCompteSource();
    withSource(source, <AbonnementPage {...screenProps} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Passer à Découverte' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/11 lots utilisés pour 2 inclus/)).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmer le changement' }));
    expect(await screen.findByText(/Passage impossible : 11 lots utilisés pour 2 inclus/)).toBeTruthy();
    expect((await source.getSubscription()).planId).toBe('essentiel');
    await expect(source.changePlan({ planId: 'decouverte', billing: 'mensuel' })).rejects.toBeInstanceOf(PlanChangeError);
  });

  it('bascule en paiement annuel avec confirmation et affiche le prix annuel', async () => {
    const source = createDemoCompteSource();
    withSource(source, <AbonnementPage {...screenProps} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Passer en annuel' }));
    const dialog = await screen.findByRole('dialog', { name: 'Passer en paiement annuel ?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmer' }));
    expect(await screen.findByText('Essentiel, paiement annuel')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Passer en mensuel' })).toBeTruthy();
    expect((await source.getSubscription()).billing).toBe('annuel');
  });

  it('affiche les prix annuels dans la comparaison et propose Essentiel annuel', async () => {
    renderScreen(<AbonnementPage {...screenProps} />);
    const plans = await screen.findByRole('region', { name: 'Changer de formule' });
    await userEvent.click(within(plans).getByRole('radio', { name: 'Annuel, 2 mois offerts' }));
    expect(within(plans).getByText(/99\s€/)).toBeTruthy();
    expect(within(plans).getByText(/249\s€/)).toBeTruthy();
    expect(within(plans).getAllByText('par an')).toHaveLength(2);
    expect(within(plans).queryByText('Actuelle')).toBeNull();
    expect(within(plans).getByRole('button', { name: 'Passer à Essentiel' })).toBeTruthy();
  });

  it('résilie avec confirmation puis annule la résiliation', async () => {
    const source = createDemoCompteSource();
    withSource(source, <AbonnementPage {...screenProps} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Résilier la formule' }));
    const dialog = await screen.findByRole('dialog', { name: 'Résilier la formule ?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Résilier la formule' }));
    expect(await screen.findByText('Résiliation programmée au 01/12/2026.')).toBeTruthy();
    expect((await source.getSubscription()).cancelAt).toBe('2026-12-01');
    await userEvent.click(await screen.findByRole('button', { name: 'Annuler la résiliation' }));
    expect(await screen.findByText('Résiliation annulée : votre formule continue.')).toBeTruthy();
    expect((await source.getSubscription()).cancelAt).toBeNull();
  });

  it("déroule toutes les factures avec « Tout voir » et ouvre l'aperçu imprimable", async () => {
    const print = vi.fn();
    vi.stubGlobal('print', print);
    renderScreen(<AbonnementPage {...screenProps} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Tout voir' }));
    expect(screen.getByText('FA-2026-0001')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Aperçu du PDF de la facture FA-2026-0001' }));
    const dialog = await screen.findByRole('dialog', { name: 'Facture FA-2026-0001' });
    expect(within(dialog).getByText('Émise le 01/01/2026')).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('button', { name: /Imprimer/ }));
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('télécharge une facture en CSV côté client', async () => {
    const created: Blob[] = [];
    vi.stubGlobal('URL', { createObjectURL: (blob: Blob) => { created.push(blob); return 'blob:facture'; }, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderScreen(<AbonnementPage {...screenProps} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Aperçu du PDF de la facture FA-2026-0011' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Télécharger en CSV' }));
    expect(click).toHaveBeenCalledTimes(1);
    const text = await created[0]?.text();
    expect(text).toContain('FA-2026-0011;01/11/2026;Essentiel, mensuel;');
    expect(text).not.toContain('FA-2026-0010');
  });

  it('affiche une erreur de chargement de l’abonnement', async () => {
    const source: CompteSource = { ...createDemoCompteSource(), getSubscription: () => Promise.reject(new Error('panne')) };
    withSource(source, <AbonnementPage {...screenProps} />);
    expect(await screen.findByText("L'abonnement n'a pas pu être chargé")).toBeTruthy();
  });

  it('affiche une erreur propre aux factures sans casser le reste', async () => {
    const source: CompteSource = { ...createDemoCompteSource(), listInvoices: () => Promise.reject(new Error('panne')) };
    withSource(source, <AbonnementPage {...screenProps} />);
    expect(await screen.findByText("Les factures n'ont pas pu être chargées")).toBeTruthy();
    expect(screen.getByText('Essentiel, paiement mensuel')).toBeTruthy();
  });
});

describe('formules', () => {
  it('calcule les prix en unités mineures, sans flottant', () => {
    expect(priceOf(planOf('essentiel'), 'mensuel')).toBe(990);
    expect(priceOf(planOf('essentiel'), 'annuel')).toBe(9900);
    expect(priceOf(planOf('pro'), 'annuel')).toBe(24900);
    expect(priceLabel(0, 'mensuel').unit).toBe('pour toujours');
  });

  it('détecte les dépassements de limites', () => {
    const usage = { lots: 11, users: 2, signatures: 8, storageMb: 1_200 };
    expect(limitsExceeded(planOf('essentiel'), usage)).toEqual([]);
    expect(limitsExceeded(planOf('pro'), usage)).toEqual([]);
    expect(limitsExceeded(planOf('decouverte'), usage)).toHaveLength(4);
  });

  it('exporte les factures en CSV avec montants formatés', () => {
    const csv = invoicesToCsv(demoInvoices.slice(0, 1));
    expect(csv).toContain('Numéro;Date;Formule;Montant TTC;Statut');
    expect(csv).toMatch(/FA-2026-0011;01\/11\/2026;Essentiel, mensuel;9,90\s€;Payée/);
  });
});
