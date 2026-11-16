import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GestionDataModeProvider } from '../../locataires';
import { MemberTable } from './MemberTable';
import type { Member } from './schemas';

function TestLink({ children, ...props }: ComponentProps<'a'> & { href: string }) {
  return <a {...props}>{children}</a>;
}

const member: Member = {
  id: 'm1',
  firstName: 'Awa',
  lastName: 'Diallo',
  email: 'awa.diallo@example.com',
  role: 'titulaire',
  scope: { type: 'all' },
  twoFactor: 'activee',
  lastLogin: '2026-12-24T09:15:00+00:00',
  online: false,
  status: 'actif',
  self: true,
};

function renderTable(mode: 'demo' | 'api', row: Member = member) {
  return render(
    <GestionDataModeProvider mode={mode}>
      <MemberTable Link={TestLink} rows={[row]} members={[row]} onAction={vi.fn()} />
    </GestionDataModeProvider>,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('tableau des membres', () => {
  it('en mode api, compare la dernière connexion à la date réelle', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-12-24T12:00:00Z'));

    renderTable('api');

    expect(screen.getByText(/^Aujourd'hui, /)).toBeTruthy();
  });

  it('en mode api, une connexion d’un autre jour affiche sa date', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2027-01-05T12:00:00Z'));

    renderTable('api');

    expect(screen.queryByText(/^Aujourd'hui, /)).toBeNull();
  });

  it('en démonstration, garde le jour de référence de la démo', () => {
    renderTable('demo', { ...member, lastLogin: '2026-11-13T09:15:00+00:00' });

    expect(screen.getByText(/^Aujourd'hui, /)).toBeTruthy();
  });
});
