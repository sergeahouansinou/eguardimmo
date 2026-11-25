import { CtaBand } from "@/components/CtaBand";
import { FaqAccordion } from "@/components/FaqAccordion";
import { Hero } from "@/components/Hero";
import { Section } from "@/components/Section";
import { FAQ } from "@/content/faq";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Questions fréquentes",
  description: "Séparation des données, fonds des propriétaires, données personnelles, import du portefeuille : les réponses de l’équipe eGuardImmo.",
  path: "/faq",
});

export default function FaqPage() {
  return (
    <>
      <Hero eyebrow="FAQ" title="Questions fréquentes" lead="Les réponses aux questions que se posent les agences, les propriétaires et les locataires avant de choisir eGuardImmo." />
      <Section title="Vos questions" titleId="faq-liste">
        <FaqAccordion entries={FAQ} headingLevel={3} />
      </Section>
      <CtaBand />
    </>
  );
}
