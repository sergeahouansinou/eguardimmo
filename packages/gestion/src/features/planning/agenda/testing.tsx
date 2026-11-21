import type { ReactElement } from 'react';
import { vi } from 'vitest';
import type { Certificate } from '../../conformite/model';
import type { Intervention } from '../../maintenance/model';
import type { OrgInfoSource } from '../../orgapi/source';
import { TEST_LEASE, TEST_PROPERTY, TEST_UNIT, TEST_USER, orgInfoStub, renderWithOrg } from '../../orgapi/testing';
import type { RenderOrgOptions } from '../../orgapi/testing';
import type { EventInput, Occurrence, PlanningEvent, PlanningTask, TaskPage } from '../model';
import { PlanningSourceProvider } from '../source';
import type { PlanningSource } from '../source';

export const TEST_EVENT = '0198a0a0-0000-7000-8000-0000000000e1';
export const TEST_TASK = '0198a0a0-0000-7000-8000-0000000000f1';

export const occurrence = (overrides: Partial<Occurrence> = {}): Occurrence => ({
  eventId: TEST_EVENT,
  occurrenceOn: '2026-11-21',
  kind: 'visit',
  title: 'Visite appartement 12',
  startTime: '14:00',
  timezone: 'Europe/Paris',
  allDay: false,
  startsAt: '2026-11-21T13:00:00Z',
  recurrence: 'none',
  propertyId: TEST_PROPERTY,
  unitId: TEST_UNIT,
  leaseId: null,
  ...overrides,
});

export const planningEvent = (overrides: Partial<PlanningEvent> = {}): PlanningEvent => ({
  id: TEST_EVENT,
  kind: 'visit',
  title: 'Visite appartement 12',
  notes: 'Apporter les clés.',
  startsOn: '2026-11-21',
  startTime: '14:00',
  timezone: 'Europe/Paris',
  allDay: false,
  recurrence: 'none',
  recurrenceUntil: null,
  reminderOffsetMinutes: 60,
  propertyId: TEST_PROPERTY,
  unitId: TEST_UNIT,
  leaseId: TEST_LEASE,
  attendees: [{ userId: TEST_USER, partyId: null }],
  createdByUserId: TEST_USER,
  cancelledAt: null,
  lockVersion: 3,
  ...overrides,
});

export const planningTask = (overrides: Partial<PlanningTask> = {}): PlanningTask => ({
  id: TEST_TASK,
  title: 'Relancer le locataire',
  dueOn: '2026-11-23',
  status: 'open',
  isOverdue: false,
  assigneeUserId: null,
  assigneeActive: null,
  doneAt: null,
  doneByUserId: null,
  remindDaysBefore: null,
  propertyId: null,
  unitId: null,
  leaseId: null,
  createdByUserId: TEST_USER,
  lockVersion: 1,
  ...overrides,
});

export function planningStub(overrides: Partial<PlanningSource> = {}): PlanningSource {
  const unused = () => Promise.reject(new Error('Appel non prévu dans ce test.'));
  const emptyPage: TaskPage = { items: [], nextCursor: null };
  return {
    occurrences: vi.fn<PlanningSource['occurrences']>(() => Promise.resolve([])),
    event: vi.fn<PlanningSource['event']>(() => Promise.resolve(planningEvent())),
    createEvent: vi.fn<PlanningSource['createEvent']>((input: EventInput) => Promise.resolve(planningEvent({ title: input.title }))),
    updateEvent: vi.fn<PlanningSource['updateEvent']>((_id, _version, input: EventInput) => Promise.resolve(planningEvent({ title: input.title }))),
    cancelEvent: vi.fn<PlanningSource['cancelEvent']>(() => Promise.resolve(planningEvent({ cancelledAt: '2026-11-21T10:00:00Z' }))),
    tasks: vi.fn<PlanningSource['tasks']>(() => Promise.resolve(emptyPage)),
    task: unused,
    createTask: unused,
    updateTask: unused,
    completeTask: unused,
    reopenTask: unused,
    cancelTask: unused,
    bulkComplete: unused,
    bulkPostpone: unused,
    bulkAssign: unused,
    ...overrides,
  };
}

export function renderAgenda(ui: ReactElement, source: PlanningSource = planningStub(), options: RenderOrgOptions = {}) {
  return renderWithOrg(ui, { ...options, providers: (children) => <PlanningSourceProvider source={source}>{options.providers ? options.providers(children) : children}</PlanningSourceProvider> });
}

export const interventionFixture = (overrides: Partial<Intervention> = {}): Intervention => ({
  id: '0198a0a0-0000-7000-8000-0000000000d1',
  reference: 'INT-2026-014',
  origin: 'team',
  status: 'scheduled',
  priority: 'normal',
  reportedUrgency: null,
  natureTermId: '0198a0a0-0000-7000-8000-0000000000d2',
  title: 'Réparer la fuite du lavabo',
  description: 'Fuite sous le lavabo.',
  room: null,
  availability: null,
  propertyId: null,
  unitId: null,
  unit: null,
  leaseId: null,
  mandateId: null,
  mandant: null,
  reporter: null,
  supplier: null,
  responsibility: 'owner',
  reportedOn: '2026-11-10',
  dueOn: '2026-11-25',
  estimatedAmount: null,
  ceilingAmount: null,
  approvalBasis: null,
  emergencyReason: null,
  declineReason: null,
  declineNote: null,
  completedOn: null,
  completionNote: null,
  closedAt: null,
  followsInterventionId: null,
  visits: [],
  lockVersion: 1,
  createdAt: null,
  ...overrides,
});

export const certificateFixture = (overrides: Partial<Certificate> = {}): Certificate => ({
  id: '0198a0a0-0000-7000-8000-0000000000d3',
  subject: { type: 'organization', id: '0198a0a0-0000-7000-8000-000000000001' },
  type: { id: '0198a0a0-0000-7000-8000-0000000000d4', key: 'boiler_service', label: 'Entretien de la chaudière', semanticKey: null },
  reference: 'CH-2025',
  issuerPartyId: null,
  issuedOn: '2025-11-30',
  expiresOn: '2026-11-30',
  state: 'to_renew',
  values: {},
  storedFileId: null,
  replacesId: null,
  replacedById: null,
  ...overrides,
});

export const infoInZone = (timezone: string): OrgInfoSource => ({ ...orgInfoStub(), timezone: () => Promise.resolve(timezone) });
