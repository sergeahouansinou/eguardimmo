import axe from "axe-core";

export async function expectNoA11yViolations(container: Element): Promise<void> {
  const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
  if (results.violations.length === 0) return;
  const detail = results.violations
    .map((v) => `${v.id} (${v.impact ?? "n/a"}) : ${v.help}\n${v.nodes.map((n) => n.html).join("\n")}`)
    .join("\n\n");
  throw new Error(`Violations d'accessibilité :\n${detail}`);
}
