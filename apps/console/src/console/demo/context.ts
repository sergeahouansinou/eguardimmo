import { ConsoleError } from '../schemas/common';
import type { Plan } from '../schemas/abonnements';
import type { Operator } from '../schemas/equipe';
import type { GeneralSettings, NotificationPrefs, Profile, SecuritySettings } from '../schemas/parametres';
import type { Backup, RestoreRequest } from '../schemas/sauvegardes';
import type { AccountRecord } from './comptes';
import type { AuditLog } from './audit';
import type { Clock } from './clock';
import type { IncidentRecord } from './ops';
import type { OrgRecord } from './organisations';
import type { RgpdRecord } from './rgpd';

export interface DemoState {
  orgs: OrgRecord[];
  plans: Plan[];
  accounts: AccountRecord[];
  rgpd: RgpdRecord[];
  incidents: IncidentRecord[];
  backups: Backup[];
  restores: RestoreRequest[];
  operators: Operator[];
  general: GeneralSettings;
  security: SecuritySettings;
  notificationPrefs: NotificationPrefs;
  profile: Profile;
  flags: Record<string, boolean>;
  pausedModules: Set<string>;
  readNotifications: Set<string>;
}

export interface DemoContext {
  state: DemoState;
  audit: AuditLog;
  clock: Clock;
}

export function requireFound<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new ConsoleError('not_found', `${what} introuvable.`);
  return value;
}
