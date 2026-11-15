import { Alert } from '@eguardimmo/ui';

export interface PlannedScreenProps {
  title: string;
  description?: string;
}

export function PlannedScreen({
  title,
  description = 'Cette page fait partie de la maquette. Elle sera livrée avec son module.',
}: PlannedScreenProps) {
  return (
    <>
      <h1 className="text-page-title">{title}</h1>
      <Alert tone="info" title="Écran prévu dans un prochain lot">
        {description}
      </Alert>
    </>
  );
}
