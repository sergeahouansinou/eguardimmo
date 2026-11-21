import { describe, expect, it } from 'vitest';
import { certificateItem, groupByDay, interventionItems, occurrenceItem, taskItem } from './items';
import { certificateFixture, interventionFixture, occurrence, planningTask } from './testing';

describe('éléments d’agenda', () => {
  it('place une occurrence datée selon le fuseau de l’organisation', () => {
    const late = occurrence({ occurrenceOn: '2026-11-21', startsAt: '2026-11-21T23:30:00Z', startTime: '23:30', timezone: 'UTC' });
    expect(occurrenceItem(late, 'Europe/Paris')).toMatchObject({ date: '2026-11-22', time: '00:30' });
    expect(occurrenceItem(late, 'America/Toronto')).toMatchObject({ date: '2026-11-21', time: '18:30' });
  });

  it('garde la date de l’occurrence pour une journée entière', () => {
    expect(occurrenceItem(occurrence({ allDay: true, startTime: null, startsAt: null, timezone: null }), 'Europe/Paris')).toMatchObject({ date: '2026-11-21', time: null, href: '/agenda/0198a0a0-0000-7000-8000-0000000000e1' });
  });

  it('relie les tâches, interventions et certificats à leur fiche', () => {
    expect(taskItem(planningTask())).toMatchObject({ href: '/taches/0198a0a0-0000-7000-8000-0000000000f1', date: '2026-11-23', alert: false });
    expect(taskItem(planningTask({ isOverdue: true }))).toMatchObject({ alert: true, label: 'Tâche en retard' });
    expect(interventionItems(interventionFixture())).toMatchObject([{ href: '/interventions/0198a0a0-0000-7000-8000-0000000000d1', date: '2026-11-25', label: 'Intervention à échéance' }]);
    expect(certificateItem(certificateFixture())).toMatchObject({ href: '/conformite/0198a0a0-0000-7000-8000-0000000000d3', title: 'Entretien de la chaudière (CH-2025)' });
  });

  it('écarte les interventions terminées et les certificats sans échéance', () => {
    expect(interventionItems(interventionFixture({ status: 'closed' }))).toEqual([]);
    expect(interventionItems(interventionFixture({ status: 'completed' }))).toEqual([]);
    expect(interventionItems(interventionFixture({ dueOn: null }))).toEqual([]);
    expect(certificateItem(certificateFixture({ expiresOn: null }))).toBeNull();
  });

  it('place chaque visite planifiée sur sa vraie date, à la place de l’échéance', () => {
    const items = interventionItems(
      interventionFixture({
        visits: [
          { id: 'v1', scheduledOn: '2026-11-18', slot: 'morning', status: 'confirmed' },
          { id: 'v2', scheduledOn: '2026-11-20', slot: 'afternoon', status: 'reschedule_requested' },
        ],
      }),
    );
    expect(items.map((item) => [item.date, item.label, item.alert])).toEqual([
      ['2026-11-18', 'Visite d’intervention · matin', false],
      ['2026-11-20', 'Visite d’intervention · après-midi', true],
    ]);
    expect(new Set(items.map((item) => item.key)).size).toBe(2);
  });

  it('ignore les visites terminées ou annulées et retombe sur l’échéance', () => {
    const items = interventionItems(
      interventionFixture({
        visits: [
          { id: 'v1', scheduledOn: '2026-11-18', slot: 'morning', status: 'done' },
          { id: 'v2', scheduledOn: '2026-11-19', slot: 'morning', status: 'cancelled' },
          { id: 'v3', scheduledOn: '2026-11-19', slot: 'evening', status: 'no_show' },
        ],
      }),
    );
    expect(items.map((item) => item.date)).toEqual(['2026-11-25']);
  });

  it('garde une visite planifiée même sans échéance', () => {
    const items = interventionItems(interventionFixture({ dueOn: null, visits: [{ id: 'v1', scheduledOn: '2026-11-18', slot: 'evening', status: 'proposed' }] }));
    expect(items.map((item) => item.date)).toEqual(['2026-11-18']);
  });

  it('groupe par jour, journée entière d’abord puis par heure, et ignore les jours hors grille', () => {
    const days = ['2026-11-21', '2026-11-22'];
    const grouped = groupByDay(
      [
        occurrenceItem(occurrence({ eventId: 'a', title: 'Tard', startsAt: '2026-11-21T17:00:00Z' }), 'Europe/Paris'),
        occurrenceItem(occurrence({ eventId: 'b', title: 'Tôt', startsAt: '2026-11-21T08:00:00Z' }), 'Europe/Paris'),
        occurrenceItem(occurrence({ eventId: 'c', title: 'Journée', allDay: true, startTime: null, startsAt: null }), 'Europe/Paris'),
        occurrenceItem(occurrence({ eventId: 'd', title: 'Hors grille', occurrenceOn: '2026-12-01', startsAt: '2026-12-01T08:00:00Z' }), 'Europe/Paris'),
      ],
      days,
    );
    expect(grouped.get('2026-11-21')?.map((item) => item.title)).toEqual(['Journée', 'Tôt', 'Tard']);
    expect(grouped.get('2026-11-22')).toEqual([]);
    expect(grouped.has('2026-12-01')).toBe(false);
  });
});
