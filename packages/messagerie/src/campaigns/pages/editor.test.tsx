import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@eguardimmo/api';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { audiencesOf, campaignOf, fakeCampaigns, renderCampaigns } from '../../../test/campaigns';
import { proofStub } from '../../../test/staff';
import { BUILDING_ID, CAMPAIGN_ID, SECOND_BUILDING_ID, ATTACHMENT_ID } from '../testing';
import { CampaignEditorPage } from './EditorPage';

type User = ReturnType<typeof userEvent.setup>;

async function fill(user: User, subject = 'Coupure d’eau lundi', body = 'Bonjour {{ Prénom }}, coupure lundi.') {
  await user.type(await screen.findByRole('textbox', { name: /Objet/ }), subject);
  await user.click(screen.getByRole('textbox', { name: /Message/ }));
  await user.paste(body);
}

const confirmSend = async (user: User) => {
  await user.click(screen.getByRole('button', { name: 'Envoyer' }));
  await user.click(await screen.findByRole('button', { name: 'Envoyer maintenant' }));
};

describe('éditeur de campagne : envoi', () => {
  it('enregistre le brouillon, l’envoie après confirmation puis ouvre le suivi', async () => {
    const user = userEvent.setup();
    const source = fakeCampaigns();
    const { navigate, container } = renderCampaigns(<CampaignEditorPage />, { source });

    await fill(user);
    await expectNoA11yViolations(container);
    await confirmSend(user);

    await waitFor(() => { expect(navigate).toHaveBeenCalledWith(`/campagnes/${CAMPAIGN_ID}`); });
    expect(source.create).toHaveBeenCalledWith({ subject: 'Coupure d’eau lundi', body: 'Bonjour {{ Prénom }}, coupure lundi.', audience: 'tenants', buildingIds: [], copyToHistory: true });
    expect(source.send).toHaveBeenCalledWith(CAMPAIGN_ID);
    expect(source.update).not.toHaveBeenCalled();
  });

  it('n’envoie rien tant que l’envoi n’est pas confirmé', async () => {
    const user = userEvent.setup();
    const source = fakeCampaigns();
    renderCampaigns(<CampaignEditorPage />, { source });

    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Envoyer' }));
    const dialog = await screen.findByRole('dialog', { name: 'Envoyer cette campagne ?' });
    expect(within(dialog).getByText(/L’envoi est définitif et exige une double authentification récente/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }));

    expect(source.create).not.toHaveBeenCalled();
    expect(source.send).not.toHaveBeenCalled();
  });

  it('la touche Entrée dans l’objet n’envoie pas la campagne', async () => {
    const user = userEvent.setup();
    const source = fakeCampaigns();
    renderCampaigns(<CampaignEditorPage />, { source });

    await user.type(await screen.findByRole('textbox', { name: /Objet/ }), 'Objet{Enter}');

    expect(source.create).not.toHaveBeenCalled();
    expect(source.send).not.toHaveBeenCalled();
  });

  it('refuse l’envoi sans objet ni message, sans appeler le serveur', async () => {
    const user = userEvent.setup();
    const source = fakeCampaigns();
    renderCampaigns(<CampaignEditorPage />, { source });

    await user.click(await screen.findByRole('button', { name: 'Envoyer' }));

    expect(await screen.findByText('Saisissez l’objet de la campagne')).toBeTruthy();
    expect(screen.getByText('Saisissez le message')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(source.create).not.toHaveBeenCalled();
  });

  it('refuse un champ de fusion inconnu avant tout appel serveur', async () => {
    const user = userEvent.setup();
    const source = fakeCampaigns();
    renderCampaigns(<CampaignEditorPage />, { source });

    await fill(user, 'Solde', 'Votre solde : {{ Solde }}');
    await user.click(screen.getByRole('button', { name: 'Envoyer' }));

    expect(await screen.findByText(/Champ de fusion inconnu : Solde/)).toBeTruthy();
    expect(source.create).not.toHaveBeenCalled();
  });

  it('insère un champ de fusion proposé dans le message', async () => {
    const user = userEvent.setup();
    renderCampaigns(<CampaignEditorPage />);
    const body = await screen.findByRole('textbox', { name: /Message/ });

    await user.click(within(screen.getByRole('group', { name: 'Champs de fusion' })).getByRole('button', { name: 'Prénom' }));

    expect((body as HTMLTextAreaElement).value).toBe('{{ Prénom }}');
  });

  it('affiche un aperçu en texte brut avec les champs remplacés par des exemples', async () => {
    const user = userEvent.setup();
    renderCampaigns(<CampaignEditorPage />);
    await fill(user, 'Objet', 'Bonjour {{ Prénom }} <b>gras</b>');

    const preview = screen.getByRole('region', { name: 'Aperçu' });
    expect(preview.textContent).toContain('Bonjour Awa <b>gras</b>');
    expect(preview.querySelector('b')).toBeNull();
  });
});

describe('éditeur de campagne : destinataires', () => {
  it('propose les mandants à une agence seulement', async () => {
    renderCampaigns(<CampaignEditorPage />, { organizationKind: 'agency' });
    expect(await screen.findByRole('radio', { name: /Tous les mandants/ })).toBeTruthy();
  });

  it('ne propose pas les mandants à un bailleur individuel', async () => {
    renderCampaigns(<CampaignEditorPage />, { organizationKind: 'individual' });
    await screen.findByRole('radio', { name: /Tous les locataires/ });
    expect(screen.queryByRole('radio', { name: /Tous les mandants/ })).toBeNull();
  });

  it('bloque « certains immeubles » sans immeuble choisi, qui enverrait à tous les locataires', async () => {
    const user = userEvent.setup();
    const source = fakeCampaigns();
    renderCampaigns(<CampaignEditorPage />, { source });
    await fill(user);

    await user.click(await screen.findByRole('radio', { name: 'Certains immeubles' }));
    await user.click(screen.getByRole('button', { name: 'Envoyer' }));

    expect((await screen.findAllByText('Ajoutez au moins un immeuble')).length).toBeGreaterThan(0);
    expect(source.create).not.toHaveBeenCalled();
  });

  it('envoie les identifiants des immeubles choisis', async () => {
    const user = userEvent.setup();
    const source = fakeCampaigns();
    renderCampaigns(<CampaignEditorPage />, { source });
    await fill(user);

    await user.click(await screen.findByRole('radio', { name: 'Certains immeubles' }));
    await user.click(screen.getByRole('combobox', { name: /Immeubles à ajouter/ }));
    await user.click(await screen.findByRole('option', { name: /Résidence Les Palmiers/ }));
    await confirmSend(user);

    await waitFor(() => { expect(source.create).toHaveBeenCalledWith(expect.objectContaining({ buildingIds: [BUILDING_ID] })); });
    const sentInput = source.create.mock.calls[0]?.[0];
    expect(sentInput?.buildingIds).not.toContain(SECOND_BUILDING_ID);
  });

  it('prévient des fiches sans adresse e-mail', async () => {
    renderCampaigns(<CampaignEditorPage />);
    expect(await screen.findByText('2 fiches sans adresse e-mail ne recevront pas ce message.')).toBeTruthy();
  });
});

describe('éditeur de campagne : brouillon', () => {
  it('crée au premier enregistrement puis met à jour avec la version reçue', async () => {
    const user = userEvent.setup();
    const source = fakeCampaigns();
    renderCampaigns(<CampaignEditorPage />, { source });
    await fill(user);

    await user.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
    expect(await screen.findByText('Brouillon enregistré. Vous pouvez maintenant ajouter des pièces jointes.')).toBeTruthy();
    await user.click(await screen.findByRole('button', { name: 'Enregistrer le brouillon' }));

    await waitFor(() => { expect(source.update).toHaveBeenCalledTimes(1); });
    expect(source.create).toHaveBeenCalledTimes(1);
    expect(source.update).toHaveBeenCalledWith(CAMPAIGN_ID, expect.objectContaining({ subject: 'Coupure d’eau lundi' }), 1);
  });

  it('reprend un brouillon existant et met à jour avec sa version', async () => {
    const user = userEvent.setup();
    const source = fakeCampaigns({ get: () => Promise.resolve(campaignOf({ lock_version: 4, attachments: [{ id: ATTACHMENT_ID, name: 'avis.pdf', size_bytes: 2048 }] })) });
    renderCampaigns(<CampaignEditorPage campaignId={CAMPAIGN_ID} />, { source });

    expect((await screen.findByRole<HTMLInputElement>('textbox', { name: /Objet/ })).value).toBe('Coupure d’eau lundi');
    expect(screen.getByText('avis.pdf')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));

    await waitFor(() => { expect(source.update).toHaveBeenCalledWith(CAMPAIGN_ID, expect.anything(), 4); });
    expect(source.create).not.toHaveBeenCalled();
  });

  it('propose de recharger la dernière version après un conflit 409', async () => {
    const user = userEvent.setup();
    const source = fakeCampaigns({
      get: () => Promise.resolve(campaignOf({ lock_version: 4 })),
      update: () => Promise.reject(new ApiError(409, 'campaign_version_conflict', 'Version périmée')),
    });
    renderCampaigns(<CampaignEditorPage campaignId={CAMPAIGN_ID} />, { source });
    await screen.findByRole('textbox', { name: /Objet/ });

    await user.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));

    expect(await screen.findByText(/modifiée entre-temps par une autre personne/)).toBeTruthy();
    source.get.mockResolvedValue(campaignOf({ lock_version: 5, subject: 'Version d’une collègue' }));
    await user.click(screen.getByRole('button', { name: 'Recharger la dernière version' }));

    await waitFor(() => { expect(screen.getByRole<HTMLInputElement>('textbox', { name: /Objet/ }).value).toBe('Version d’une collègue'); });
  });

  it('n’offre pas la modification d’une campagne qui n’est plus un brouillon', async () => {
    const source = fakeCampaigns({ get: () => Promise.resolve(campaignOf({ status: 'sent', lock_version: 2 })) });
    renderCampaigns(<CampaignEditorPage campaignId={CAMPAIGN_ID} />, { source });

    expect(await screen.findByText('Cette campagne n’est plus modifiable')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Voir la campagne' }).getAttribute('href')).toBe(`/campagnes/${CAMPAIGN_ID}`);
    expect(screen.queryByRole('button', { name: 'Envoyer' })).toBeNull();
  });
});

describe('éditeur de campagne : erreurs serveur et double authentification', () => {
  it('relance l’envoi après la preuve 2FA, sans recréer le brouillon', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const source = fakeCampaigns({
      send: () => {
        attempts += 1;
        return attempts === 1 ? Promise.reject(new ApiError(403, 'reauthentication_required', 'Preuve requise')) : Promise.resolve(campaignOf({ status: 'sending', lock_version: 3 }));
      },
    });
    const proof = proofStub();
    const { navigate } = renderCampaigns(<CampaignEditorPage />, { source, proof });
    await fill(user);
    await confirmSend(user);

    await waitFor(() => { expect(proof.replays).toHaveLength(1); });
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByTestId('preuve-2fa')).toBeTruthy();
    act(() => { proof.replays[0]?.(); });

    await waitFor(() => { expect(navigate).toHaveBeenCalledWith(`/campagnes/${CAMPAIGN_ID}`); });
    expect(source.send).toHaveBeenCalledTimes(2);
    expect(source.create).toHaveBeenCalledTimes(1);
    expect(source.update).toHaveBeenCalledTimes(1);
    expect(source.update).toHaveBeenCalledWith(CAMPAIGN_ID, expect.anything(), 1);
  });

  it('explique qu’il faut activer la double authentification quand le compte n’en a pas', async () => {
    const user = userEvent.setup();
    const source = fakeCampaigns({ send: () => Promise.reject(new ApiError(403, 'two_factor_required', '2FA requise')) });
    const { navigate } = renderCampaigns(<CampaignEditorPage />, { source });
    await fill(user);
    await confirmSend(user);

    expect(await screen.findByText(/Activez la double authentification sur votre compte/)).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each([
    [new ApiError(503, 'campaign_sending_disabled', 'x'), /pas encore activé sur la plateforme/],
    [new ApiError(503, 'http_503', 'x'), /momentanément indisponible/],
    [new ApiError(429, 'http_429', 'x', {}, 45), /Patientez 45 s/],
    [new ApiError(409, 'campaign_attachment_not_ready', 'x'), /vérification antivirus/],
    [new ApiError(422, 'campaign_audience_empty', 'x'), /Aucun destinataire/],
  ])('affiche un message clair sans naviguer (%#)', async (error, text) => {
    const user = userEvent.setup();
    const source = fakeCampaigns({ send: () => Promise.reject(error) });
    const { navigate } = renderCampaigns(<CampaignEditorPage />, { source });
    await fill(user);
    await confirmSend(user);

    expect(await screen.findByText(text)).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeTruthy();
  });

  it('garde le brouillon enregistré quand l’envoi échoue : un second essai le met à jour', async () => {
    const user = userEvent.setup();
    const source = fakeCampaigns({ send: () => Promise.reject(new ApiError(503, 'http_503', 'x')) });
    renderCampaigns(<CampaignEditorPage />, { source });
    await fill(user);
    await confirmSend(user);
    await screen.findByText(/momentanément indisponible/);

    await confirmSend(user);

    await waitFor(() => { expect(source.send).toHaveBeenCalledTimes(2); });
    expect(source.create).toHaveBeenCalledTimes(1);
    expect(source.update).toHaveBeenCalledWith(CAMPAIGN_ID, expect.anything(), 1);
  });
});

describe('éditeur de campagne : programmation et test', () => {
  const openSchedule = async (user: User) => {
    await user.click(screen.getByRole('button', { name: 'Programmer l’envoi' }));
    return screen.findByRole('dialog', { name: 'Programmer l’envoi' });
  };

  it('programme l’envoi à la date choisie, avec le décalage de Paris', async () => {
    const user = userEvent.setup();
    const source = fakeCampaigns();
    const { navigate } = renderCampaigns(<CampaignEditorPage />, { source });
    await fill(user);

    const dialog = await openSchedule(user);
    fireEvent.change(within(dialog).getByLabelText('Date et heure d’envoi'), { target: { value: '2026-11-20T10:00' } });
    await user.click(within(dialog).getByRole('button', { name: 'Programmer' }));

    await waitFor(() => { expect(source.schedule).toHaveBeenCalledWith(CAMPAIGN_ID, '2026-11-20T10:00:00+01:00'); });
    await waitFor(() => { expect(navigate).toHaveBeenCalledWith(`/campagnes/${CAMPAIGN_ID}`); });
  });

  it('refuse une date à moins de 15 minutes', async () => {
    const user = userEvent.setup();
    const source = fakeCampaigns();
    renderCampaigns(<CampaignEditorPage />, { source });
    await fill(user);

    const dialog = await openSchedule(user);
    fireEvent.change(within(dialog).getByLabelText('Date et heure d’envoi'), { target: { value: '2026-11-19T10:20' } });
    await user.click(within(dialog).getByRole('button', { name: 'Programmer' }));

    expect(await within(dialog).findByText('L’envoi doit être programmé dans 15 minutes au moins')).toBeTruthy();
    expect(source.schedule).not.toHaveBeenCalled();
  });

  it('affiche dans la fenêtre l’échec de programmation renvoyé par le serveur', async () => {
    const user = userEvent.setup();
    const source = fakeCampaigns({ schedule: () => Promise.reject(new ApiError(422, 'campaign_schedule_invalid', 'x')) });
    renderCampaigns(<CampaignEditorPage />, { source });
    await fill(user);

    const dialog = await openSchedule(user);
    fireEvent.change(within(dialog).getByLabelText('Date et heure d’envoi'), { target: { value: '2026-11-25T10:00' } });
    await user.click(within(dialog).getByRole('button', { name: 'Programmer' }));

    expect(await within(dialog).findByText('La date d’envoi doit être dans 15 minutes au moins.')).toBeTruthy();
  });

  it('envoie un test à l’auteur et le confirme', async () => {
    const user = userEvent.setup();
    const source = fakeCampaigns();
    renderCampaigns(<CampaignEditorPage />, { source });
    await fill(user);

    await user.click(screen.getByRole('button', { name: 'Recevoir un test' }));

    expect(await screen.findByText(/jeanne@example\.com/)).toBeTruthy();
    expect(source.sendTest).toHaveBeenCalledWith({ subject: 'Coupure d’eau lundi', body: 'Bonjour {{ Prénom }}, coupure lundi.', audience: 'tenants' });
    expect(source.create).not.toHaveBeenCalled();
  });

  it('affiche l’échec d’un envoi de test', async () => {
    const user = userEvent.setup();
    const source = fakeCampaigns({ sendTest: () => Promise.reject(new ApiError(429, 'http_429', 'x', {}, 60)) });
    renderCampaigns(<CampaignEditorPage />, { source });
    await fill(user);

    await user.click(screen.getByRole('button', { name: 'Recevoir un test' }));

    expect(await screen.findByText(/Patientez 60 s/)).toBeTruthy();
  });
});

describe('éditeur de campagne : chargement', () => {
  it('affiche l’erreur de chargement des destinataires avec un bouton pour réessayer', async () => {
    const user = userEvent.setup();
    let calls = 0;
    const source = fakeCampaigns({ audiences: () => (++calls === 1 ? Promise.reject(new ApiError(503, 'http_503', 'x')) : Promise.resolve(audiencesOf())) });
    renderCampaigns(<CampaignEditorPage />, { source });

    expect(await screen.findByText(/momentanément indisponible/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('textbox', { name: /Objet/ })).toBeTruthy();
  });

  it('refuse l’écran à un comptable', async () => {
    const source = fakeCampaigns();
    renderCampaigns(<CampaignEditorPage />, { source, role: 'accountant' });
    expect(await screen.findByText('Accès réservé')).toBeTruthy();
    expect(source.audiences).not.toHaveBeenCalled();
  });
});
