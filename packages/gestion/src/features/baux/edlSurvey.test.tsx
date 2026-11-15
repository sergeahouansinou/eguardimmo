import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { FROZEN_NOW, at, norm, renderLot } from '../../../test/lots';
import type { Signature } from '../courriers/schemas';
import { EtatLieuxPage } from './EtatLieuxPage';
import { EtatsLieuxPage } from './EtatsLieuxPage';
import type { Edl } from './schemas';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN_NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

const edlsOf = async (source: { edls: () => Promise<unknown> }) => (await source.edls()) as Edl[];
const signaturesOf = async (source: { signatures: () => Promise<unknown> }) => (await source.signatures()) as Signature[];

async function openRoom(room: string) {
  await userEvent.click(await screen.findByRole('button', { name: new RegExp(`^${room}\\s*\\d+/\\d+`) }));
  return screen.findByRole('region', { name: `Relevé, ${room}` });
}

async function setState(room: string, element: string, label: string) {
  await openRoom(room);
  await userEvent.click(screen.getByRole('combobox', { name: new RegExp(`^${room}, ${element}, état`) }));
  await userEvent.click(await screen.findByRole('option', { name: label }));
}

describe('Relevé pièce par pièce', () => {
  it('affiche une pièce par section avec les éléments à contrôler', async () => {
    const { container } = renderLot(<EtatLieuxPage id="edl-2026-006" />);
    expect(await screen.findByRole('region', { name: 'Relevé, Entrée' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Relevé, Séjour' })).toBeNull();
    for (const room of ['Séjour', 'Cuisine', 'Salle de bains']) expect(await openRoom(room)).toBeTruthy();
    expect(screen.getByText('0 sur 35 contrôlés')).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('refuse une dégradation sans observation ni photo', async () => {
    const { sources } = renderLot(<EtatLieuxPage id="edl-2026-006" />);
    await screen.findByRole('region', { name: 'Relevé, Entrée' });
    await setState('Séjour', 'Murs', 'Dégradé');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le relevé' }));
    expect(await screen.findByText('Séjour, Murs : précisez l’anomalie ou joignez une photo')).toBeTruthy();
    expect(at(await edlsOf(sources.baux), 2).survey).toEqual([]);
  });

  it('enregistre le relevé avec observation et photo, puis le montre dans la synthèse', async () => {
    const { sources } = renderLot(<EtatLieuxPage id="edl-2026-006" />);
    await screen.findByRole('region', { name: 'Relevé, Entrée' });
    await setState('Séjour', 'Murs', 'Dégradé');
    await userEvent.type(screen.getByRole('textbox', { name: 'Séjour, Murs, observations' }), 'Trace d’humidité');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter une photo, Séjour, Murs' }));
    await setState('Cuisine', 'Sol', 'Bon état');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le relevé' }));
    await waitFor(async () => {
      const saved = (await edlsOf(sources.baux)).find((edl) => edl.id === 'edl-2026-006');
      const walls = saved?.survey.find((room) => room.room === 'Séjour')?.elements.find((element) => element.id === 'murs');
      expect(walls).toMatchObject({ state: 'degrade', note: 'Trace d’humidité', photos: ['sejour-murs-1.jpg'] });
    });
    expect(await screen.findByText('Séjour, Murs : dégradé, Trace d’humidité')).toBeTruthy();
    expect(screen.getByText('2 éléments contrôlés')).toBeTruthy();
  });

  it('retire une photo avant l’enregistrement', async () => {
    renderLot(<EtatLieuxPage id="edl-2026-006" />);
    await openRoom('Séjour');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter une photo, Séjour, Sol' }));
    await userEvent.click(screen.getByRole('button', { name: 'Retirer la photo sejour-sol-1.jpg' }));
    expect(screen.queryByText('sejour-sol-1.jpg')).toBeNull();
  });

  it('montre le relevé en lecture seule pour un état des lieux signé', async () => {
    const { container } = renderLot(<EtatLieuxPage id="edl-2023-002" />);
    const section = await openRoom('Séjour');
    expect(within(section).getAllByText('Bon état').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Enregistrer le relevé' })).toBeNull();
    await expectNoA11yViolations(container);
  });

  it('refuse l’enregistrement d’un relevé sur un état signé côté source', async () => {
    const { sources } = renderLot(<EtatLieuxPage id="edl-2023-002" />);
    await screen.findByRole('region', { name: 'Relevé, Entrée' });
    await expect(sources.baux.saveEdlSurvey('edl-2023-002', [])).rejects.toThrow('Un état des lieux signé ne peut plus être modifié.');
  });

  it('refuse une pièce non contrôlée dans l’état des lieux', async () => {
    const { sources } = renderLot(<EtatLieuxPage id="edl-2026-006" />);
    await expect(sources.baux.saveEdlSurvey('edl-2026-006', [{ room: 'Garage', elements: [] }])).rejects.toThrow('La pièce « Garage » n’est pas contrôlée dans cet état des lieux.');
  });
});

describe('Actions de l’état des lieux', () => {
  it('prépare l’état de sortie depuis l’entrée et refuse un doublon', async () => {
    const { sources, push } = renderLot(<EtatLieuxPage id="edl-2023-002" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Préparer l’état de sortie' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/baux/etats-des-lieux/edl-2026-008'); });
    const created = (await edlsOf(sources.baux)).find((edl) => edl.id === 'edl-2026-008');
    expect(created).toMatchObject({ type: 'sortie', unitId: 'apt-a1', tenantId: 'koffi-adjovi', status: 'a_planifier', date: null });
    expect(created?.survey.every((room) => room.elements.every((element) => element.state === 'non_controle'))).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Préparer l’état de sortie' }));
    expect(await screen.findByText('Un état des lieux de sortie est déjà prévu pour ce bien.')).toBeTruthy();
  });

  it('n’offre pas l’état de sortie sur un état de sortie', async () => {
    renderLot(<EtatLieuxPage id="edl-2026-007" />);
    await screen.findByRole('heading', { name: /EDL-2026-007/ });
    expect(screen.queryByRole('button', { name: 'Préparer l’état de sortie' })).toBeNull();
  });

  it('envoie l’état des lieux en signature et crée la demande avec locataire et bailleur', async () => {
    const { sources, push } = renderLot(<EtatLieuxPage id="edl-2026-006" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Envoyer pour signature' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/documents/signatures'); });
    const created = (await signaturesOf(sources.courriers)).find((item) => item.id === 'sg-2026-0013');
    expect(created).toMatchObject({ status: 'en_cours', fileName: 'edl-2026-006.pdf' });
    expect(created?.signers).toHaveLength(2);
    expect(created?.fields).toHaveLength(2);
  });

  it('propose Modifier, signature et préparation depuis la liste', async () => {
    const { sources, push } = renderLot(<EtatsLieuxPage />);
    await screen.findByRole('table', { name: 'États des lieux' });
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, EDL-2026-006' }));
    expect(await screen.findByRole('menuitem', { name: 'Télécharger le PDF' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Préparer l’état de sortie' }).getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Modifier' }));
    expect(push).toHaveBeenCalledWith('/baux/etats-des-lieux/edl-2026-006/modifier');
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, EDL-2026-006' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Envoyer pour signature' }));
    await waitFor(async () => { expect((await signaturesOf(sources.courriers)).some((item) => item.fileName === 'edl-2026-006.pdf')).toBe(true); });
  });

  it('ouvre la fiche pour télécharger le PDF', async () => {
    const { push } = renderLot(<EtatsLieuxPage />);
    await screen.findByRole('table', { name: 'États des lieux' });
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, EDL-2026-006' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Télécharger le PDF' }));
    expect(push).toHaveBeenCalledWith('/baux/etats-des-lieux/edl-2026-006?imprimer=1');
    expect(norm(document.body.textContent)).toContain('EDL-2026-006');
  });
});
