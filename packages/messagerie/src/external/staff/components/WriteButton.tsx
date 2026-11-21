'use client';

import { Send } from 'lucide-react';
import { useState } from 'react';
import { Button, Icon } from '@eguardimmo/ui';
import type { ButtonProps } from '@eguardimmo/ui';
import { useOptionalStaffConfig } from '../context';
import { ComposeDialog } from './ComposeDialog';
import type { StaffWriteTarget } from './ComposeDialog';

export interface StaffWriteButtonProps {
  target: StaffWriteTarget;
  label?: string;
  variant?: ButtonProps['variant'];
}

export function StaffWriteButton({ target, label = 'Écrire', variant }: StaffWriteButtonProps) {
  const config = useOptionalStaffConfig();
  const [open, setOpen] = useState(false);
  if (!config?.capabilities.kinds.includes(target.kind)) return null;
  if (target.kind === 'tenant' && !target.links?.length) return null;
  return (
    <>
      <Button {...(variant ? { variant } : {})} onClick={() => { setOpen(true); }}>
        <Icon icon={Send} />
        {label}
      </Button>
      <ComposeDialog target={target} open={open} onOpenChange={setOpen} />
    </>
  );
}
