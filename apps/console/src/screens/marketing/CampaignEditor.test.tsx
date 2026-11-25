import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { router } from '../../../test/navigation';
import { json } from '../../../test/platform';
import { problem, proofRequired } from '@/platform/fixtures';
import { CAMPAIGN_IDS, campaignDetail, campaignEstimate, campaignImage, savedCampaign } from '@/platform/marketing/fixtures';
import { chooseOption } from '../abonnements/testSupport';
import { CampaignScreen } from './CampaignScreen';
import { NewCampaignScreen } from './NewCampaignScreen';
import { CAMPAIGN, SLOW, button, codeArea, openMarketing, previewPage, richEditor, stubLayout } from './testSupport';
import type { Setup } from './testSupport';

const openNew = (setup?: Setup) => openMarketing(<NewCampaignScreen />, setup);
const openDraft = (setup?: Setup) => openMarketing(<CampaignScreen id={CAMPAIGN_IDS.campaign} />, setup);
const subject = () => screen.findByRole<HTMLInputElement>('textbox', { name: 'Objet' }, SLOW);
const type = (field: HTMLElement, value: string) => { fireEvent.change(field, { target: { value } }); };
const detail = (overrides: Record<string, unknown>) => () => json(200, { data: campaignDetail(overrides) });

async function writeCode(user: ReturnType<typeof userEvent.setup>, html: string): Promise<void> {
  await richEditor();
  await user.click(screen.getByRole('radio', { name: 'Code HTML' }));
  type(await codeArea(), html);
}

beforeAll(stubLayout);
beforeEach(() => {
  router.replace.mockClear();
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(() => Promise.resolve(new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 }))));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('création d’une campagne', () => {
  it('enregistre un e-mail saisi en code HTML puis ouvre la campagne', async () => {
    const view = openNew({ write: () => json(201, savedCampaign()) });
    const user = userEvent.setup();

    type(await subject(), 'Maintenance de novembre');
    await writeCode(user, '<p>Dimanche.</p>');
    expect(previewPage().html).toContain('<p>Dimanche.</p>');
    await user.click(button('Enregistrer'));

    await waitFor(() => { expect(router.replace).toHaveBeenCalledWith(`/marketing/${CAMPAIGN_IDS.campaign}`); });
    expect(view.writes()[0]?.body).toEqual({
      channel: 'email',
      category: 'marketing',
      audience: 'all_accounts',
      subject: 'Maintenance de novembre',
      html: '<p>Dimanche.</p>',
    });
  });

  it('explique le consentement et n’envoie rien tant que des champs manquent', async () => {
    const view = openNew();
    const user = userEvent.setup();
    await richEditor();

    expect(screen.getByText(/Aucun canal n’est activé par défaut/)).toBeTruthy();
    await user.click(screen.getByRole('radio', { name: /Information de service/ }));
    expect(screen.getByText(/chaque compte peut la désactiver/)).toBeTruthy();
    expect(button('Envoyer').disabled).toBe(true);
    expect(screen.getByText('Enregistrez la campagne avant de la tester ou de l’envoyer.')).toBeTruthy();
    await user.click(button('Enregistrer'));

    expect(await screen.findByText('Saisissez l’objet de l’e-mail.')).toBeTruthy();
    expect(screen.getByText('Écrivez le contenu de l’e-mail.')).toBeTruthy();
    expect(view.writes()).toEqual([]);
  });

  it('enregistre une notification push à des personnes précises, adresses vérifiées', async () => {
    const view = openNew({ write: () => json(201, savedCampaign({ channel: 'push' }, ['inconnu@exemple.fr'])) });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('radio', { name: /Notification push/ }));
    await chooseOption(user, /Destinataires/, 'Personnes précises');
    const addresses = screen.getByRole('textbox', { name: 'Adresses e-mail des destinataires' });
    await user.type(addresses, 'a@exemple.fr, A@exemple.fr; pas-une-adresse{Enter}');
    expect(screen.getByText('Adresse non valide : pas-une-adresse')).toBeTruthy();
    await user.clear(addresses);
    await user.type(addresses, 'inconnu@exemple.fr{Enter}');
    expect(within(screen.getByRole('list', { name: 'Destinataires choisis' })).getAllByRole('listitem')).toHaveLength(2);
    type(screen.getByRole('textbox', { name: 'Titre' }), 'Rappel');
    type(screen.getByRole('textbox', { name: 'Message' }), 'Pensez à vos loyers.');
    type(screen.getByRole('textbox', { name: 'Lien (facultatif)' }), '//piege.example');
    await user.click(button('Enregistrer'));
    expect(await screen.findByText(/Saisissez un chemin commençant par un seul/)).toBeTruthy();
    expect(view.writes()).toEqual([]);
    type(screen.getByRole('textbox', { name: 'Lien (facultatif)' }), '/loyers');
    expect(screen.getByText('6 sur 65 caractères')).toBeTruthy();
    expect(within(screen.getByRole('figure', { name: 'Aperçu de la notification' })).getByText('Ouvre /loyers')).toBeTruthy();
    await user.click(button('Enregistrer'));

    await waitFor(() => { expect(view.writes()).toHaveLength(1); });
    expect(view.writes()[0]?.body).toEqual({
      channel: 'push',
      category: 'marketing',
      audience: 'selected',
      recipient_emails: ['a@exemple.fr', 'inconnu@exemple.fr'],
      push_title: 'Rappel',
      push_body: 'Pensez à vos loyers.',
      link: '/loyers',
    });
  });

  it('propose les délais d’inactivité courants et borne la saisie libre', async () => {
    const view = openNew({ write: () => json(201, savedCampaign()) });
    const user = userEvent.setup();
    type(await subject(), 'Revenez');
    await writeCode(user, '<p>Bonjour</p>');
    await chooseOption(user, /Destinataires/, 'Comptes inactifs');
    const days = screen.getByRole('spinbutton', { name: 'Délai d’inactivité (jours)' });
    type(days, '3');
    await user.click(button('Enregistrer'));
    expect(await screen.findByText('Saisissez un nombre de jours entre 7 et 365.')).toBeTruthy();
    await user.click(button('14 jours'));
    await user.click(button('Enregistrer'));

    await waitFor(() => { expect(view.writes()).toHaveLength(1); });
    expect(view.writes()[0]?.body).toMatchObject({ audience: 'inactive_accounts', inactivity_days: 14 });
  });
});

describe('brouillon existant', () => {
  it('affiche les adresses sans compte renvoyées par le serveur', async () => {
    const view = openDraft({ write: () => json(200, savedCampaign({ subject: 'Corrigé', lock_version: 4 }, ['inconnu@exemple.fr'])) });
    const user = userEvent.setup();
    type(await subject(), 'Corrigé');
    expect(button('Envoyer').disabled).toBe(true);
    expect(screen.getByText('Enregistrez vos modifications avant de tester ou d’envoyer.')).toBeTruthy();
    await user.click(button('Enregistrer'));

    expect(await screen.findByText('Adresses sans compte, non retenues')).toBeTruthy();
    expect(screen.getByText('inconnu@exemple.fr')).toBeTruthy();
    expect(view.writes()[0]?.url.pathname).toBe(`/api/v1/console${CAMPAIGN}`);
    expect(view.writes()[0]?.body).toMatchObject({ lock_version: 3, subject: 'Corrigé' });
    await waitFor(() => { expect(button('Envoyer').disabled).toBe(false); });
  });

  it('propose de recharger après un conflit de version, sans perdre la saisie avant', async () => {
    let reads = 0;
    const view = openDraft({
      campaign: () => json(200, { data: campaignDetail(++reads === 1 ? {} : { subject: 'Version du collègue', lock_version: 9 }) }),
      write: () => json(409, problem(409, 'platform_campaign_stale', 'Version dépassée.')),
    });
    const user = userEvent.setup();
    type(await subject(), 'Ma version');
    await user.click(button('Enregistrer'));

    expect(await screen.findByText(/Cette campagne a été modifiée ailleurs/)).toBeTruthy();
    expect((await subject()).value).toBe('Ma version');
    await user.click(button('Recharger la campagne'));

    await waitFor(async () => { expect((await subject()).value).toBe('Version du collègue'); });
    expect(screen.queryByText(/Cette campagne a été modifiée ailleurs/)).toBeNull();
    expect(view.writes()).toHaveLength(1);
  });

  it('rejoue l’écriture avec la preuve 2FA demandée par le serveur', async () => {
    let attempts = 0;
    const view = openDraft({ write: () => (++attempts === 1 ? json(422, proofRequired) : json(200, savedCampaign({ subject: 'Corrigé' }))) });
    const user = userEvent.setup();
    type(await subject(), 'Corrigé');
    await user.click(button('Enregistrer'));
    await user.type(await screen.findByRole('textbox', { name: 'Code de double authentification' }), '123456{Enter}');

    await waitFor(() => { expect(view.writes()).toHaveLength(2); });
    expect(view.writes()[1]?.body).toMatchObject({ subject: 'Corrigé', two_factor_code: '123456' });
  });

  it('désactive l’envoi et le test d’un canal coupé, avec la raison', async () => {
    openDraft({ options: { channels: [{ channel: 'email', enabled: false, reason: 'Aucun fournisseur configuré.' }, { channel: 'push', enabled: true, reason: null }] } });
    await subject();

    expect(button('Envoyer').disabled).toBe(true);
    expect(button('Envoyer un test').disabled).toBe(true);
    expect(screen.getByText('Envoi désactivé pour le canal « E-mail » : Aucun fournisseur configuré.')).toBeTruthy();
  });

  it('envoie un test à l’opérateur et dit à quelle adresse', async () => {
    openDraft({ write: () => json(200, { data: { sent_to: 'awa.diallo@eguardimmo.test' } }) });
    const user = userEvent.setup();
    await subject();
    await user.click(button('Envoyer un test'));

    expect(await screen.findByText('Envoyé à awa.diallo@eguardimmo.test')).toBeTruthy();
  });

  it.each([
    [409, 'platform_campaign_no_device', /Aucun appareil ne peut recevoir/],
    [503, 'campaign_sending_disabled', /par e-mail est désactivé sur le serveur/],
    [503, 'push_sending_disabled', /notifications push est désactivé sur le serveur/],
  ])('traduit le refus %i %s du test', async (status, code, message) => {
    openDraft({ write: () => json(status, problem(status, code, 'Refus.')) });
    const user = userEvent.setup();
    await subject();
    await user.click(button('Envoyer un test'));

    expect(await screen.findByText(message)).toBeTruthy();
  });
});

describe('envoi', () => {
  it('affiche l’estimation, envoie avec la version puis passe au suivi', async () => {
    let status = 'draft';
    const view = openDraft({
      campaign: () => json(200, { data: campaignDetail({ status }) }),
      write: () => {
        status = 'sending';
        return json(202, { data: campaignDetail({ status }) });
      },
    });
    const user = userEvent.setup();
    await subject();
    await user.click(button('Envoyer'));
    const dialog = await screen.findByRole('dialog', { name: 'Envoyer la campagne' });

    expect(await within(dialog).findByText('Exclus sans consentement')).toBeTruthy();
    for (const figure of ['120', '100', '15', '5']) expect(within(dialog).getByText(figure)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Envoyer à 100 comptes' }));

    expect(await screen.findByRole('region', { name: 'Statistiques' })).toBeTruthy();
    expect(view.writes()[0]?.url.pathname).toBe(`/api/v1/console${CAMPAIGN}/send`);
    expect(view.writes()[0]?.body).toEqual({ lock_version: 3 });
  });

  it('bloque l’envoi quand personne n’est éligible', async () => {
    const view = openDraft({ estimate: () => json(200, campaignEstimate({ total: 4, eligible: 0, excluded_no_consent: 4, excluded_unreachable: 0 })) });
    const user = userEvent.setup();
    await subject();
    await user.click(button('Envoyer'));
    const dialog = await screen.findByRole('dialog');

    expect(await within(dialog).findByText('Envoi impossible : aucun destinataire éligible.')).toBeTruthy();
    expect(within(dialog).getByRole<HTMLButtonElement>('button', { name: 'Envoyer' }).disabled).toBe(true);
    expect(view.writes()).toEqual([]);
  });

  it.each([
    [409, 'platform_campaign_no_recipient', /Aucun destinataire éligible pour cette campagne/],
    [422, 'platform_campaign_too_large', /dépasse le nombre maximal de destinataires/],
    [409, 'platform_campaign_not_editable', /n’est plus un brouillon/],
  ])('garde le dialogue ouvert sur le refus %i %s', async (status, code, message) => {
    openDraft({ write: () => json(status, problem(status, code, 'Refus.')) });
    const user = userEvent.setup();
    await subject();
    await user.click(button('Envoyer'));
    const dialog = await screen.findByRole('dialog');
    await user.click(await within(dialog).findByRole('button', { name: 'Envoyer à 100 comptes' }));

    expect(await within(dialog).findByText(message)).toBeTruthy();
  });
});

describe('images', () => {
  it('ajoute, signale la pièce jointe, insère, retire puis envoie en multipart', async () => {
    const view = openNew({ write: () => json(201, savedCampaign()) });
    const user = userEvent.setup({ applyAccept: false });
    type(await subject(), 'Avec image');
    await writeCode(user, '<p>Bonjour</p>');
    const picker = screen.getByLabelText<HTMLInputElement>('Choisir des images');
    await user.upload(picker, [new File(['png!'], 'bandeau.png', { type: 'image/png' }), new File(['<svg/>'], 'vecteur.svg', { type: 'image/svg+xml' })]);

    expect(screen.getByText('vecteur.svg : seuls les formats JPEG, PNG et GIF sont acceptés.')).toBeTruthy();
    const row = screen.getByRole('listitem', { name: 'bandeau.png' });
    expect(within(row).getByText('En pièce jointe')).toBeTruthy();
    await user.click(within(row).getByRole('button', { name: 'Insérer bandeau.png dans le texte' }));
    const ref = /cid:([a-z0-9-]{1,36})/.exec((await codeArea()).value)?.[1] ?? '';
    expect(ref).not.toBe('');
    expect(within(row).getByText('Insérée dans le texte')).toBeTruthy();
    await waitFor(() => { expect(previewPage().html).toContain(`src="data:image/png;base64,${btoa('png!')}"`); });
    await user.click(button('Enregistrer'));

    await waitFor(() => { expect(view.writes()).toHaveLength(1); });
    expect(view.writes()[0]?.body).toMatchObject({ subject: 'Avec image', [`images[${ref}]`]: 'bandeau.png' });
  });

  it('insère dans l’éditeur l’image choisie depuis la barre d’outils', async () => {
    openNew();
    const user = userEvent.setup();
    const editor = await richEditor();
    await user.click(button('Ajouter une image'));
    await user.upload(screen.getByLabelText('Choisir des images'), new File(['gif'], 'a.gif', { type: 'image/gif' }));

    await waitFor(() => { expect(editor.querySelector('img[alt="a.gif"]')?.getAttribute('src')).toMatch(/^data:image\/gif;base64,/); });
    expect(within(screen.getByRole('listitem', { name: 'a.gif' })).getByText('Insérée dans le texte')).toBeTruthy();
  });

  it('charge une image enregistrée par son adresse relative et la retire à la demande', async () => {
    const view = openDraft({ campaign: detail({ html: `<p>Bonjour <img src="cid:${CAMPAIGN_IDS.image}" alt="Bandeau"></p>`, images: [campaignImage()] }) });
    const user = userEvent.setup();
    await subject();

    await waitFor(() => { expect(previewPage().html).toContain('src="data:image/png;base64,AQIDBA=="'); });
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe(campaignImage().url);
    await user.click(button('Retirer bandeau.png'));
    expect(screen.queryByRole('listitem', { name: 'bandeau.png' })).toBeNull();
    await user.click(button('Enregistrer'));

    await waitFor(() => { expect(view.writes()).toHaveLength(1); });
    expect(view.writes()[0]?.body).toMatchObject({ removed_image_ids: [CAMPAIGN_IDS.image] });
    expect(String(view.writes()[0]?.body?.html)).not.toContain('cid:');
  });

  it('refuse une image trop lourde', async () => {
    openNew({ options: { limits: { subject: 140, push_title: 65, push_body: 240, html_bytes: 200000, images: 5, image_bytes: 3, total_image_bytes: 10, selected_recipients: 500 } } });
    const user = userEvent.setup();
    await richEditor();
    await user.upload(screen.getByLabelText('Choisir des images'), new File(['trop'], 'gros.png', { type: 'image/png' }));

    expect(screen.getByText('gros.png : 3 o au maximum par image.')).toBeTruthy();
    expect(screen.queryByRole('listitem', { name: 'gros.png' })).toBeNull();
  });
});

describe('HTML reçu ou saisi', () => {
  const HOSTILE = '<table style="width:100%"><tbody><tr><td>Offre</td></tr></tbody></table><img src=x onerror="window.__xss=1">';
  const active = () => document.querySelector('[onerror], img[src="x"], table');

  it('n’est jamais injecté dans la page : code et aperçu isolé seulement', async () => {
    const view = openDraft({ campaign: detail({ html: HOSTILE }) });

    expect((await codeArea()).value).toBe(HOSTILE);
    const { frame, html } = previewPage();
    expect(frame.getAttribute('sandbox')).toBe('');
    expect(html).toContain('onerror');
    expect(html).toContain("default-src 'none'");
    expect(active()).toBeNull();
    expect(Reflect.get(window, '__xss')).toBeUndefined();
    expect(button('Envoyer').disabled).toBe(false);
    await expectNoA11yViolations(view.container, { iframes: false });
  });

  it('ne se perd qu’après confirmation du retour à l’éditeur', async () => {
    openDraft({ campaign: detail({ html: HOSTILE }) });
    const user = userEvent.setup();
    await codeArea();
    await user.click(screen.getByRole('radio', { name: 'Éditeur' }));
    const dialog = await screen.findByRole('dialog', { name: 'Revenir à l’éditeur ?' });
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }));

    expect((await codeArea()).value).toBe(HOSTILE);
    await user.click(screen.getByRole('radio', { name: 'Éditeur' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Convertir et perdre la mise en forme' }));

    const editor = await richEditor();
    expect(editor.textContent).toContain('Offre');
    expect(active()).toBeNull();
    expect(previewPage().html).not.toMatch(/onerror|<table/);
  });

  it('bascule sans avertissement quand rien ne se perd, en gardant le code tel quel', async () => {
    openDraft();
    const user = userEvent.setup();
    await richEditor();
    await user.click(screen.getByRole('radio', { name: 'Code HTML' }));
    expect((await codeArea()).value).toBe('<p>Le service sera interrompu dimanche.</p>');
    await user.click(screen.getByRole('radio', { name: 'Éditeur' }));

    expect(await richEditor()).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(button('Envoyer').disabled).toBe(false);
  });
});
