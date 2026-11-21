import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { ShellNavigation } from "@eguardimmo/shell";

const SRC = join(process.cwd(), "src");
const CONTEXTE = /\b(?:href|to|redirectTo|backHref|allHref|settingsHref|push|replace|redirect|navigate|permanentRedirect|hrefLabel)\s*(?:=|:|\()\s*\{?\s*(["'`])(\/[^"'`]*)\1/g;

function walk(directory: string, keep: (file: string) => boolean, found: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path, keep, found);
    else if (keep(path)) found.push(path);
  }
  return found;
}

export function routePatterns(): RegExp[] {
  const base = join(SRC, "app");
  return walk(base, (file) => file.endsWith(`${sep}page.tsx`)).map((file) => {
    const segments = relative(base, join(file, ".."))
      .split(sep)
      .filter((segment) => segment !== "" && !(segment.startsWith("(") && segment.endsWith(")")));
    const body = segments.map((segment) => (segment.startsWith("[") ? "[^/]+" : segment.replace(/[.*+?^${}()|\\]/g, "\\$&"))).join("/");
    return new RegExp(`^/${body}/?$`);
  });
}

export function pathOf(href: string): string {
  return href.replace(/\$\{[^}]*\}/g, "x").split(/[?#]/)[0] ?? "";
}

export function isInternal(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

export function resolves(href: string, patterns: readonly RegExp[]): boolean {
  const path = pathOf(href);
  return patterns.some((pattern) => pattern.test(path === "" ? "/" : path));
}

export function navigationHrefs(navigation: ShellNavigation): string[] {
  const entries = [...navigation.sections.flatMap((section) => section.entries), ...navigation.footer];
  return entries.flatMap((entry) => [entry.href, ...(entry.children ?? []).map((child) => child.href), ...(entry.activeFor ?? [])]);
}

const LITTERAL = /(["'`])(?:\$\{[^}]*\})?(\/(?:[A-Za-z0-9_\-.]+|\$\{[^}]*\})(?:\/(?:[A-Za-z0-9_\-.:]+|\$\{[^}]*\}))*\/?)(?:[?#][^"'`]*)?\1/g;

const PACKAGES = join(process.cwd(), "..", "..", "packages");

function sourceFiles(withPackages = false): string[] {
  const roots = withPackages ? [SRC, ...["gestion", "messagerie", "shell"].map((name) => join(PACKAGES, name, "src"))] : [SRC];
  return roots.flatMap((root) => walk(root, (file) => /\.tsx?$/.test(file) && !/\.(test|spec)\.|\.d\.ts$|testSupport|testing|testApi|fixtures/.test(file)));
}

export function sourceHrefs(): { file: string; href: string }[] {
  return sourceFiles().flatMap((file) => {
    const text = readFileSync(file, "utf8");
    return Array.from(text.matchAll(CONTEXTE), (match) => ({ file: relative(process.cwd(), file), href: match[2] ?? "" }));
  });
}

export function sourceLiterals(): string[] {
  return sourceFiles(true).flatMap((file) => Array.from(readFileSync(file, "utf8").matchAll(LITTERAL), (match) => match[2] ?? ""));
}
