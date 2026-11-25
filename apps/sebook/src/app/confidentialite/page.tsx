import type { Metadata } from "next";
import InfoPage from "@/components/roost/InfoPage";
import { CtaButton, NoteBox, Placeholder, PROSE, Section, SubHeading } from "@/components/roost/InfoParts";
import { buildInfoPageJsonLd, infoMetadata, pageTitle } from "@/lib/seo";

const PATH = "/confidentialite";
const PAGE_TITLE = pageTitle("Politique de confidentialité");
const PAGE_DESCRIPTION = "Comment SeBook traite et protège vos données personnelles : données collectées, finalités, destinataires et vos droits.";

export const metadata: Metadata = infoMetadata(PATH, PAGE_TITLE, PAGE_DESCRIPTION);

export default function ConfidentialitePage() {
  const jsonLd = buildInfoPageJsonLd({
    path: PATH,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    breadcrumb: [{ name: "Accueil", path: "/" }, { name: "Confidentialité" }],
  });

  return (
    <InfoPage
      eyebrow="SeBook"
      title="Politique de confidentialité"
      lead="Nous attachons une grande importance à la protection de vos données. Cette page décrit comment SeBook les collecte, les utilise et les protège."
      breadcrumb={[{ name: "Accueil", href: "/" }, { name: "Confidentialité" }]}
      jsonLd={jsonLd}
      cta={{ text: "Une question sur vos données ?", href: "/contact", label: "Nous contacter" }}
    >
      <NoteBox>
        Les éléments marqués <Placeholder /> doivent être renseignés avant publication (entité juridique, contacts, durées). Dernière mise à jour :{" "}
        <Placeholder />.
      </NoteBox>

      <Section title="Responsable du traitement">
        <p style={PROSE}>
          Le responsable du traitement est <Placeholder />, dont le siège est situé <Placeholder />. Contact pour toute question relative à vos données :{" "}
          <Placeholder />.
        </p>
      </Section>

      <Section title="Données que nous traitons">
        <SubHeading>Données de compte</SubHeading>
        <p style={PROSE}>Nom, adresse e-mail et informations fournies à l’inscription.</p>
        <SubHeading>Données d’utilisation du service</SubHeading>
        <p style={PROSE}>Réservations, demandes de visite (créneau souhaité et message) et annonces mises en favoris.</p>
        <SubHeading>Données de paiement</SubHeading>
        <p style={PROSE}>
          Traitement des données de paiement et prestataire concerné : <Placeholder />.
        </p>
        <SubHeading>Données techniques</SubHeading>
        <p style={PROSE}>
          Données de connexion nécessaires au fonctionnement et à la sécurité de la plateforme. Votre préférence de langue est conservée dans votre
          navigateur.
        </p>
      </Section>

      <Section title="Finalités et bases légales">
        <p style={PROSE}>
          Vos données sont traitées pour fournir le service de réservation et la mise en relation avec les hôtes. Bases légales détaillées :{" "}
          <Placeholder />.
        </p>
      </Section>

      <Section title="Hébergement et partage">
        <p style={PROSE}>
          Les informations de votre réservation ou de votre demande de visite sont destinées à l’hôte concerné. Lieu d’hébergement, prestataires et autres
          destinataires : <Placeholder />.
        </p>
      </Section>

      <Section title="Durée de conservation">
        <p style={PROSE}>
          Durées de conservation : <Placeholder />.
        </p>
      </Section>

      <Section title="Vos droits">
        <p style={PROSE}>
          Vous disposez d’un droit d’accès, de rectification, d’effacement, de limitation, d’opposition et de portabilité de vos données, dans les
          conditions prévues par la réglementation applicable. Modalités d’exercice et autorité de contrôle compétente : <Placeholder />.
        </p>
        <div style={{ marginTop: 8 }}>
          <CtaButton href="/contact" variant="outline">
            Exercer mes droits
          </CtaButton>
        </div>
      </Section>

      <Section title="Cookies">
        <p style={PROSE}>
          La plateforme utilise les cookies nécessaires à la session et à la sécurité. Mesure d’audience et autres traceurs : <Placeholder />.
        </p>
      </Section>

      <Section title="Modifications">
        <p style={PROSE}>
          Cette politique peut évoluer. Toute modification importante sera signalée sur cette page, avec mise à jour de la date indiquée en haut.
        </p>
      </Section>
    </InfoPage>
  );
}
