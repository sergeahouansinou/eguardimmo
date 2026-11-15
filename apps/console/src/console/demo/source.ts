import { shellSchema } from '@eguardimmo/shell';
import type { ShellData, ShellNotification } from '@eguardimmo/shell';
import type { ConsoleSource } from '../source';
import { createAuditLog } from './audit';
import { buildAuditEvents } from './auditSeed';
import { buildAccounts } from './comptes';
import { MODULE_SEEDS } from './catalog';
import { createDemoClock } from './clock';
import type { Clock } from './clock';
import type { DemoContext, DemoState } from './context';
import { buildBackups, buildIncident } from './ops';
import { buildOrganisations } from './organisations';
import { buildPlans } from './plans';
import { buildRgpd } from './rgpd';
import { buildGeneral, buildNotificationPrefs, buildOperators, buildProfile, buildSecurity } from './team';
import { abonnementsApi } from './api/abonnements';
import { auditApi } from './api/audit';
import { authApi } from './api/auth';
import { comptesApi } from './api/comptes';
import { equipeApi } from './api/equipe';
import { modulesApi } from './api/modules';
import { organisationsApi } from './api/organisations';
import { overview } from './api/overview';
import { parametresApi } from './api/parametres';
import { rgpdApi, sortedRgpdRows } from './api/rgpd';
import { santeApi } from './api/sante';
import { sauvegardesApi } from './api/sauvegardes';

function shellNotifications(state: DemoState): ShellNotification[] {
  const items: Omit<ShellNotification, 'unread'>[] = [
    { id: 'n-incident', tone: 'warning', title: 'Messagerie dégradée', detail: 'Incident INC-2026-031 · 20:42', href: '/sante/incidents/inc-2026-031' },
    { id: 'n-rgpd', tone: 'info', title: "Demande d'effacement, Paul Lemoine", detail: 'À traiter avant le 10/12/2026', href: '/rgpd/paul-lemoine-effacement' },
    { id: 'n-paiement', tone: 'danger', title: 'Paiement en échec, Résidences du Parc', detail: 'Relance 2 sur 3', href: '/abonnements' },
    { id: 'n-sauvegarde', tone: 'success', title: 'Sauvegarde du 13/11 réussie', detail: '03:00 · 38,4 Go · chiffrée', href: '/sauvegardes' },
    { id: 'n-connexion', tone: 'neutral', title: 'Connexion depuis une nouvelle adresse', detail: 'Inès Garnier · 12/11, 08:12', href: '/audit' },
  ];
  return items.map((item) => ({ ...item, unread: !state.readNotifications.has(item.id) && item.id !== 'n-sauvegarde' && item.id !== 'n-connexion' }));
}

export interface DemoSourceOptions {
  clock?: Clock;
}

export function createDemoSource({ clock = createDemoClock() }: DemoSourceOptions = {}): ConsoleSource {
  const orgs = buildOrganisations();
  const state: DemoState = {
    orgs,
    plans: buildPlans(),
    accounts: buildAccounts(),
    rgpd: buildRgpd(orgs),
    incidents: [buildIncident()],
    backups: buildBackups(),
    restores: [],
    operators: buildOperators(),
    general: buildGeneral(),
    security: buildSecurity(),
    notificationPrefs: buildNotificationPrefs(),
    profile: buildProfile(),
    flags: {},
    pausedModules: new Set(),
    readNotifications: new Set(),
  };
  const ctx: DemoContext = { state, audit: createAuditLog(buildAuditEvents(orgs), clock), clock };
  const auth = authApi(ctx);

  return {
    shell: () => {
      const data: ShellData = {
        user: {
          firstName: state.profile.firstName,
          fullName: `${state.profile.firstName} ${state.profile.lastName}`,
          initials: state.profile.initials,
          email: state.profile.email,
        },
        workspace: { name: 'Équipe opérateur', ownerName: 'eGuardImmo', role: 'administrateur' },
        counts: {
          modules: MODULE_SEEDS.length,
          rgpd: sortedRgpdRows(ctx).filter((row) => row.state === 'a_traiter').length,
          support: 5,
        },
        notifications: shellNotifications(state),
      };
      return Promise.resolve(shellSchema.parse(data));
    },
    markAllNotificationsRead: () => {
      for (const item of shellNotifications(state)) state.readNotifications.add(item.id);
      return Promise.resolve();
    },
    markNotificationRead: (id) => {
      if (!shellNotifications(state).some((item) => item.id === id)) {
        return Promise.reject(new Error('Notification inconnue.'));
      }
      state.readNotifications.add(id);
      return Promise.resolve();
    },
    auth,
    overview: () => Promise.resolve(overview(ctx)),
    organisations: organisationsApi(ctx),
    comptes: comptesApi(ctx),
    modules: modulesApi(ctx),
    abonnements: abonnementsApi(ctx),
    audit: auditApi(ctx),
    rgpd: rgpdApi(ctx),
    sante: santeApi(ctx),
    sauvegardes: sauvegardesApi(ctx),
    parametres: parametresApi(ctx, auth.verifyPassword, auth.rotatePassword),
    equipe: equipeApi(ctx),
  };
}
