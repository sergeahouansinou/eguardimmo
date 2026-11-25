"use client";

import { Tab, TabList, TabPanel, Tabs } from "@eguardimmo/ui";
import { PROFILES } from "@/content/profiles";
import type { ProfileKey } from "@/content/profiles";
import { LinkButton } from "./LinkButton";

const TONES: Record<ProfileKey, string> = {
  agence: "bg-info-line",
  proprietaire: "bg-accent",
  locataire: "bg-action",
};

export function ProfileTabs() {
  return (
    <Tabs defaultValue="agence">
      <TabList aria-label="Profils">
        {PROFILES.map((profile) => (
          <Tab key={profile.key} value={profile.key} className="min-h-11">
            {profile.label}
          </Tab>
        ))}
      </TabList>
      {PROFILES.map((profile) => (
        <TabPanel key={profile.key} value={profile.key} keepMounted>
          <div className="flex flex-wrap items-center gap-6 rounded-lg border border-line bg-surface p-6">
            <div className="flex min-w-0 flex-[1_1_20rem] flex-col gap-3">
              <h3 className="text-empty-title text-fg">{profile.title}</h3>
              <p className="max-w-[56ch] text-prose text-fg-muted">{profile.text}</p>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-prose text-fg">
                {profile.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <div className="pt-2">
                <LinkButton href={profile.path} variant="secondary">
                  En savoir plus <span className="sr-only">sur l’espace {profile.label.toLowerCase()}</span>
                </LinkButton>
              </div>
            </div>
            <div aria-hidden="true" className={`aspect-[4/3] w-full flex-[0_1_20rem] rounded-md ${TONES[profile.key]}`} />
          </div>
        </TabPanel>
      ))}
    </Tabs>
  );
}
