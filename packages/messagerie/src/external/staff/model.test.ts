import { describe, expect, it } from 'vitest';
import { staffCapabilities } from './model';

describe('capacités selon le rôle et le type d’organisation', () => {
  it.each([
    ['owner', 'agency', { readExternal: true, kinds: ['tenant', 'owner'], administer: true }],
    ['admin', 'agency', { readExternal: true, kinds: ['tenant', 'owner'], administer: true }],
    ['manager', 'agency', { readExternal: true, kinds: ['tenant', 'owner'], administer: false }],
    ['accountant', 'agency', { readExternal: false, kinds: [], administer: false }],
    ['owner', 'individual', { readExternal: true, kinds: ['tenant'], administer: true }],
    ['accountant', 'individual', { readExternal: false, kinds: [], administer: false }],
  ] as const)('%s dans une organisation %s', (role, kind, expected) => {
    expect(staffCapabilities(role, kind)).toEqual(expected);
  });
});
