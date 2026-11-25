import type { Metadata } from "next";
import InfoPage from "@/components/roost/InfoPage";
import { CtaButton, Faq, LINE, PanelBox, Section, SOFT } from "@/components/roost/InfoParts";
import { buildInfoPageJsonLd, infoMetadata, pageTitle } from "@/lib/seo";

const PATH = "/anti-discrimination";
const PAGE_TITLE = pageTitle("Politique anti-discrimination");
const PAGE_DESCRIPTION = "L’engagement de SeBook contre la discrimination : un accès au logement équitable pour tous.";

const PROHIBITED = [
  "L’origine, la nationalité ou l’appartenance ethnique",
  "Le sexe, l’identité de genre ou l’orientation sexuelle",
  "La religion ou les convictions",
  "Le handicap ou l’état de santé",
  "La situation familiale, l’âge ou toute autre caractéristique protégée par la loi",
];

const FAQ = [
  {
    question: "Que faire si je pense avoir été victime de discrimination ?",
    answer:
      "Signalez-le depuis la page « Signaler un problème » en décrivant la situation et, si possible, en joignant des captures d’écran. Suites données et mesures possibles : [À RENSEIGNER].",
  },
  {
    question: "Cette politique s’applique-t-elle aux agences ?",
    answer:
      "Oui. Les agences et propriétaires qui publient sur SeBook sont attendus sur un traitement équitable de toutes les demandes et sur le respect des lois anti-discrimination applicables.",
  },
];

export const metadata: Metadata = infoMetadata(PATH, PAGE_TITLE, PAGE_DESCRIPTION);

export default function AntiDiscriminationPage() {
  const jsonLd = buildInfoPageJsonLd({
    path: PATH,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    breadcrumb: [{ name: "Accueil", path: "/" }, { name: "Anti-discrimination" }],
    faq: FAQ,
  });

  return (
    <InfoPage
      eyebrow="Assistance"
      title="Notre engagement contre la discrimination"
      lead="SeBook œuvre pour un accès au logement équitable. Hôtes, voyageurs et locataires sont attendus sur un principe simple : le respect de chacun."
      breadcrumb={[{ name: "Accueil", href: "/" }, { name: "Anti-discrimination" }]}
      jsonLd={jsonLd}
      cta={{ text: "Vous avez constaté un comportement discriminatoire ?", href: "/signalement", label: "Signaler un problème" }}
    >
      <Section title="Ce que nous n’autorisons pas" lead="Aucune décision de location ou de réservation ne doit être fondée sur :">
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
          {PROHIBITED.map((item) => (
            <li
              key={item}
              style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 18px", border: `1px solid ${LINE}`, borderRadius: 12, background: "#fff", color: SOFT, fontSize: 16 }}
            >
              <span aria-hidden style={{ color: "#C9603B", fontWeight: 800, flexShrink: 0 }}>
                ✕
              </span>
              {item}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Ce que nous attendons de chacun">
        <PanelBox>
          <p style={{ margin: "0 0 12px" }}>
            Les hôtes traitent toutes les demandes de réservation et de visite de façon équitable. Les voyageurs et locataires interagissent avec respect.
          </p>
          <p style={{ margin: 0 }}>Cet engagement s’inscrit dans le respect des cadres légaux applicables.</p>
        </PanelBox>
      </Section>

      <Section title="Questions fréquentes">
        <Faq items={FAQ} />
        <div style={{ marginTop: 22 }}>
          <CtaButton href="/securite" variant="outline">
            En savoir plus : Sécurité & confiance
          </CtaButton>
        </div>
      </Section>
    </InfoPage>
  );
}
