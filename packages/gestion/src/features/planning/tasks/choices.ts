'use client';

import type { SelectOption } from '@eguardimmo/ui';
import { useCurrentUser, useOrgLeaseChoices, useOrgMembers, useOrgPropertyChoices } from '../../orgapi';
import type { PlanningTask } from '../model';
import { INACTIVE_ASSIGNEE, UNKNOWN_ASSIGNEE } from './labels';

export function useTaskChoices() {
  const members = useOrgMembers();
  const me = useCurrentUser();
  const properties = useOrgPropertyChoices();
  const leases = useOrgLeaseChoices();

  const memberOptions: SelectOption[] = (members.data?.choices ?? []).map((member) => ({ value: member.userId, label: member.self ? `${member.name} (moi)` : member.name }));

  const assigneeLabel = (task: Pick<PlanningTask, 'assigneeUserId' | 'assigneeActive'>): string => {
    if (task.assigneeUserId === null) return 'Non assignée';
    const known = members.data?.choices.find((member) => member.userId === task.assigneeUserId);
    if (known) return known.self ? `${known.name} (moi)` : known.name;
    if (task.assigneeUserId === me.data?.id) return `${me.data.name} (moi)`;
    return task.assigneeActive === false ? INACTIVE_ASSIGNEE : UNKNOWN_ASSIGNEE;
  };

  const propertyName = (id: string): string => properties.data?.find((property) => property.id === id)?.name ?? (properties.isPending ? '…' : 'Bien');
  const leaseLabel = (id: string): string => {
    const lease = leases.data?.find((candidate) => candidate.id === id);
    return lease ? lease.reference : leases.isPending ? '…' : 'Bail';
  };

  return {
    members,
    me,
    properties,
    leases,
    memberOptions,
    propertyOptions: (properties.data ?? []).map((property): SelectOption => ({ value: property.id, label: property.name })),
    leaseOptions: (leases.data ?? []).map((lease): SelectOption => ({ value: lease.id, label: [lease.reference, lease.tenantNames.join(', ')].filter((part) => part !== '').join(' · '), description: [lease.unitReference, lease.propertyName].filter((part): part is string => part !== null).join(' · ') })),
    assigneeLabel,
    propertyName,
    leaseLabel,
  };
}
