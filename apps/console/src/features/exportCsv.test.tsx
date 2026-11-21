import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_NOW } from '@/console/demo/clock';
import { organisationListSchema, subscriptionsOverviewSchema } from '@/console/schemas';
import { createDemoSource } from '@/console/demo/source';
import type { ConsoleSource } from '@/console/source';
import { downloadTextFile } from '@/lib/download';
import { renderWithSource } from '../../test/render';
import { AbonnementsScreen } from './abonnements/AbonnementsScreen';
import { OrganisationsScreen } from './organisations/OrganisationsScreen';

vi.mock('@/lib/download', () => ({ downloadTextFile: vi.fn<(name: string, content: string) => void>() }));

const demo = createDemoSource({ clock: () => new Date(DEMO_NOW) });

function downloaded(): { name: string; content: string } {
  const [name = '', content = ''] = vi.mocked(downloadTextFile).mock.calls[0] ?? [];
  return { name, content };
}

describe('exports CSV de la console', () => {
  beforeEach(() => {
    vi.mocked(downloadTextFile).mockReset();
  });

  it('neutralise les formules et protège les séparateurs dans l’export des plans', async () => {
    const overview = subscriptionsOverviewSchema.parse(await demo.abonnements.overview());
    const [first, ...others] = overview.plans;
    if (!first) throw new Error('plan de démonstration absent');
    const hostile: ConsoleSource = {
      ...demo,
      abonnements: {
        ...demo.abonnements,
        overview: () => Promise.resolve({ ...overview, plans: [{ ...first, name: '=HYPERLINK("http://x";"y")', tagline: 'a;b\nc' }, ...others] }),
      },
    };
    renderWithSource(<AbonnementsScreen />, hostile);
    await userEvent.click(await screen.findByRole('button', { name: 'Exporter' }));

    const { name, content } = downloaded();
    expect(name).toBe('abonnements.csv');
    expect(content.split('\r\n')[1]?.startsWith('"\'=HYPERLINK(""http://x"";""y"")";"a;b\nc";')).toBe(true);
  });

  it('neutralise les formules dans l’export des organisations', async () => {
    const list = organisationListSchema.parse(await demo.organisations.list({ page: 1, pageSize: 100 }));
    const [first, ...others] = list.rows;
    if (!first) throw new Error('organisation de démonstration absente');
    const hostile: ConsoleSource = {
      ...demo,
      organisations: {
        ...demo.organisations,
        list: () => Promise.resolve({ ...list, total: list.rows.length, rows: [{ ...first, name: '@cmd|calc' }, ...others] }),
      },
    };
    renderWithSource(<OrganisationsScreen />, hostile);
    await userEvent.click(await screen.findByRole('button', { name: /Exporter/ }));

    await waitFor(() => { expect(downloadTextFile).toHaveBeenCalled(); });
    const { name, content } = downloaded();
    expect(name).toBe('organisations.csv');
    expect(content.split('\r\n')[1]?.startsWith("'@cmd|calc;")).toBe(true);
  });
});
