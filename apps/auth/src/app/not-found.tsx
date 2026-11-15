import Link from "next/link";

export default function NotFound() {
  return (
    <main id="contenu" className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-3 px-4 py-10">
      <h1 className="text-page-title">Page introuvable</h1>
      <p className="text-fg-muted">L&apos;adresse demandée n&apos;existe pas.</p>
      <Link href="/connexion" className="text-action-on-subtle underline underline-offset-3">
        Revenir à la connexion
      </Link>
    </main>
  );
}
