import type { ApiClient } from '@eguardimmo/api';
import { accountsApi } from './accounts/accounts';
import type { AccountsApi } from './accounts/accounts';
import { operatorsApi } from './accounts/operators';
import type { OperatorsApi } from './accounts/operators';
import { approvalsApi } from './approvals/approvals';
import type { ApprovalsApi } from './approvals/approvals';
import { marketingApi } from './marketing/marketing';
import type { MarketingApi } from './marketing/marketing';
import { fetchOperator } from './me/me';
import type { OperatorMe } from './me/me';
import { notificationSettingsApi } from './notificationSettings/notificationSettings';
import type { NotificationSettingsApi } from './notificationSettings/notificationSettings';
import { fetchBackups, fetchHealth, fetchSettings } from './operations/operations';
import type { BackupsPage, BackupsQuery, Health, PlatformSettings } from './operations/operations';
import { organisationsApi } from './organisations/organisations';
import type { OrganisationsApi } from './organisations/organisations';
import { supportAccessesApi } from './organisations/supportAccesses';
import type { SupportAccessesApi } from './organisations/supportAccesses';
import { fetchOverview } from './overview/overview';
import type { Overview } from './overview/overview';
import { plansApi } from './plans/plans';
import type { PlansApi } from './plans/plans';
import { subscriptionsApi } from './plans/subscriptions';
import type { SubscriptionsApi } from './plans/subscriptions';
import { privacyApi } from './privacy/privacy';
import type { PrivacyApi } from './privacy/privacy';

export interface PlatformApi {
  me: () => Promise<OperatorMe>;
  overview: () => Promise<Overview>;
  approvals: ApprovalsApi;
  organisations: OrganisationsApi;
  supportAccesses: SupportAccessesApi;
  accounts: AccountsApi;
  operators: OperatorsApi;
  plans: PlansApi;
  subscriptions: SubscriptionsApi;
  privacy: PrivacyApi;
  marketing: MarketingApi;
  notificationSettings: NotificationSettingsApi;
  health: () => Promise<Health>;
  backups: (query?: BackupsQuery) => Promise<BackupsPage>;
  settings: () => Promise<PlatformSettings>;
}

export function createPlatformApi(client: ApiClient): PlatformApi {
  return {
    me: () => fetchOperator(client),
    overview: () => fetchOverview(client),
    approvals: approvalsApi(client),
    organisations: organisationsApi(client),
    supportAccesses: supportAccessesApi(client),
    accounts: accountsApi(client),
    operators: operatorsApi(client),
    plans: plansApi(client),
    subscriptions: subscriptionsApi(client),
    privacy: privacyApi(client),
    marketing: marketingApi(client),
    notificationSettings: notificationSettingsApi(client),
    health: () => fetchHealth(client),
    backups: (query) => fetchBackups(client, query),
    settings: () => fetchSettings(client),
  };
}
