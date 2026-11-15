import type { DocumentsSettings, GeneralSettings, MenuModule, MenuSettings, NotificationEvent, NotificationsSettings } from './schemas';

export const demoGeneral: GeneralSettings = {
  displayNames: 'prenom-nom',
  language: 'fr',
  currency: 'EUR',
  dateFormat: 'jj/mm/aaaa',
  timezone: 'Europe/Paris',
  areaUnit: 'm2',
  fiscalYearStart: '01-01',
  taxRegime: 'foncier-reel',
  expertMode: false,
  entryAssist: true,
};

export const demoDocuments: DocumentsSettings = {
  quittanceFormat: 'QT-{année}-{numéro}',
  quittanceNext: { '{année}': '2026', '{numéro}': '0413' },
  avisFormat: 'AV-{année}-{mois}-{lot}',
  avisNext: { '{année}': '2026', '{mois}': '1201', '{lot}': 'A1' },
  logoName: 'logo-tilleuls.png',
  signatureName: 'signature.png',
  footer: '',
  qrCode: true,
  tenantBalance: true,
  chargesDetail: false,
  avisAuto: true,
  avisSchedule: '25-precedent',
  quittanceAuto: true,
  copyToMe: false,
};

const mod = (id: string, label: string, group: MenuModule['group'], visible = true, locked = false): MenuModule => ({
  id,
  label,
  group,
  visible,
  locked,
});

export const demoMenu: MenuSettings = {
  homePage: 'accueil',
  tenantsTab: 'a-suivre',
  financesTab: 'a-encaisser',
  modules: [
    mod('accueil', 'Accueil', 'principal', true, true),
    mod('biens', 'Biens', 'principal', true, true),
    mod('locataires', 'Locataires', 'principal', true, true),
    mod('baux', 'Baux', 'principal', true, true),
    mod('finances', 'Finances', 'principal', true, true),
    mod('documents', 'Documents', 'principal', true, true),
    mod('messages', 'Messages', 'suivi'),
    mod('interventions', 'Interventions', 'suivi'),
    mod('agenda', 'Agenda', 'suivi'),
    mod('taches', 'Tâches et rappels', 'suivi'),
    mod('candidats', 'Candidats', 'suivi', false),
    mod('analytique', 'Analytique', 'outils'),
    mod('rapports', 'Rapports', 'outils'),
    mod('modeles', 'Modèles de courriers', 'outils'),
    mod('contacts', 'Contacts', 'outils'),
    mod('reservations', 'Réservations', 'outils', false),
    mod('prets', 'Prêts', 'outils', false),
  ],
};

const event = (
  id: string,
  label: string,
  group: NotificationEvent['group'],
  email: boolean,
  app: boolean,
  mobile: boolean,
): NotificationEvent => ({ id, label, group, channels: { email, app, mobile } });

export const demoNotifications: NotificationsSettings = {
  events: [
    event('loyer-en-retard', 'Loyer en retard', 'Finances', true, true, true),
    event('paiement-recu', 'Paiement reçu', 'Finances', false, true, true),
    event('relance-envoyee', 'Relance envoyée', 'Finances', true, true, false),
    event('echeancier-non-respecte', 'Échéancier non respecté', 'Finances', true, true, true),
    event('nouvelle-candidature', 'Nouvelle candidature', 'Locataires et baux', true, true, false),
    event('bail-a-echeance', 'Bail arrivant à échéance', 'Locataires et baux', true, true, false),
    event('assurance-expiree', "Attestation d'assurance expirée", 'Locataires et baux', true, true, false),
    event('nouveau-message', 'Nouveau message', 'Suivi', false, true, true),
    event('nouvelle-intervention', 'Nouvelle intervention', 'Suivi', true, true, true),
    event('tache-a-echeance', 'Tâche arrivée à échéance', 'Suivi', false, true, true),
    event('rappel-evenement', "Rappel d'événement", 'Suivi', false, true, true),
    event('signature-terminee', 'Signature terminée', 'Documents', true, true, false),
  ],
  digest: 'lundi',
  quietHours: true,
  productNews: true,
  monthlyLetter: false,
  partnerOffers: false,
};
