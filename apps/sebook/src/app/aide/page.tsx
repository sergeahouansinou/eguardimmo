import type { Metadata } from "next";
import InfoPage from "@/components/roost/InfoPage";
import { CardGrid, Faq, INK, LinkCard, LINE, Section, SOFT } from "@/components/roost/InfoParts";
import { buildInfoPageJsonLd, infoMetadata, pageTitle } from "@/lib/seo";

const PATH = "/aide";
const PAGE_TITLE = pageTitle("Centre d’aide");
const PAGE_DESCRIPTION =
  "Centre d’aide SeBook : réponses sur la recherche de logements, la réservation, le statut « Paiement à finaliser », votre compte et la publication d’annonces.";

const FAQ = [
  {
    question: "Comment réserver un logement sur SeBook ?",
    answer:
      "Ouvrez la fiche d’une annonce de séjour, choisissez vos dates et vos voyageurs, vérifiez le devis puis réservez. Vous devez être connecté et avoir confirmé votre adresse e-mail. La réservation est d’abord enregistrée avec le statut « Paiement à finaliser » : elle n’est confirmée qu’une fois le paiement finalisé.",
  },
  {
    question: "Que signifie « Paiement à finaliser » ?",
    answer:
      "Votre réservation est enregistrée mais elle n’est pas confirmée tant que le paiement n’est pas finalisé. Sans paiement, les dates sont libérées au bout de 30 minutes. Suivez le statut de chaque réservation depuis votre compte.",
  },
  {
    question: "Quelle différence entre un séjour et une location longue durée ?",
    answer:
      "Un séjour est proposé à la nuit : vous choisissez vos dates d’arrivée et de départ. Une location longue durée est proposée au mois. Utilisez le choix « Séjours » ou « Longue durée » de la recherche pour afficher l’un ou l’autre.",
  },
  {
    question: "Comment contacter l’hôte d’un logement ?",
    answer:
      "Lorsque la fiche le propose, vous pouvez envoyer une demande de visite à l’hôte en indiquant un créneau souhaité et un message. Vous devez être connecté pour l’envoyer.",
  },
  {
    question: "Je suis agence ou propriétaire : comment publier mes biens ?",
    answer:
      "Utilisez « Devenir hôte » dans l’en-tête du site : l’inscription des hôtes se fait sur l’espace d’authentification SeBook. Les modalités de gestion de vos annonces : [À RENSEIGNER].",
  },
];

const TOPICS = [
  { icon: "🔎", title: "Recherche & annonces", desc: "Trouver un séjour ou une location longue durée, filtrer par lieu, dates, catégorie et équipements.", href: "/destinations" },
  { icon: "📅", title: "Réservation & annulation", desc: "Comprendre le statut d’une réservation et les trois politiques d’annulation.", href: "/annulation" },
  { icon: "🛡️", title: "Sécurité & confiance", desc: "Réserver en toute sérénité et repérer une annonce douteuse.", href: "/securite" },
  { icon: "🏠", title: "Pour les agences & hôtes", desc: "Ressources et bonnes pratiques pour publier vos annonces.", href: "/ressources" },
];

const STEPS = [
  "Parcourez les annonces par lieu, dates ou catégorie (studio, appartement, maison, colocation).",
  "Sur une annonce, choisissez vos dates et réservez, ou envoyez une demande de visite à l’hôte.",
  "Une réservation est confirmée une fois le paiement finalisé : suivez son statut dans votre compte.",
];

export const metadata: Metadata = infoMetadata(PATH, PAGE_TITLE, PAGE_DESCRIPTION);

export default function AidePage() {
  const jsonLd = buildInfoPageJsonLd({
    path: PATH,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    breadcrumb: [{ name: "Accueil", path: "/" }, { name: "Centre d’aide" }],
    faq: FAQ,
  });

  return (
    <InfoPage
      eyebrow="Assistance"
      title="Comment pouvons-nous vous aider ?"
      lead="Trouvez rapidement une réponse sur la recherche de logements, la réservation, votre compte ou la publication d’annonces."
      breadcrumb={[{ name: "Accueil", href: "/" }, { name: "Centre d’aide" }]}
      jsonLd={jsonLd}
      cta={{ text: "Vous ne trouvez pas votre réponse ?", href: "/contact", label: "Nous contacter" }}
    >
      <Section title="Parcourir par thème" lead="Choisissez le sujet qui correspond à votre question.">
        <CardGrid>
          {TOPICS.map((topic) => (
            <LinkCard key={topic.href} {...topic} />
          ))}
        </CardGrid>
      </Section>

      <Section title="Réserver en 3 étapes">
        <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 14 }}>
          {STEPS.map((step, index) => (
            <li
              key={step}
              style={{ display: "flex", gap: 16, alignItems: "flex-start", padding: "16px 18px", border: `1px solid ${LINE}`, borderRadius: 14, background: "#fff" }}
            >
              <span
                aria-hidden
                style={{
                  flexShrink: 0,
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: INK,
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {index + 1}
              </span>
              <span style={{ color: SOFT, fontSize: 16 }}>{step}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Questions fréquentes">
        <Faq items={FAQ} />
      </Section>
    </InfoPage>
  );
}
