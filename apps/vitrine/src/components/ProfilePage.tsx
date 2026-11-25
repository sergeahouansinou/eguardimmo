import { profileByKey } from "@/content/profiles";
import type { ProfileKey } from "@/content/profiles";
import { CtaBand } from "./CtaBand";
import { FeatureGrid } from "./FeatureGrid";
import { Hero } from "./Hero";
import { LinkButton } from "./LinkButton";
import { Section } from "./Section";
import { SpaceCards } from "./SpaceCards";

export function ProfilePage({ profileKey }: { profileKey: ProfileKey }) {
  const profile = profileByKey(profileKey);
  return (
    <>
      <Hero
        eyebrow={`Espace ${profile.label.toLowerCase()}`}
        title={profile.title}
        lead={profile.text}
        actions={
          <>
            <LinkButton href="/contact" variant="secondary">
              Demander une démonstration
            </LinkButton>
            <LinkButton href="/tarifs">Voir les tarifs</LinkButton>
          </>
        }
      />
      <Section title="Ce que vous pouvez faire" titleId="profil-fonctions">
        <ul className="flex list-disc flex-col gap-1 pl-5 text-prose text-fg">
          {profile.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <FeatureGrid items={profile.details} />
      </Section>
      <Section title="Accéder à votre espace" titleId="profil-acces" tone="surface" intro="Un seul compte donne accès aux espaces qui vous concernent.">
        <SpaceCards only={profileKey} />
      </Section>
      <CtaBand />
    </>
  );
}
