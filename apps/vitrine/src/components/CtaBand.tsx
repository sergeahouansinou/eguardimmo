import { Container } from "./Container";
import { LinkButton } from "./LinkButton";

export function CtaBand() {
  return (
    <section aria-labelledby="cta-titre" className="on-dark bg-nav text-fg-inverse">
      <Container className="flex flex-wrap items-center justify-between gap-6 py-12">
        <div className="flex min-w-0 flex-[1_1_20rem] flex-col gap-2">
          <h2 id="cta-titre" className="text-balance text-display">
            Voyez eGuardImmo sur vos données
          </h2>
          <p className="text-lead text-nav-fg">Demandez une démonstration avec un portefeuille d’exemple.</p>
        </div>
        <LinkButton href="/contact" variant="secondary">
          Demander une démonstration
        </LinkButton>
      </Container>
    </section>
  );
}
