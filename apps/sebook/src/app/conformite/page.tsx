import type { Metadata } from "next";
import InfoPage from "@/components/roost/InfoPage";
import { CtaButton, Faq, INK, LINE, PanelBox, Section, SOFT } from "@/components/roost/InfoParts";
import { buildInfoPageJsonLd, infoMetadata, pageTitle } from "@/lib/seo";

const PATH = "/conformite";
const PAGE_TITLE = pageTitle("Conformité & gestion responsable");
const PAGE_DESCRIPTION = "Gérer ses biens de façon responsable sur SeBook : obligations locales, transparence des annonces, protection des données et échanges loyaux.";

const PRINCIPLES = [
  { title: "Annonces exactes", desc: "Publiez des informations véridiques : surface, équipements, prix et disponibilités réels. Pas de promesse trompeuse." },
  {
    title: "Obligations locales",
    desc: "Respectez les règles applicables à la location dans votre pays (autorisations, diagnostics, fiscalité).",
  },
  { title: "Protection des données", desc: "Ne collectez que ce qui est nécessaire et traitez les données conformément à la réglementation applicable." },
  { title: "Échanges loyaux", desc: "Traitez les demandes de réservation et de visite équitablement, dans le respect de notre politique anti-discrimination." },
];

const FAQ = [
  {
    question: "SeBook se substitue-t-il à mes obligations légales ?",
    answer:
      "Non. SeBook fournit un service de réservation, mais vous restez responsable du respect des obligations applicables à votre activité (diagnostics, autorisations, fiscalité, droit du bail) dans votre pays.",
  },
  {
    question: "Comment les données des voyageurs et locataires sont-elles protégées ?",
    answer:
      "Le traitement des données par SeBook est décrit dans la politique de confidentialité. Vous devez vous-même limiter la collecte au strict nécessaire et informer les personnes concernées de l’usage de leurs données. Mesures techniques de protection : [À RENSEIGNER].",
  },
];

export const metadata: Metadata = infoMetadata(PATH, PAGE_TITLE, PAGE_DESCRIPTION);

export default function ConformitePage() {
  const jsonLd = buildInfoPageJsonLd({
    path: PATH,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    breadcrumb: [{ name: "Accueil", path: "/" }, { name: "Conformité & gestion responsable" }],
    faq: FAQ,
  });

  return (
    <InfoPage
      eyebrow="Hôtes & agences"
      title="Conformité & gestion responsable"
      lead="Bien gérer, c’est aussi gérer dans les règles. Voici nos principes pour des annonces honnêtes, des données protégées et des échanges loyaux."
      breadcrumb={[{ name: "Accueil", href: "/" }, { name: "Conformité & gestion responsable" }]}
      jsonLd={jsonLd}
      cta={{ text: "Une question sur vos obligations ?", href: "/contact", label: "Nous contacter" }}
    >
      <Section title="Nos quatre principes">
        <div style={{ display: "grid", gap: 12 }}>
          {PRINCIPLES.map((principle) => (
            <div key={principle.title} style={{ padding: "18px 20px", border: `1px solid ${LINE}`, borderLeft: `3px solid ${INK}`, borderRadius: 12, background: "#fff" }}>
              <span style={{ fontSize: 16.5, fontWeight: 700, color: INK }}>{principle.title}</span>
              <p style={{ margin: "6px 0 0", color: SOFT, fontSize: 15.5, lineHeight: 1.55 }}>{principle.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Le mot de la fin">
        <PanelBox>
          <p style={{ margin: "0 0 14px" }}>
            SeBook vous outille, mais la conformité reste votre responsabilité. En cas de doute, rapprochez-vous d’un professionnel du droit ou de la
            fiscalité de votre pays.
          </p>
          <CtaButton href="/anti-discrimination" variant="outline">
            Voir notre politique anti-discrimination
          </CtaButton>
        </PanelBox>
      </Section>

      <Section title="Questions fréquentes">
        <Faq items={FAQ} />
      </Section>
    </InfoPage>
  );
}
