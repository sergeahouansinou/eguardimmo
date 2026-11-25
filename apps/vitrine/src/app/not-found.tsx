import { Container } from "@/components/Container";
import { LinkButton } from "@/components/LinkButton";

export default function NotFound() {
  return (
    <Container className="flex max-w-2xl flex-col items-start gap-4 py-16">
      <h1 className="text-display text-fg">Page introuvable</h1>
      <p className="text-prose text-fg-muted">L’adresse demandée n’existe pas sur ce site.</p>
      <LinkButton href="/">Revenir à l’accueil</LinkButton>
    </Container>
  );
}
