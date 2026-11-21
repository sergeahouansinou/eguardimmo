import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, renderPlatform } from '../../../test/platform';
import type { RecordedRequest, Responder } from '../../../test/platform';
import { accountFile, suspensionState } from '@/platform/accounts/fixtures';
import { IDS } from '@/platform/fixtures';
import { consolePath, withOperator } from '../organisations/testSupport';
import { CompteScreen } from './CompteScreen';

export const ACCOUNT = `/accounts/${IDS.user}`;

export interface Setup {
  roles?: string[];
  pending?: Record<string, unknown>[];
  account?: () => Response;
  write?: (request: RecordedRequest) => Response;
}

function server({ roles, pending, account, write }: Setup = {}): Responder {
  return withOperator({ roles, pending }, (request) => {
    const path = consolePath(request);
    if (request.method === 'GET' && path === ACCOUNT) return (account ?? (() => json(200, { data: accountFile() })))();
    if (request.method === 'POST' && (path === '/approvals' || path.startsWith(`${ACCOUNT}/`))) return (write ?? (() => json(200, { data: accountFile() })))(request);
    return undefined;
  });
}

export const open = (setup?: Setup) => renderPlatform(<CompteScreen id={IDS.user} />, server(setup));
export const user = () => userEvent.setup();
export const proofCode = () => screen.findByRole('textbox', { name: 'Code de double authentification' });
export const suspended = (overrides: Record<string, unknown> = {}) => accountFile({ suspension: suspensionState(overrides) });
export const actions = () => within(screen.getByRole('region', { name: 'Actions' }));
