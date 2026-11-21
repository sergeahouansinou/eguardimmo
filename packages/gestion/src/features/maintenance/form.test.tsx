import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import * as api from './api/responses.fixtures';
import { InterventionFormPage } from './InterventionFormPage';
import { maintenanceUrl, renderMaintenance } from './testing';

const list = maintenanceUrl('/interventions');

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('combobox', { name: /^Lot concerné/ }));
  await user.click(await screen.findByRole('option', { name: new RegExp(api.LABELS.lot) }));
  await user.click(screen.getByRole('combobox', { name: /^Nature/ }));
  await user.click(await screen.findByRole('option', { name: 'Plomberie' }));
  await user.type(screen.getByLabelText('Titre *'), 'Fuite sous l’évier');
  await user.type(screen.getByLabelText('Description *'), 'Le siphon goutte.');
}

describe('création d’une intervention', () => {
  it('crée avec une clé d’idempotence puis ouvre la fiche', async () => {
    const user = userEvent.setup();
    const { callsTo, push, container } = renderMaintenance(<InterventionFormPage />, { [`POST ${list}`]: { status: 201, body: api.reportedDetail } });
    await fill(user);
    await expectNoA11yViolations(container);
    await user.click(screen.getByRole('button', { name: 'Créer l’intervention' }));

    await waitFor(() => { expect(push).toHaveBeenCalledWith(`/interventions/${api.IDS.intervention}`); });
    const call = callsTo('POST', list)[0];
    expect(call?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(call?.body).toMatchObject({ unit_id: api.IDS.unit, nature_term_id: api.IDS.nature, title: 'Fuite sous l’évier', priority: 'normal' });
  });

  it('réutilise la clé après une panne et refuse un formulaire incomplet sans appel', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const { callsTo } = renderMaintenance(<InterventionFormPage />, {
      [`POST ${list}`]: () => { attempts += 1; return attempts === 1 ? { status: 503, body: api.problemBody(503, 'service_unavailable', 'x') } : { status: 201, body: api.reportedDetail }; },
    });
    await user.click(await screen.findByRole('button', { name: 'Créer l’intervention' }));
    expect(await screen.findByText('Choisissez le lot concerné.')).toBeTruthy();
    expect(callsTo('POST', list)).toHaveLength(0);

    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Créer l’intervention' }));
    expect(await screen.findByText(/momentanément indisponible/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Créer l’intervention' }));
    await waitFor(() => { expect(callsTo('POST', list)).toHaveLength(2); });
    const keys = callsTo('POST', list).map((call) => call.headers.get('Idempotency-Key'));
    expect(keys[0]).toBe(keys[1]);
  });

  it('affiche l’erreur du serveur quand le lot n’a pas de mandat', async () => {
    const user = userEvent.setup();
    renderMaintenance(<InterventionFormPage />, { [`POST ${list}`]: { status: 422, body: api.problemBody(422, 'intervention_no_mandate', 'x') } });
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Créer l’intervention' }));
    expect(await screen.findByText('Aucun mandat de gestion ne couvre ce lot : l’intervention ne peut pas être engagée.')).toBeTruthy();
  });
});
