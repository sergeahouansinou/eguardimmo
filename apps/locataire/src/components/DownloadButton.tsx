import { IconButton } from '@eguardimmo/ui';
import { Download } from 'lucide-react';

export function DownloadButton({ label, pending = false, onDownload }: { label: string; pending?: boolean; onDownload: () => void }) {
  return <IconButton label={label} icon={Download} variant="secondary" disabled={pending} onClick={onDownload} />;
}
