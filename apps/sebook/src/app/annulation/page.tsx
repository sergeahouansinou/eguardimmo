import type { Metadata } from "next";
import InfoPage from "@/components/roost/InfoPage";
import { Faq, INK, LINE, MUTED, Section, StepList } from "@/components/roost/InfoParts";
import { POLICY_LABELS } from "@/marketplace/labels";
import { buildInfoPageJsonLd, infoMetadata, pageTitle } from "@/lib/seo";

const PATH = "/annulation";
const PAGE_TITLE = pageTitle("Options d’annulation");
const PAGE_DESCRIPTION =
  "Comment fonctionnent les annulations sur SeBook : politiques Flexible, Modérée ou Stricte affichées sur chaque annonce et marche à suivre pour annuler une réservation.";

const POLICIES = [
  { ...POLICY_LABELS.flexible, color: "#85C920" },
  { ...POLICY_LABELS.moderate, color: "#E0A23B" },
  { ...POLICY_LABELS.strict, color: "#C9603B" },
];

const FAQ = [
  {
    question: "Que se passe-t-il si j’annule une réservation ?",
    answer:
      "Le remboursement dépend de la politique d’annulation de l’annonce et du nombre de jours restant avant l’arrivée : intégral pour les politiques Flexible et Modérée dans leur délai, de 50 % pour la politique Stricte dans son délai. Passé ce délai, aucun remboursement n’est prévu.",
  },
  {
    question: "Où voir la politique d’annulation d’un logement ?",
    answer:
      "Chaque fiche d’annonce indique sa politique d’annulation. Consultez-la avant de réserver : c’est elle qui s’applique à votre séjour.",
  },
  {
    question: "Comment annuler concrètement ?",
    answer: "Ouvrez votre compte, retrouvez la réservation concernée dans la liste de vos réservations et annulez-la depuis cette liste.",
  },
];

export const metadata: Metadata = infoMetadata(PATH, PAGE_TITLE, PAGE_DESCRIPTION);

export default function AnnulationPage() {
  const jsonLd = buildInfoPageJsonLd({
    path: PATH,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    breadcrumb: [{ name: "Accueil", path: "/" }, { name: "Options d’annulation" }],
    faq: FAQ,
  });

  return (
    <InfoPage
      eyebrow="Assistance"
      title="Options d’annulation"
      lead="Chaque annonce applique l’une des trois politiques d’annulation ci-dessous. Elle est toujours visible sur la fiche, avant de réserver."
      breadcrumb={[{ name: "Accueil", href: "/" }, { name: "Options d’annulation" }]}
      jsonLd={jsonLd}
      cta={{ text: "Une question sur une annulation en cours ?", href: "/contact", label: "Contacter notre équipe" }}
    >
      <Section title="Les trois politiques" lead="L’hôte choisit la politique appliquée à chaque annonce.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(240px, 100%), 1fr))", gap: 16 }}>
          {POLICIES.map((policy) => (
            <div
              key={policy.name}
              style={{ padding: "20px 20px 22px", borderRadius: 16, border: `1px solid ${LINE}`, background: "#fff", borderTop: `3px solid ${policy.color}` }}
            >
              <span style={{ fontSize: 17, fontWeight: 700, color: INK }}>{policy.name}</span>
              <p style={{ margin: "8px 0 0", color: MUTED, fontSize: 14.5, lineHeight: 1.55 }}>{policy.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Comment annuler">
        <StepList
          steps={[
            "Connectez-vous et ouvrez votre compte.",
            "Retrouvez la réservation dans la liste de vos réservations.",
            "Annulez-la : le remboursement éventuel suit la politique de l’annonce.",
          ]}
        />
      </Section>

      <Section title="Questions fréquentes">
        <Faq items={FAQ} />
      </Section>
    </InfoPage>
  );
}
