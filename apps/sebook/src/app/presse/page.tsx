import type { Metadata } from "next";
import InfoPage from "@/components/roost/InfoPage";
import { CtaButton, INK, LINE, PanelBox, PANEL, Placeholder, rich, Section, SOFT } from "@/components/roost/InfoParts";
import { buildInfoPageJsonLd, infoMetadata, pageTitle, SITE_NAME, SITE_TAGLINE, TODO_MARK } from "@/lib/seo";

const PATH = "/presse";
const PAGE_TITLE = pageTitle("Presse");
const PAGE_DESCRIPTION = "Espace presse de SeBook : présentation de la plateforme de réservation de logements et contact pour les demandes média.";

const FACTS = [
  ["Nom", SITE_NAME],
  ["Catégorie", "Réservation de logements : séjours et locations longue durée"],
  ["Marché", TODO_MARK],
  ["Société", TODO_MARK],
  ["Contact presse", TODO_MARK],
];

export const metadata: Metadata = infoMetadata(PATH, PAGE_TITLE, PAGE_DESCRIPTION);

export default function PressePage() {
  const jsonLd = buildInfoPageJsonLd({
    path: PATH,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    breadcrumb: [{ name: "Accueil", path: "/" }, { name: "Presse" }],
  });

  return (
    <InfoPage
      eyebrow="SeBook"
      title="Espace presse"
      lead="Vous écrivez sur le logement et la location ? Voici l’essentiel sur SeBook et comment nous joindre pour vos demandes média."
      breadcrumb={[{ name: "Accueil", href: "/" }, { name: "Presse" }]}
      jsonLd={jsonLd}
      cta={{ text: "Une demande presse ou une interview ?", href: "/contact", label: "Contacter l’équipe" }}
    >
      <Section title="En bref">
        <p style={{ margin: 0, color: SOFT, fontSize: 17, lineHeight: 1.65 }}>
          {SITE_NAME} est une plateforme de réservation de logements. {SITE_TAGLINE}
        </p>
      </Section>

      <Section title="Fiche d’identité">
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 16, overflow: "hidden" }}>
          {FACTS.map(([label, value], index) => (
            <div key={label} style={{ display: "flex", gap: 16, padding: "14px 18px", background: index % 2 ? PANEL : "#fff", fontSize: 15.5 }}>
              <span style={{ flex: "0 0 120px", fontWeight: 700, color: INK }}>{label}</span>
              <span style={{ color: SOFT }}>{rich(value ?? "")}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Ressources de marque">
        <PanelBox>
          <p style={{ margin: "0 0 14px" }}>
            Logo, visuels et éléments de langage : <Placeholder />. Pour toute demande, précisez votre média et votre échéance.
          </p>
          <CtaButton href="/contact" variant="outline">
            Demander le kit presse
          </CtaButton>
        </PanelBox>
      </Section>
    </InfoPage>
  );
}
