import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <h1 className="text-page-title">Page introuvable</h1>
      <p className="text-fg-muted">L&apos;adresse demandée n&apos;existe pas dans l&apos;espace agence.</p>
      <Link href="/" className="text-action-on-subtle underline underline-offset-3">
        Revenir à l&apos;accueil
      </Link>
    </div>
  );
}
