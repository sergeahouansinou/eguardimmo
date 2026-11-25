import { Hero } from "@/components/Hero";
import { LegalSections } from "@/components/LegalSections";
import { MENTIONS_LEGALES } from "@/content/legal";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({ title: "Mentions légales", description: "Mentions légales du site eGuardImmo.", path: "/mentions-legales" });

export default function MentionsLegalesPage() {
  return (
    <>
      <Hero eyebrow="Informations" title="Mentions légales" lead="Informations sur l’éditeur et l’hébergeur du site." />
      <LegalSections sections={MENTIONS_LEGALES} />
    </>
  );
}
