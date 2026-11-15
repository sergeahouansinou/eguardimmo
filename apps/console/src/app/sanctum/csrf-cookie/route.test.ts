import { describe, expect, it, vi } from 'vitest';

vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
import { GET } from './route';

describe('GET /sanctum/csrf-cookie', () => {
  it('répond 204 sans cookie', async () => {
    const response = await GET();
    expect(response.status).toBe(204);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
