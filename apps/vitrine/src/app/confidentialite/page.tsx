import { Hero } from "@/components/Hero";
import { LegalSections } from "@/components/LegalSections";
import { CONFIDENTIALITE } from "@/content/legal";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({ title: "Confidentialité", description: "Politique de confidentialité du site eGuardImmo.", path: "/confidentialite" });

export default function ConfidentialitePage() {
  return (
    <>
      <Hero eyebrow="Informations" title="Politique de confidentialité" lead="Comment les données saisies sur ce site sont traitées." />
      <LegalSections sections={CONFIDENTIALITE} />
    </>
  );
}
