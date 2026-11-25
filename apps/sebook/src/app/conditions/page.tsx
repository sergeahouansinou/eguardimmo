import type { Metadata } from "next";
import InfoPage from "@/components/roost/InfoPage";
import { CtaButton, NoteBox, Placeholder, PROSE, Section } from "@/components/roost/InfoParts";
import { buildInfoPageJsonLd, infoMetadata, pageTitle } from "@/lib/seo";

const PATH = "/conditions";
const PAGE_TITLE = pageTitle("Conditions d’utilisation");
const PAGE_DESCRIPTION =
  "Les conditions d’utilisation de SeBook : rôle de la plateforme, réservation, obligations des utilisateurs et responsabilités.";

export const metadata: Metadata = infoMetadata(PATH, PAGE_TITLE, PAGE_DESCRIPTION);

export default function ConditionsPage() {
  const jsonLd = buildInfoPageJsonLd({
    path: PATH,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    breadcrumb: [{ name: "Accueil", path: "/" }, { name: "Conditions d’utilisation" }],
  });

  return (
    <InfoPage
      eyebrow="SeBook"
      title="Conditions d’utilisation"
      lead="Ces conditions encadrent l’utilisation de la plateforme SeBook par les visiteurs, les voyageurs, les locataires et les hôtes."
      breadcrumb={[{ name: "Accueil", href: "/" }, { name: "Conditions d’utilisation" }]}
      jsonLd={jsonLd}
      cta={{ text: "Une question sur ces conditions ?", href: "/contact", label: "Nous contacter" }}
    >
      <NoteBox>
        Les éléments marqués <Placeholder /> (entité juridique, droit applicable, date) doivent être validés avant publication.
        Dernière mise à jour : <Placeholder />.
      </NoteBox>

      <Section title="1. Objet">
        <p style={PROSE}>
          SeBook est une plateforme de réservation de logements qui met en relation des agences et des propriétaires avec des voyageurs et des
          locataires, pour des séjours et des locations longue durée. Elle est éditée par <Placeholder />. Les présentes conditions définissent les
          règles d’utilisation du service.
        </p>
      </Section>

      <Section title="2. Rôle de SeBook">
        <p style={PROSE}>
          SeBook agit comme <strong>intermédiaire technique de mise en relation</strong>. La plateforme n’est pas partie au contrat de location conclu
          entre l’utilisateur et l’agence ou le propriétaire. Modalités de paiement et rôle de SeBook dans l’encaissement : <Placeholder />.
        </p>
      </Section>

      <Section title="3. Compte utilisateur">
        <p style={PROSE}>
          Réserver ou envoyer une demande de visite nécessite un compte dont l’adresse e-mail est confirmée. Vous êtes responsable de l’exactitude de vos
          informations et de la confidentialité de vos identifiants.
        </p>
      </Section>

      <Section title="4. Réservation et annulation">
        <p style={PROSE}>
          Une réservation est enregistrée avec le statut « Paiement à finaliser » et n’est confirmée qu’une fois le paiement finalisé ; sans paiement, les
          dates sont libérées. Les conditions d’annulation applicables sont celles affichées sur l’annonce (Flexible, Modérée ou Stricte).
        </p>
        <div style={{ marginTop: 4 }}>
          <CtaButton href="/annulation" variant="outline">
            Voir les options d’annulation
          </CtaButton>
        </div>
      </Section>

      <Section title="5. Obligations des utilisateurs">
        <p style={PROSE}>
          Vous vous engagez à utiliser la plateforme de manière loyale : publier ou fournir des informations exactes, ne pas contourner le fonctionnement du
          service et respecter notre politique anti-discrimination. Mesures applicables en cas de manquement : <Placeholder />.
        </p>
      </Section>

      <Section title="6. Propriété intellectuelle">
        <p style={PROSE}>
          La marque, le logo et les contenus de la plateforme sont protégés. Les contenus publiés par les hôtes (annonces) restent sous leur responsabilité.
          Licence d’affichage accordée à SeBook : <Placeholder />.
        </p>
      </Section>

      <Section title="7. Responsabilité">
        <p style={PROSE}>
          SeBook ne garantit pas l’exactitude des annonces publiées par les tiers ni la disponibilité ininterrompue du service. Limites de responsabilité :{" "}
          <Placeholder />.
        </p>
      </Section>

      <Section title="8. Données personnelles">
        <p style={PROSE}>Le traitement de vos données est décrit dans notre politique de confidentialité.</p>
        <div style={{ marginTop: 4 }}>
          <CtaButton href="/confidentialite" variant="outline">
            Politique de confidentialité
          </CtaButton>
        </div>
      </Section>

      <Section title="9. Droit applicable">
        <p style={PROSE}>
          Les présentes conditions sont régies par le droit <Placeholder />. Tout litige relève des juridictions de <Placeholder />, sous réserve des
          dispositions impératives protégeant le consommateur.
        </p>
      </Section>
    </InfoPage>
  );
}
