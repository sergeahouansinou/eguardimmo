import type { Metadata } from "next";
import InfoPage from "@/components/roost/InfoPage";
import { CardGrid, Faq, hostHref, LinkCard, Section } from "@/components/roost/InfoParts";
import { buildInfoPageJsonLd, infoMetadata, pageTitle } from "@/lib/seo";

const PATH = "/ressources";
const PAGE_TITLE = pageTitle("Ressources pour agences");
const PAGE_DESCRIPTION = "Le guide des agences et propriétaires sur SeBook : soigner ses annonces, comprendre les réservations et les politiques d’annulation, gérer en conformité.";

const GUIDES = [
  {
    icon: "🖼️",
    title: "Réussir vos annonces",
    desc: "Titre clair, description précise, surface, nombre de pièces et équipements bien renseignés : les fiches complètes inspirent confiance.",
    href: "/aide",
  },
  { icon: "📅", title: "Comprendre la réservation", desc: "Statut des réservations et politiques d’annulation, côté hôte.", href: "/annulation" },
  { icon: "🛡️", title: "Sécuriser vos échanges", desc: "Bonnes pratiques pour des échanges fiables avec vos voyageurs et locataires.", href: "/securite" },
  { icon: "⚖️", title: "Gérer en conformité", desc: "Vos obligations et la protection des données, en un coup d’œil.", href: "/conformite" },
];

const FAQ = [
  {
    question: "Comment rendre mes annonces plus attractives ?",
    answer:
      "Rédigez un titre explicite, une description précise, renseignez la surface, le nombre de pièces et les équipements, et indiquez un prix réaliste. Une fiche complète inspire confiance.",
  },
  {
    question: "Comment publier et gérer mes annonces ?",
    answer:
      "Utilisez « Devenir hôte » dans l’en-tête du site pour créer votre espace sur l’espace d’authentification SeBook. Fonctionnalités de gestion disponibles et guides détaillés : [À RENSEIGNER].",
  },
];

export const metadata: Metadata = infoMetadata(PATH, PAGE_TITLE, PAGE_DESCRIPTION);

export default function RessourcesPage() {
  const jsonLd = buildInfoPageJsonLd({
    path: PATH,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    breadcrumb: [{ name: "Accueil", path: "/" }, { name: "Ressources pour agences" }],
    faq: FAQ,
  });
  const host = hostHref();

  return (
    <InfoPage
      eyebrow="Hôtes & agences"
      title="Ressources pour agences & propriétaires"
      lead="Tout ce qu’il faut pour tirer le meilleur de SeBook : soigner vos annonces et travailler en confiance avec vos voyageurs et locataires."
      breadcrumb={[{ name: "Accueil", href: "/" }, { name: "Ressources pour agences" }]}
      jsonLd={jsonLd}
      cta={host ? { text: "Prêt à publier vos biens ?", href: host, label: "Devenir hôte" } : undefined}
    >
      <Section title="Guides essentiels">
        <CardGrid>
          {GUIDES.map((guide) => (
            <LinkCard key={guide.href} {...guide} />
          ))}
        </CardGrid>
      </Section>

      <Section title="Questions fréquentes">
        <Faq items={FAQ} />
      </Section>
    </InfoPage>
  );
}
