import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import type { Period } from '../schemas/lots';
import { OccupationTimeline } from './OccupationTimeline';

const period = (id: string, kind: Period['kind'], startDate: string, endDate: string | null, occupant: string | null): Period => ({
  id, kind, startDate, endDate, occupant: occupant ? { id: `p-${id}`, name: occupant } : null, leaseType: kind === 'bail' ? 'Bail meublé' : null, note: null,
  status: kind === 'bail' ? (endDate ? 'termine' : 'en_cours') : null, noticeEndsOn: null, entryRent: null, lastRent: null, deposit: null, exitNote: null,
});

const PERIODS = [period('b1', 'bail', '2022-01-01', '2023-12-31', 'Anaïs Roux'), period('v1', 'vacance', '2024-01-01', '2024-03-31', null), period('b2', 'bail', '2024-04-01', null, 'Karim Diallo')];

describe('frise d’occupation', () => {
  it('décrit chaque période sans exposer de bouton sans action', () => {
    const { container } = render(<OccupationTimeline periods={PERIODS} asOf="2026-11-13" />);
    expect(screen.queryByRole('button')).toBeNull();
    const items = within(screen.getByRole('list', { name: 'Frise d’occupation' })).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    const labels = items.map((item) => within(item).getByRole('img').getAttribute('aria-label'));
    expect(labels[0]).toMatch(/Anaïs Roux, Bail meublé · 01\/01\/2022 au 31\/12\/2023/);
    expect(labels[1]).toMatch(/Vacance · 01\/01\/2024 au 31\/03\/2024/);
    expect(labels[2]).toMatch(/Karim Diallo.* au ce jour/);
    return expectNoA11yViolations(container);
  });
});
