import { Badge, Card, CardContent, CardHeader, CardTitle } from "@eguardimmo/ui";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 px-4 py-8">
      <h1 className="text-page-title">Espace agence</h1>
      <Card>
        <CardHeader>
          <CardTitle>Socle en place</CardTitle>
          <Badge tone="info">En construction</Badge>
        </CardHeader>
        <CardContent>
          <p className="text-fg-muted">Les écrans de l&apos;espace agence arrivent ici.</p>
        </CardContent>
      </Card>
    </main>
  );
}
