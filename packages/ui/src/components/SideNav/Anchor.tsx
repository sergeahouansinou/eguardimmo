import type { ComponentProps } from 'react';

export function Anchor({ children, ...props }: ComponentProps<'a'> & { href: string }) {
  return <a {...props}>{children}</a>;
}
