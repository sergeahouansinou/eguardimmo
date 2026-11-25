import type { Metadata } from "next";
import InfoPage from "@/components/roost/InfoPage";
import { CardGrid, INK, LINE, LinkCard, Placeholder, Section, SOFT } from "@/components/roost/InfoParts";
import { buildInfoPageJsonLd, infoMetadata, pageTitle } from "@/lib/seo";

const PATH = "/contact";
const PAGE_TITLE = pageTitle("Nous contacter");
const PAGE_DESCRIPTION = "Joindre SeBook : contacter l’hôte d’une annonce, signaler un problème, consulter le centre d’aide ou suivre vos réservations.";

const CHANNELS = [
  { icon: "🏠", title: "Une question sur une annonce", desc: "Depuis la fiche du bien, envoyez une demande à l’hôte lorsque la fiche le propose.", href: "/destinations" },
  { icon: "🚩", title: "Signaler un problème", desc: "Annonce suspecte, contenu inapproprié, bug : transmettez-nous les détails.", href: "/signalement" },
  { icon: "💬", title: "Besoin d’aide", desc: "La plupart des réponses se trouvent dans notre centre d’aide.", href: "/aide" },
  { icon: "🔑", title: "Mes réservations", desc: "Suivez le statut de vos réservations et annulez-les depuis votre compte.", href: "/compte" },
];

const DETAILS = ["E-mail", "Téléphone", "Adresse", "Horaires"];

export const metadata: Metadata = infoMetadata(PATH, PAGE_TITLE, PAGE_DESCRIPTION);

export default function ContactPage() {
  const jsonLd = buildInfoPageJsonLd({
    path: PATH,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    breadcrumb: [{ name: "Accueil", path: "/" }, { name: "Nous contacter" }],
  });

  return (
    <InfoPage
      eyebrow="SeBook"
      title="Comment pouvons-nous vous aider ?"
      lead="Choisissez la porte d’entrée qui correspond à votre demande : c’est le moyen le plus rapide d’obtenir une réponse."
      breadcrumb={[{ name: "Accueil", href: "/" }, { name: "Nous contacter" }]}
      jsonLd={jsonLd}
    >
      <Section title="Choisir le bon canal">
        <CardGrid>
          {CHANNELS.map((channel) => (
            <LinkCard key={channel.href} {...channel} />
          ))}
        </CardGrid>
      </Section>

      <Section title="Nous écrire">
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 16, overflow: "hidden" }}>
          {DETAILS.map((label, index) => (
            <div key={label} style={{ display: "flex", gap: 16, padding: "14px 18px", background: index % 2 ? "#F7F5F2" : "#fff", fontSize: 15.5 }}>
              <span style={{ flex: "0 0 120px", fontWeight: 700, color: INK }}>{label}</span>
              <span style={{ color: SOFT }}>
                <Placeholder />
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Bon à savoir">
        <div
          style={{
            padding: "18px 20px",
            border: `1px solid ${LINE}`,
            borderLeft: `3px solid ${INK}`,
            borderRadius: 12,
            background: "#fff",
            color: SOFT,
            fontSize: 15.5,
            lineHeight: 1.6,
          }}
        >
          Pour échanger avec un hôte à propos d’un bien précis, passez par la fiche de l’annonce. Par prudence, méfiez-vous de toute demande de paiement en
          dehors du parcours de réservation de SeBook.
        </div>
      </Section>
    </InfoPage>
  );
}
