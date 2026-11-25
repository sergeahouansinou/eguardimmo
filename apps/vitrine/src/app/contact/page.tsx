import { ContactForm } from "@/components/ContactForm";
import { Container } from "@/components/Container";
import { Hero } from "@/components/Hero";
import { siteEnv } from "@/lib/env";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Demander une démonstration",
  description: "Demandez une démonstration d’eGuardImmo : indiquez votre organisation et votre profil, nous vous répondons.",
  path: "/contact",
});

export default function ContactPage() {
  const contactEmail = siteEnv().NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <>
      <Hero eyebrow="Contact" title="Demander une démonstration" lead="Voyez eGuardImmo avec un portefeuille d’exemple. Indiquez qui vous êtes, nous revenons vers vous." />
      <section aria-labelledby="contact-titre" className="bg-page py-12 md:py-16">
        <Container className="flex max-w-2xl flex-col gap-6">
          <h2 id="contact-titre" className="text-display text-fg">
            Votre demande
          </h2>
          <ContactForm contactEmail={contactEmail} />
        </Container>
      </section>
    </>
  );
}
