export type PlannedScreens = ReadonlyMap<string, string>;

export function resolvePlanned(screens: PlannedScreens, segments: readonly string[]): string | undefined {
  return screens.get(`/${segments.join('/')}`);
}

export function plannedStaticParams(screens: PlannedScreens): { ecran: string[] }[] {
  return Array.from(screens.keys(), (href) => ({ ecran: href.slice(1).split('/') }));
}
