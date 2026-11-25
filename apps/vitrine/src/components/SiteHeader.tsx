import { loginUrl, spaceLinks } from "@/lib/links";
import { SiteNav } from "./SiteNav";
import type { NavItem } from "./SiteNav";

export function SiteHeader() {
  const sebook = spaceLinks().find((space) => space.key === "sebook");
  const items: NavItem[] = [
    { href: "/agences", label: "Agences" },
    { href: "/proprietaires", label: "Propriétaires" },
    { href: "/locataires", label: "Locataires" },
    { href: "/tarifs", label: "Tarifs" },
    ...(sebook ? [{ href: sebook.href, label: "SeBook", external: true }] : []),
    { href: "/faq", label: "FAQ" },
  ];
  return <SiteNav items={items} loginHref={loginUrl()} />;
}
