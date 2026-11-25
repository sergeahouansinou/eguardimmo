import { describe, expect, it } from "vitest";
import { sitemapXml } from "./sitemapXml";

describe("sitemapXml", () => {
  it("échappe les caractères XML des URL", () => {
    const xml = sitemapXml([{ url: "https://sebook.test/a?x=1&y=<2>", changeFrequency: "daily", priority: 1 }]);
    expect(xml).toContain("<loc>https://sebook.test/a?x=1&amp;y=&lt;2&gt;</loc>");
    expect(xml).toContain("<priority>1.0</priority>");
    expect(xml.startsWith('<?xml version="1.0"')).toBe(true);
  });
});
