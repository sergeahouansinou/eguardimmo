import { CtaBand } from "@/components/CtaBand";
import { FaqAccordion } from "@/components/FaqAccordion";
import { FeatureGrid } from "@/components/FeatureGrid";
import { Hero } from "@/components/Hero";
import { LinkButton } from "@/components/LinkButton";
import { ProfileTabs } from "@/components/ProfileTabs";
import { Section } from "@/components/Section";
import { SpaceCards } from "@/components/SpaceCards";
import { FAQ } from "@/content/faq";
import { FEATURES } from "@/content/features";

export default function HomePage() {
  return (
    <>
      <Hero
        eyebrow="Gestion locative · France"
        title="La gestion locative d’une agence, dans un espace pour chaque acteur"
        lead="Baux, loyers, mandats, fonds des propriétaires, états des lieux et messagerie : agence, propriétaire et locataire travaillent sur les mêmes données, chacun avec ses droits."
        decoration
        actions={
          <>
            <LinkButton href="/contact" variant="secondary">
              Demander une démonstration
            </LinkButton>
            <LinkButton href="#fonctions">Voir les fonctions</LinkButton>
          </>
        }
      />
      <Section id="espaces" title="Un espace par profil, un seul compte" titleId="espaces-titre" tone="surface">
        <ProfileTabs />
      </Section>
      <Section title="Accéder à votre espace" titleId="acces-titre">
        <SpaceCards />
      </Section>
      <Section id="fonctions" title="Ce que couvre eGuardImmo" titleId="fonctions-titre" tone="surface">
        <FeatureGrid items={FEATURES} />
      </Section>
      <Section id="faq" title="Questions fréquentes" titleId="faq-titre">
        <FaqAccordion entries={FAQ.slice(0, 3)} headingLevel={3} />
        <div>
          <LinkButton href="/faq" variant="secondary">
            Toutes les questions
          </LinkButton>
        </div>
      </Section>
      <CtaBand />
    </>
  );
}
