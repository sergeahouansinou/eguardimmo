import type { Metadata } from "next";
import InfoPage from "@/components/roost/InfoPage";
import { CardGrid, CtaButton, Faq, hostHref, LINE, LinkCard, PanelBox, Section, SOFT } from "@/components/roost/InfoParts";
import { buildInfoPageJsonLd, infoMetadata, pageTitle } from "@/lib/seo";

const PATH = "/securite";
const PAGE_TITLE = pageTitle("Sécurité & confiance");
const PAGE_DESCRIPTION =
  "Comment réserver en confiance sur SeBook : compte avec e-mail confirmé, statut de réservation explicite, politiques d’annulation visibles et conseils pour repérer une annonce douteuse.";

const COMMITMENTS = [
  { icon: "✉️", title: "Compte et e-mail confirmé", desc: "Pour réserver, vous devez être connecté et avoir confirmé votre adresse e-mail.", href: "/compte" },
  {
    icon: "⏱️",
    title: "Statut de réservation explicite",
    desc: "Une réservation en « Paiement à finaliser » n’est jamais présentée comme confirmée. Sans paiement, les dates sont libérées au bout de 30 minutes.",
    href: "/aide",
  },
  { icon: "📋", title: "Politiques d’annulation visibles", desc: "Flexible, Modérée ou Stricte : la politique est affichée sur la fiche, avant de réserver.", href: "/annulation" },
  { icon: "🔒", title: "Vos données", desc: "Le traitement de vos données personnelles est décrit dans la politique de confidentialité.", href: "/confidentialite" },
];

const TIPS = [
  "Conservez le récapitulatif de votre réservation : référence, dates et politique d’annulation sont votre trace en cas de litige.",
  "Ne réglez jamais d’acompte par virement ou par un lien reçu d’un tiers : passez uniquement par le parcours de réservation de SeBook.",
  "Vérifiez les informations de la fiche (prix, surface, nombre de pièces, équipements, politique d’annulation) avant de vous engager.",
  "Au moindre doute sur une annonce ou un comportement, signalez-le depuis la page « Signaler un problème ».",
];

const FAQ = [
  {
    question: "À quel moment ma réservation est-elle confirmée ?",
    answer:
      "Une réservation est d’abord enregistrée avec le statut « Paiement à finaliser ». Elle n’est confirmée qu’une fois le paiement finalisé. Méfiez-vous de toute demande de paiement en dehors du parcours de réservation.",
  },
  {
    question: "Comment repérer une annonce douteuse ?",
    answer:
      "Une fiche complète et cohérente (prix, surface, nombre de pièces, équipements) est un bon indicateur. Un prix anormalement bas, des informations contradictoires ou une demande de paiement hors plateforme doivent vous alerter.",
  },
  {
    question: "Que faire si une annonce me semble frauduleuse ?",
    answer: "Ne poursuivez pas l’échange en dehors de SeBook et signalez l’annonce depuis la page « Signaler un problème ».",
  },
];

export const metadata: Metadata = infoMetadata(PATH, PAGE_TITLE, PAGE_DESCRIPTION);

export default function SecuritePage() {
  const jsonLd = buildInfoPageJsonLd({
    path: PATH,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    breadcrumb: [{ name: "Accueil", path: "/" }, { name: "Sécurité & confiance" }],
    faq: FAQ,
  });
  const host = hostHref();

  return (
    <InfoPage
      eyebrow="Sécurité & confiance"
      title="Réservez et louez en toute confiance"
      lead="SeBook met en relation des hôtes et des voyageurs ou locataires. Voici ce qui encadre une réservation et les réflexes à adopter pour protéger vos échanges."
      breadcrumb={[{ name: "Accueil", href: "/" }, { name: "Sécurité & confiance" }]}
      jsonLd={jsonLd}
      cta={{ text: "Une annonce ou un comportement vous semble suspect ?", href: "/signalement", label: "Signaler un problème" }}
    >
      <Section title="Nos engagements" lead="Des principes simples qui encadrent chaque réservation.">
        <CardGrid>
          {COMMITMENTS.map((commitment) => (
            <LinkCard key={commitment.href} {...commitment} />
          ))}
        </CardGrid>
      </Section>

      <Section title="Réserver en sécurité : nos conseils">
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
          {TIPS.map((tip) => (
            <li
              key={tip}
              style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "16px 18px", border: `1px solid ${LINE}`, borderRadius: 14, background: "#fff" }}
            >
              <span aria-hidden style={{ color: "#85C920", fontSize: 18, lineHeight: 1.4, flexShrink: 0 }}>
                ✓
              </span>
              <span style={{ color: SOFT, fontSize: 16 }}>{tip}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Côté agences & propriétaires" lead="La confiance va dans les deux sens.">
        <PanelBox>
          <p style={{ margin: host ? "0 0 12px" : 0 }}>
            Les agences et propriétaires publient leurs annonces depuis leur espace hôte et traitent les réservations et les demandes de visite qui les
            concernent.
          </p>
          {host && (
            <CtaButton href={host} variant="outline">
              Devenir hôte
            </CtaButton>
          )}
        </PanelBox>
      </Section>

      <Section title="Questions fréquentes">
        <Faq items={FAQ} />
      </Section>
    </InfoPage>
  );
}
