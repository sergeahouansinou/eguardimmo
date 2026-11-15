import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { dismissFlash } from './flash';
import { GrandLivrePage } from './GrandLivrePage';
import { RelancePage } from './relance/RelancePage';
import { createDemoFinancesSource } from './source';
import { demoWithRenewalLease } from './testing/data';
import { norm, renderFinances, snapshotOf } from './testing/render';

const KOFFI = 'ech-2026-11-koffi-adjovi';
const IBRAHIM = 'ech-2026-11-ibrahim-yao';

afterEach(() => {
  dismissFlash();
  vi.restoreAllMocks();
});

describe('GrandLivrePage', () => {
  it('affiche les écritures du locataire, les totaux et le solde cumulé', async () => {
    const { container } = renderFinances((props) => <GrandLivrePage {...props} echeanceId={KOFFI} />);
    expect(await screen.findByRole('heading', { name: 'Grand livre, Koffi Adjovi' })).toBeTruthy();
    const table = screen.getByRole('table', { name: 'Écritures' });
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(2);
    expect(norm(table.textContent)).toContain('Loyer novembre 2026');
    const totals = screen.getByRole('region', { name: 'Totaux du grand livre' });
    expect(norm(totals.textContent)).toContain('Solde dû');
    await expectNoA11yViolations(container);
  });

  it('filtre par bail quand le locataire en a plusieurs', async () => {
    renderFinances((props) => <GrandLivrePage {...props} echeanceId="ech-2026-11-awa-traore" />, createDemoFinancesSource({ seed: demoWithRenewalLease() }));
    await screen.findByRole('table', { name: 'Écritures' });
    await userEvent.click(screen.getByRole('combobox', { name: /^Bail/ }));
    await userEvent.click(await screen.findByRole('option', { name: /BL-2026-0018/ }));
    expect(await screen.findByText('Aucune écriture')).toBeTruthy();
  });

  it('exporte le grand livre en CSV', async () => {
    const created: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      if (blob instanceof Blob) created.push(blob);
      return 'blob:test';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderFinances((props) => <GrandLivrePage {...props} echeanceId={KOFFI} />);
    await screen.findByRole('table', { name: 'Écritures' });
    await userEvent.click(screen.getByRole('button', { name: 'Exporter en CSV' }));
    expect(created).toHaveLength(1);
    const text = await created[0]?.text();
    expect(text).toContain('Date;Type;Pièce;Libellé;Bien;Débit;Crédit;Solde');
    expect(text).toContain('Loyer novembre 2026');
    expect(text).toContain(';Total;');
  });

  it('mène à la relance et au dossier de recouvrement', async () => {
    const { navigate } = renderFinances((props) => <GrandLivrePage {...props} echeanceId={KOFFI} />);
    await screen.findByRole('table', { name: 'Écritures' });
    await userEvent.click(screen.getByRole('button', { name: 'Préparer une relance' }));
    expect(navigate).toHaveBeenCalledWith(`/finances/impayes/${KOFFI}/relance`);
    await userEvent.click(screen.getByRole('button', { name: 'Dossier de recouvrement' }));
    expect(navigate).toHaveBeenCalledWith(`/finances/impayes/${KOFFI}`);
  });

  it('signale un impayé introuvable et une erreur de chargement', async () => {
    const first = renderFinances((props) => <GrandLivrePage {...props} echeanceId="inconnue" />);
    expect(await screen.findByText('Impayé introuvable')).toBeTruthy();
    first.unmount();
    const source = createDemoFinancesSource();
    renderFinances((props) => <GrandLivrePage {...props} echeanceId={KOFFI} />, { ...source, snapshot: () => Promise.reject(new Error('panne')) });
    expect(await screen.findByText('Le grand livre n’a pas pu être chargé')).toBeTruthy();
  });
});

describe('RelancePage', () => {
  it('prépare une relance amiable avec aperçu A4 et grand livre joint en page 2', async () => {
    const { container } = renderFinances((props) => <RelancePage {...props} echeanceId={IBRAHIM} niveau="amiable" />);
    expect(await screen.findByRole('heading', { name: 'Relance du 13/11/2026' })).toBeTruthy();
    const letter = screen.getByRole('article', { name: 'Page 1 sur 2' });
    expect(norm(letter.textContent)).toContain('Madame, Monsieur,');
    expect(norm(letter.textContent)).toContain('Ibrahim Yao');
    expect(norm(letter.textContent)).toContain('60 €');
    expect(letter.hasAttribute('data-paper')).toBe(true);
    expect(screen.getByText('Page 1 / 2')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Page suivante' }));
    expect(screen.getByText('Page 2 / 2')).toBeTruthy();
    expect(norm(screen.getByRole('table', { name: 'Grand livre joint', hidden: true }).textContent)).toContain('Solde dû');
    await expectNoA11yViolations(container);
  });

  it('change de niveau : la mise en demeure passe en recommandé et change le courrier', async () => {
    renderFinances((props) => <RelancePage {...props} echeanceId={IBRAHIM} niveau="amiable" />);
    await screen.findByRole('heading', { name: 'Relance du 13/11/2026' });
    await userEvent.click(screen.getByRole('combobox', { name: /^Niveau/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Mise en demeure' }));
    expect(norm(screen.getByRole('article', { name: /Page 1/ }).textContent)).toContain('mettons en demeure');
    expect(screen.getByRole('switch', { name: 'Lettre recommandée' }).getAttribute('aria-checked')).toBe('true');
    expect(norm(screen.getByText('Lettre recommandée avec AR').textContent)).toBeTruthy();
  });

  it('modifie le texte, valide la longueur puis rétablit le modèle', async () => {
    renderFinances((props) => <RelancePage {...props} echeanceId={IBRAHIM} niveau="amiable" />);
    await screen.findByRole('heading', { name: 'Relance du 13/11/2026' });
    await userEvent.click(screen.getByRole('button', { name: 'Modifier le texte' }));
    const field = screen.getByRole('textbox', { name: 'Corps du courrier' });
    await userEvent.clear(field);
    await userEvent.type(field, 'Trop court');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer la relance' }));
    expect(await screen.findByText('Le texte doit comporter au moins 20 caractères.')).toBeTruthy();
    await userEvent.clear(field);
    await userEvent.type(field, 'Texte personnalisé de la relance du jour.');
    expect(norm(screen.getByRole('article', { name: /Page 1/ }).textContent)).toContain('Texte personnalisé');
    await userEvent.click(screen.getByRole('button', { name: 'Rétablir le texte du modèle' }));
    expect(norm(screen.getByRole('article', { name: /Page 1/ }).textContent)).toContain('Sauf erreur de notre part');
  });

  it('envoie la relance : consignée au dossier de recouvrement puis redirige', async () => {
    const { source, navigate } = renderFinances((props) => <RelancePage {...props} echeanceId={IBRAHIM} niveau="amiable" />);
    await screen.findByRole('heading', { name: 'Relance du 13/11/2026' });
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer la relance' }));
    await waitFor(() => { expect(navigate).toHaveBeenCalledWith(`/finances/impayes/${IBRAHIM}`); });
    const data = await snapshotOf(source);
    const dossier = data.dossiers.find((item) => item.creances.some((creance) => creance.refId === IBRAHIM));
    expect(dossier?.actes).toHaveLength(1);
    expect(dossier?.actes[0]?.libelle).toContain('Relance amiable de loyer par e-mail, grand livre joint');
    expect(data.relances.filter((relance) => relance.echeanceId === IBRAHIM)).toHaveLength(2);
  });

  it('suggère la deuxième relance après une première relance, sauf niveau imposé', async () => {
    renderFinances((props) => <RelancePage {...props} echeanceId={IBRAHIM} />);
    await screen.findByRole('heading', { name: 'Relance du 13/11/2026' });
    expect(screen.getByText('Deuxième relance de loyer', { selector: 'dd' })).toBeTruthy();
  });

  it('propose le niveau mise en demeure quand le dossier est déjà en recommandé', async () => {
    renderFinances((props) => <RelancePage {...props} echeanceId={KOFFI} />);
    await screen.findByRole('heading', { name: 'Relance du 13/11/2026' });
    expect(screen.getByText('Mise en demeure de payer', { selector: 'dd' })).toBeTruthy();
  });

  it('refuse l’envoi pour une échéance soldée', async () => {
    renderFinances((props) => <RelancePage {...props} echeanceId="ech-2026-11-nadege-sossou" />);
    expect(await screen.findByText('Cette échéance est soldée')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Envoyer la relance' }).hasAttribute('disabled')).toBe(true);
  });

  it('affiche l’erreur de la source sans rediriger', async () => {
    const source = createDemoFinancesSource();
    const { navigate } = renderFinances((props) => <RelancePage {...props} echeanceId={IBRAHIM} niveau="amiable" />, { ...source, dispatch: () => Promise.reject(new Error('Envoi impossible')) });
    await screen.findByRole('heading', { name: 'Relance du 13/11/2026' });
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer la relance' }));
    expect(await screen.findByText('Envoi impossible')).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('signale un impayé introuvable', async () => {
    renderFinances((props) => <RelancePage {...props} echeanceId="inconnue" />);
    expect(await screen.findByText('Impayé introuvable')).toBeTruthy();
  });
});
