import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { norm } from '../../../../test/lots';
import * as api from './api/responses.fixtures';
import { KeysPage } from './KeysPage';
import { chargesUrl, problem, renderCharges } from './testing';

const SLOW = { timeout: 4000 };
const keysUrl = chargesUrl(`/properties/${api.IDS.property}/charge-keys`);
const search = `bien=${api.IDS.property}`;

describe('clés de répartition', () => {
  it('demande de choisir un bien tant qu’aucun n’est retenu, sans appeler les clés', async () => {
    const { calls } = renderCharges(<KeysPage />, {});
    expect(await screen.findByText(/Choisissez un bien pour voir ses clés/, {}, SLOW)).toBeTruthy();
    expect(calls.filter((call) => call.path === keysUrl)).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Nouvelle clé' })).toBeNull();
  });

  it('affiche la version en vigueur avec le poids de chaque lot', async () => {
    const { container } = renderCharges(<KeysPage />, {}, { search });
    expect(await screen.findByRole('heading', { name: 'Tantièmes généraux' }, SLOW)).toBeTruthy();
    await waitFor(() => { expect(norm(document.body.textContent)).toContain('Apt 12640'); }, SLOW);
    expect(norm(document.body.textContent)).toContain('Apt 14360');
    expect(norm(document.body.textContent)).toContain('depuis le 01/01/2026');
    await expectNoA11yViolations(container);
  });

  it('crée une clé pondérée avec les poids saisis par lot', async () => {
    const { callsTo } = renderCharges(<KeysPage />, { [`POST ${keysUrl}`]: { status: 201, body: { data: api.key } } }, { search });
    await userEvent.click(await screen.findByRole('button', { name: 'Nouvelle clé' }, SLOW));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Libellé/), { target: { value: 'Tantièmes eau' } });
    await waitFor(() => { expect(within(dialog).getByLabelText('Apt 12')).toBeTruthy(); }, SLOW);
    fireEvent.change(within(dialog).getByLabelText('Apt 12'), { target: { value: '700' } });
    fireEvent.change(within(dialog).getByLabelText('Apt 14'), { target: { value: '300' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Créer la clé' }));

    await waitFor(() => { expect(callsTo('POST', keysUrl)).toHaveLength(1); }, SLOW);
    expect(callsTo('POST', keysUrl)[0]?.body).toMatchObject({ label: 'Tantièmes eau', kind: 'tantiemes', shares: [{ unit_id: api.IDS.unitA, weight: 700 }, { unit_id: api.IDS.unitB, weight: 300 }] });
  });

  it('refuse une clé pondérée sans aucun poids, sans appel', async () => {
    const { callsTo } = renderCharges(<KeysPage />, {}, { search });
    await userEvent.click(await screen.findByRole('button', { name: 'Nouvelle clé' }, SLOW));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Libellé/), { target: { value: 'Tantièmes eau' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Créer la clé' }));

    expect(await within(dialog).findByText('Saisissez au moins un poids supérieur à zéro.')).toBeTruthy();
    expect(callsTo('POST', keysUrl)).toHaveLength(0);
  });

  it('ajoute une version à une clé existante', async () => {
    const versionUrl = `${keysUrl}/${api.IDS.key}/versions`;
    const { callsTo } = renderCharges(<KeysPage />, { [`POST ${versionUrl}`]: { status: 201, body: { data: api.key } } }, { search });
    await userEvent.click(await screen.findByRole('button', { name: 'Nouvelle version' }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => { expect(within(dialog).getByLabelText('Apt 12')).toBeTruthy(); }, SLOW);
    fireEvent.change(within(dialog).getByLabelText('Apt 12'), { target: { value: '500' } });
    fireEvent.change(within(dialog).getByLabelText(/^Date d’effet/), { target: { value: '2027-01-01' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ajouter la version' }));

    await waitFor(() => { expect(callsTo('POST', versionUrl)).toHaveLength(1); }, SLOW);
    expect(callsTo('POST', versionUrl)[0]?.body).toEqual({ valid_from: '2027-01-01', shares: [{ unit_id: api.IDS.unitA, weight: 500 }] });
  });

  it('archive après confirmation et affiche un 409 du serveur', async () => {
    const archiveUrl = `${keysUrl}/${api.IDS.key}/archive`;
    renderCharges(<KeysPage />, { [`POST ${archiveUrl}`]: problem(409, 'charge_key_archived') }, { search });
    await userEvent.click(await screen.findByRole('button', { name: 'Archiver' }, SLOW));
    const dialog = await screen.findByRole('dialog', { name: 'Archiver cette clé ?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Archiver la clé' }));

    expect(await within(dialog).findByText('Clé non archivée', {}, SLOW)).toBeTruthy();
  });

  it('un rôle sans droit n’appelle aucune donnée', async () => {
    const { calls } = renderCharges(<KeysPage />, {}, { role: 'viewer', search });
    expect(await screen.findByText('Charges indisponibles pour ce compte')).toBeTruthy();
    expect(calls).toHaveLength(0);
  });
});
