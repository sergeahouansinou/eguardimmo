import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { router } from './navigation';

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next/image', () => ({
  default: () => <span aria-hidden="true" />,
}));

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  },
);

Element.prototype.hasPointerCapture = vi.fn(() => false);
Element.prototype.releasePointerCapture = vi.fn();
Element.prototype.scrollIntoView = vi.fn();

afterEach(cleanup);
