'use client';

import { Download, RefreshCw } from 'lucide-react';
import { Button, Icon } from '@eguardimmo/ui';
import { pushFlash } from '../../kit';
import { formatStamp } from '../format';

export interface ScreenActionsProps {
  stamp: string | undefined;
  onRefresh: () => void;
  onExport: (() => void) | undefined;
}

export function ScreenActions({ stamp, onRefresh, onExport }: ScreenActionsProps) {
  return (
    <>
      {stamp ? <span className="text-caption text-fg-subtle">{`Données au ${formatStamp(stamp)}`}</span> : null}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          onRefresh();
          pushFlash('Données actualisées.');
        }}
      >
        <Icon icon={RefreshCw} />
        Actualiser
      </Button>
      <Button variant="secondary" disabled={!onExport} onClick={onExport}>
        <Icon icon={Download} />
        Exporter
      </Button>
    </>
  );
}
