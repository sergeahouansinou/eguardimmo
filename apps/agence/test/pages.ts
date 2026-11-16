import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

export interface PageFile {
  route: string;
  file: string;
}

export const ESPACE_DIR = join(process.cwd(), "src", "app", "(espace)");

export function pageFiles(directory: string = ESPACE_DIR): PageFile[] {
  const pages: PageFile[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(current, entry.name));
      else if (entry.name === "page.tsx") {
        const segments = relative(directory, current)
          .split(sep)
          .filter((segment) => segment !== "" && !(segment.startsWith("(") && segment.endsWith(")")));
        pages.push({ route: `/${segments.map((segment) => (segment.startsWith("[") ? "x" : segment)).join("/")}`, file: join(current, entry.name) });
      }
    }
  };
  walk(directory);
  return pages;
}
