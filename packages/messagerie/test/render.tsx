import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ComponentProps, ReactElement } from 'react';
import { vi } from 'vitest';
import { MessagerieProvider } from '../src/config';
import type { MessagerieRoutes } from '../src/config';
import { createDemoMessagerieSource } from '../src/data/demo';
import type { MessagerieSpace } from '../src/data/demo';
import type { MessagerieSource } from '../src/data/source';
import { messagerieProfiles } from '../src/profiles';

export const FIXED_NOW = new Date('2026-11-13T10:00:00+01:00');

export const testRoutes: MessagerieRoutes = {
  inbox: '/messages',
  conversation: (id) => `/messages/${id}`,
  newMessage: '/messages/nouveau',
  campaigns: '/messages/campagnes',
  newCampaign: '/messages/campagnes/nouvelle',
  editCampaign: (id) => `/messages/campagnes/${id}`,
  help: '/aide',
  supportBoard: '/support',
  ticket: (id) => `/support/${id}`,
};

export function TestLink({ children, ...props }: ComponentProps<'a'> & { href: string }) {
  return <a {...props}>{children}</a>;
}

export interface RenderOptions {
  space?: MessagerieSpace;
  source?: MessagerieSource;
  now?: Date;
}

export function renderMessagerie(ui: ReactElement, options: RenderOptions = {}) {
  const { space = 'locataire', now = FIXED_NOW } = options;
  const source = options.source ?? createDemoMessagerieSource({ space, now: () => now });
  const navigate = vi.fn<(href: string) => void>();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <MessagerieProvider
        source={source}
        profile={messagerieProfiles[space]}
        routes={testRoutes}
        Link={TestLink}
        navigate={navigate}
      >
        {ui}
      </MessagerieProvider>
    </QueryClientProvider>,
  );
  return { ...view, source, navigate };
}

export function brokenSource(source: MessagerieSource, failing: (keyof MessagerieSource)[]): MessagerieSource {
  const reject = () => Promise.reject(new Error('Service indisponible'));
  const patch: Partial<Record<keyof MessagerieSource, () => Promise<never>>> = {};
  for (const key of failing) patch[key] = reject;
  return { ...source, ...patch };
}

export function pdf(name = 'devis.pdf', size = 2048): File {
  return new File([new Uint8Array(size)], name, { type: 'application/pdf' });
}
