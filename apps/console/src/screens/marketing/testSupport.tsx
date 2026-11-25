import { screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { json, renderPlatform } from '../../../test/platform';
import type { RecordedRequest, Responder } from '../../../test/platform';
import { CAMPAIGN_IDS, campaignDetail, campaignEstimate, marketingOptions, savedCampaign } from '@/platform/marketing/fixtures';
import { consolePath } from '../abonnements/testSupport';

export const CAMPAIGN = `/marketing/campaigns/${CAMPAIGN_IDS.campaign}`;
export const SLOW = { timeout: 8000 };

export interface Setup {
  options?: Record<string, unknown>;
  campaign?: () => Response;
  estimate?: () => Response;
  write?: (request: RecordedRequest, path: string) => Response | undefined;
}

export function marketingServer({ options, campaign, estimate, write }: Setup = {}): Responder {
  return (request) => {
    const path = consolePath(request);
    if (request.method !== 'GET') return write?.(request, path) ?? json(200, savedCampaign());
    if (path === '/marketing/options') return json(200, { data: marketingOptions(options) });
    if (path === CAMPAIGN) return campaign?.() ?? json(200, { data: campaignDetail() });
    if (path === `${CAMPAIGN}/estimate`) return estimate?.() ?? json(200, campaignEstimate());
    return undefined;
  };
}

export const openMarketing = (ui: ReactElement, setup?: Setup) => renderPlatform(ui, marketingServer(setup));

/** ProseMirror mesure le curseur pour le faire défiler ; jsdom n’a pas de mise en page. */
export function stubLayout(): void {
  const rect = () => new DOMRect(0, 0, 0, 0);
  Range.prototype.getBoundingClientRect = rect;
  const none: DOMRectList = { length: 0, item: () => null, [Symbol.iterator]: () => new Array<DOMRect>().values() };
  Range.prototype.getClientRects = () => none;
  document.elementFromPoint = vi.fn(() => null);
}

export const richEditor = () => screen.findByRole('textbox', { name: 'Contenu de l’e-mail' }, SLOW);
export const codeArea = () => screen.findByRole<HTMLTextAreaElement>('textbox', { name: 'Code HTML de l’e-mail' }, SLOW);
export const button = (name: string | RegExp) => screen.getByRole<HTMLButtonElement>('button', { name });
export const previewPage = () => {
  const frame = screen.getByTitle<HTMLIFrameElement>('Aperçu de l’e-mail');
  return { frame, html: frame.getAttribute('srcdoc') ?? '' };
};
