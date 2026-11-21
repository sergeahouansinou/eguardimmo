import { describe, expect, it } from 'vitest';
import { invoicingPermissions } from './permissions';

describe('droits de facturation', () => {
  it.each([
    ['owner', 'agency', true, true],
    ['admin', 'agency', true, true],
    ['manager', 'agency', true, false],
    ['accountant', 'agency', true, true],
  ] as const)('%s dans une %s : écriture=%s, avoir=%s', (role, kind, write, credit) => {
    expect(invoicingPermissions(role, kind)).toEqual({ available: true, write, credit });
  });

  it('refuse tout à une organisation individuelle, à un rôle absent et à un type inconnu', () => {
    const none = { available: false, write: false, credit: false };
    expect(invoicingPermissions('owner', 'individual')).toEqual(none);
    expect(invoicingPermissions(null, 'agency')).toEqual(none);
    expect(invoicingPermissions('owner', null)).toEqual(none);
  });
});
