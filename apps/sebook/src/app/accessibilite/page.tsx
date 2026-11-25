import type { Metadata } from "next";
import InfoPage from "@/components/roost/InfoPage";
import { CardGrid, Faq, LinkCard, PanelBox, Section } from "@/components/roost/InfoParts";
import { buildInfoPageJsonLd, infoMetadata, pageTitle } from "@/lib/seo";

const PATH = "/accessibilite";
const PAGE_TITLE = pageTitle("Accessibilité");
const PAGE_DESCRIPTION = "L’accessibilité chez SeBook : repérer les logements à accès sans marches, une plateforme pensée pour tous et un canal pour signaler un obstacle.";

const CARDS = [
  {
    icon: "♿",
    title: "Logements accessibles",
    desc: "Repérez les annonces indiquant un accès sans marches parmi leurs équipements et précisez vos besoins à l’hôte.",
    href: "/destinations",
  },
  {
    icon: "🧭",
    title: "Une plateforme pour tous",
    desc: "Navigation au clavier, structure claire et libellés explicites : nous visons les bonnes pratiques d’accessibilité.",
    href: "/aide",
  },
  { icon: "✉️", title: "Signaler un obstacle", desc: "Une page, un parcours ou une fonctionnalité difficile à utiliser ? Dites-le-nous.", href: "/contact" },
];

const FAQ = [
  {
    question: "Comment trouver un logement accessible ?",
    answer:
      "Ouvrez une fiche et consultez la section des équipements : certains biens indiquent un « Accès sans marches ». Comme l’aménagement varie d’un bien à l’autre, envoyez une demande à l’hôte lorsque la fiche le propose pour confirmer que le logement répond à vos besoins précis.",
  },
  {
    question: "Le site SeBook est-il conforme aux normes d’accessibilité ?",
    answer:
      "Nous concevons la plateforme en visant les bonnes pratiques d’accessibilité (navigation au clavier, libellés clairs). Niveau de conformité et déclaration d’accessibilité : [À RENSEIGNER]. Si vous rencontrez un obstacle, signalez-le : votre retour nous aide à prioriser les correctifs.",
  },
];

export const metadata: Metadata = infoMetadata(PATH, PAGE_TITLE, PAGE_DESCRIPTION);

export default function AccessibilitePage() {
  const jsonLd = buildInfoPageJsonLd({
    path: PATH,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    breadcrumb: [{ name: "Accueil", path: "/" }, { name: "Accessibilité" }],
    faq: FAQ,
  });

  return (
    <InfoPage
      eyebrow="Assistance"
      title="L’accessibilité pour tous"
      lead="Trouver un logement adapté et utiliser SeBook sans obstacle : c’est un objectif que nous faisons progresser."
      breadcrumb={[{ name: "Accueil", href: "/" }, { name: "Accessibilité" }]}
      jsonLd={jsonLd}
      cta={{ text: "Un obstacle d’accessibilité à nous signaler ?", href: "/contact", label: "Nous écrire" }}
    >
      <Section title="Trois façons d’avancer ensemble">
        <CardGrid>
          {CARDS.map((card) => (
            <LinkCard key={card.title} {...card} />
          ))}
        </CardGrid>
      </Section>

      <Section title="Notre démarche">
        <PanelBox>
          <p style={{ margin: 0 }}>
            Structure sémantique, navigation au clavier et libellés explicites font partie de nos critères de qualité. Vos retours sont le meilleur moyen
            d’identifier ce qui reste à améliorer : n’hésitez pas à nous les transmettre.
          </p>
        </PanelBox>
      </Section>

      <Section title="Questions fréquentes">
        <Faq items={FAQ} />
      </Section>
    </InfoPage>
  );
}
