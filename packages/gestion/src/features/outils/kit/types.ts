import type { LinkComponent } from '@eguardimmo/ui';

export interface ScreenProps {
  Link: LinkComponent;
  navigate: (href: string) => void;
}
