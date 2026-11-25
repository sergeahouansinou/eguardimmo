import type { Metadata } from "next";
import InfoPage from "@/components/roost/InfoPage";
import { CardGrid, Faq, INK, LINE, LinkCard, Section, SOFT, StepList } from "@/components/roost/InfoParts";
import { buildInfoPageJsonLd, infoMetadata, pageTitle } from "@/lib/seo";

const PATH = "/signalement";
const PAGE_TITLE = pageTitle("Signaler un problème");
const PAGE_DESCRIPTION = "Signalez une annonce suspecte, un contenu inapproprié, un problème de sécurité ou un bug sur SeBook.";

const KINDS = [
  { icon: "🚩", title: "Annonce suspecte ou frauduleuse", desc: "Prix anormal, demande de paiement hors plateforme, informations incohérentes : signalez-la.", href: "/contact" },
  { icon: "🚫", title: "Contenu inapproprié", desc: "Contenu discriminatoire, offensant ou trompeur dans une annonce.", href: "/contact" },
  { icon: "🛡️", title: "Problème de sécurité", desc: "Comportement à risque, usurpation d’identité ou faille de sécurité.", href: "/securite" },
  { icon: "🐞", title: "Bug ou erreur technique", desc: "Une page qui plante, un bouton qui ne répond pas : décrivez le problème pour qu’on le corrige.", href: "/contact" },
];

const FAQ = [
  {
    question: "Comment signaler une annonce ?",
    answer:
      "Écrivez-nous depuis la page « Nous contacter » en indiquant la référence de l’annonce et la nature du problème. Plus votre description est précise, plus vite nous pouvons agir. Canal de signalement dédié : [À RENSEIGNER].",
  },
  {
    question: "Que se passe-t-il après mon signalement ?",
    answer: "Traitement des signalements, délais et mesures possibles : [À RENSEIGNER].",
  },
  {
    question: "Dois-je signaler même en cas de simple doute ?",
    answer: "Oui. Mieux vaut signaler un doute qui s’avère sans suite que laisser passer un vrai problème.",
  },
];

export const metadata: Metadata = infoMetadata(PATH, PAGE_TITLE, PAGE_DESCRIPTION);

export default function SignalementPage() {
  const jsonLd = buildInfoPageJsonLd({
    path: PATH,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    breadcrumb: [{ name: "Accueil", path: "/" }, { name: "Signaler un problème" }],
    faq: FAQ,
  });

  return (
    <InfoPage
      eyebrow="Assistance"
      title="Signaler un problème"
      lead="Vous avez repéré une annonce suspecte, un contenu inapproprié ou un dysfonctionnement ? Dites-le-nous."
      breadcrumb={[{ name: "Accueil", href: "/" }, { name: "Signaler un problème" }]}
      jsonLd={jsonLd}
      cta={{ text: "Prêt à nous transmettre votre signalement ?", href: "/contact", label: "Nous contacter" }}
    >
      <Section title="Que pouvez-vous signaler ?">
        <CardGrid>
          {KINDS.map((kind) => (
            <LinkCard key={kind.title} {...kind} />
          ))}
        </CardGrid>
      </Section>

      <Section title="Comment ça se passe">
        <StepList
          steps={[
            "Décrivez le problème avec un maximum de détails (référence de l’annonce, captures d’écran).",
            "Envoyez votre signalement via la page « Nous contacter ».",
            "Traitement de votre signalement et suites données : [À RENSEIGNER].",
          ]}
        />
        <div
          style={{
            marginTop: 18,
            padding: "16px 18px",
            border: `1px solid ${LINE}`,
            borderLeft: `3px solid ${INK}`,
            borderRadius: 10,
            background: "#fff",
            color: SOFT,
            fontSize: 15,
          }}
        >
          En cas de danger immédiat pour des personnes, contactez d’abord les services d’urgence locaux : SeBook n’est pas un service d’urgence.
        </div>
      </Section>

      <Section title="Questions fréquentes">
        <Faq items={FAQ} />
      </Section>
    </InfoPage>
  );
}
