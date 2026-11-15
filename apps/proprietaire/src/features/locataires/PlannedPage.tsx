import { Alert } from "@eguardimmo/ui";

export function PlannedPage({ title }: { title: string }) {
  return (
    <>
      <h1 className="text-page-title">{title}</h1>
      <Alert tone="info" title="Écran prévu dans un prochain lot">
        Cette page fait partie de la maquette de l&apos;espace bailleur. Elle sera livrée avec son module.
      </Alert>
    </>
  );
}
