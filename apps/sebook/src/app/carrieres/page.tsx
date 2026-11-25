import type { Metadata } from "next";
import InfoPage from "@/components/roost/InfoPage";
import { CardGrid, Faq, LinkCard, Placeholder, Section, SOFT } from "@/components/roost/InfoParts";
import { buildInfoPageJsonLd, infoMetadata, pageTitle, TODO_MARK } from "@/lib/seo";

const PATH = "/carrieres";
const PAGE_TITLE = pageTitle("Carrières");
const PAGE_DESCRIPTION = "Rejoignez SeBook : informations sur les métiers et les candidatures.";

const AREAS = ["💻", "🎨", "🤝", "📈"].map((icon) => ({ icon, title: TODO_MARK, desc: TODO_MARK, href: "/contact" }));

const FAQ = [
  { question: "Avez-vous des postes ouverts en ce moment ?", answer: "Postes ouverts et candidatures spontanées : [À RENSEIGNER]." },
  { question: "Travaillez-vous à distance ?", answer: "Organisation du travail : [À RENSEIGNER]." },
];

export const metadata: Metadata = infoMetadata(PATH, PAGE_TITLE, PAGE_DESCRIPTION);

export default function CarrieresPage() {
  const jsonLd = buildInfoPageJsonLd({
    path: PATH,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    breadcrumb: [{ name: "Accueil", path: "/" }, { name: "Carrières" }],
    faq: FAQ,
  });

  return (
    <InfoPage
      eyebrow="SeBook"
      title="Construisez la réservation de logements de demain avec nous"
      lead="Nous bâtissons une plateforme de réservation de logements. Si vous aimez les produits utiles, soignés et fiables, parlons-nous."
      breadcrumb={[{ name: "Accueil", href: "/" }, { name: "Carrières" }]}
      jsonLd={jsonLd}
      cta={{ text: "Une candidature spontanée à nous transmettre ?", href: "/contact", label: "Postuler / Nous écrire" }}
    >
      <Section title="Les domaines où nous grandissons" lead="Vous ne trouvez pas l’intitulé exact ? Présentez-vous quand même.">
        <CardGrid>
          {AREAS.map((area) => (
            <LinkCard key={area.icon} {...area} />
          ))}
        </CardGrid>
      </Section>

      <Section title="Pourquoi nous rejoindre">
        <p style={{ margin: 0, color: SOFT, fontSize: 17, lineHeight: 1.65 }}>
          <Placeholder />
        </p>
      </Section>

      <Section title="Questions fréquentes">
        <Faq items={FAQ} />
      </Section>
    </InfoPage>
  );
}
