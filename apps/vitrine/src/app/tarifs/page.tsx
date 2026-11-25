import { CtaBand } from "@/components/CtaBand";
import { Hero } from "@/components/Hero";
import { PricingPlans } from "@/components/PricingPlans";
import { Section } from "@/components/Section";
import { siteEnv } from "@/lib/env";
import { pageMetadata } from "@/lib/metadata";
import { hasConfiguredPrices, parsePriceConfig, planViews } from "@/lib/pricing";

export const metadata = pageMetadata({
  title: "Tarifs",
  description: "Les formules d’abonnement eGuardImmo pour les agences et les propriétaires.",
  path: "/tarifs",
});

export default function TarifsPage() {
  const plans = planViews(parsePriceConfig(siteEnv().NEXT_PUBLIC_PLAN_PRICES));
  const showPeriods = hasConfiguredPrices(plans);
  return (
    <>
      <Hero eyebrow="Tarifs" title="Des formules selon la taille de votre activité" lead="Choisissez la formule qui correspond à votre portefeuille, ou demandez une démonstration pour la comparer sur vos données." />
      <Section title="Formules" titleId="formules-titre" intro={showPeriods ? undefined : "Les montants ne sont pas encore publiés sur ce site."}>
        <PricingPlans plans={plans} showPeriods={showPeriods} />
      </Section>
      <CtaBand />
    </>
  );
}
