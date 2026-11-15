import axe from "axe-core";

export async function expectNoA11yViolations(container: Element): Promise<void> {
  const results = await axe.run(container, {
    rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
  });
  if (results.violations.length === 0) return;
  const detail = results.violations
    .map((violation) => `${violation.id} (${violation.impact ?? "n/a"}) : ${violation.help}\n${violation.nodes.map((node) => node.html).join("\n")}`)
    .join("\n\n");
  throw new Error(`Violations d'accessibilité :\n${detail}`);
}
