import { describe, expect, it } from 'vitest';
import { clientIp } from './clientIp';

function withForwarded(value: string | null): Request {
  return new Request('http://localhost:3050/session', { headers: value === null ? {} : { 'x-forwarded-for': value } });
}

describe('clientIp', () => {
  it('prend l’adresse ajoutée par le dernier proxy de confiance', () => {
    expect(clientIp(withForwarded('203.0.113.7'), 1)).toBe('203.0.113.7');
    expect(clientIp(withForwarded('6.6.6.6, 203.0.113.7'), 1)).toBe('203.0.113.7');
    expect(clientIp(withForwarded('6.6.6.6, 203.0.113.7, 10.0.0.2'), 2)).toBe('203.0.113.7');
    expect(clientIp(withForwarded('2001:db8::1'), 1)).toBe('2001:db8::1');
  });

  it('ne renvoie rien sans adresse exploitable', () => {
    expect(clientIp(withForwarded(null), 1)).toBeNull();
    expect(clientIp(withForwarded('pas-une-ip'), 1)).toBeNull();
    expect(clientIp(withForwarded('203.0.113.7'), 2)).toBeNull();
  });
});
