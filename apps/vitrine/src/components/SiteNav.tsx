"use client";

import { cx, Icon } from "@eguardimmo/ui";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LinkButton } from "./LinkButton";

export interface NavItem {
  href: string;
  label: string;
  external?: boolean;
}

interface SiteNavProps {
  items: readonly NavItem[];
  loginHref: string;
}

const MENU_ID = "menu-principal";
const LINK_CLASS =
  "inline-flex min-h-11 items-center rounded-sm px-2 text-body-strong text-fg hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export function SiteNav({ items, loginHref }: SiteNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("keydown", closeOnEscape); };
  }, [open]);

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 px-4">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-sm py-2 text-value font-bold text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
          <span aria-hidden="true" className="size-3 rounded-full bg-accent" />
          eGuardImmo
        </Link>
        <button
          ref={toggleRef}
          type="button"
          aria-expanded={open}
          aria-controls={MENU_ID}
          onClick={() => { setOpen((value) => !value); }}
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md border border-line-control px-3 text-body-strong text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus lg:hidden"
        >
          <Icon icon={open ? X : Menu} size={20} />
          Menu
        </button>
        <nav
          id={MENU_ID}
          aria-label="Navigation principale"
          className={cx(open ? "flex" : "hidden", "w-full flex-col gap-3 pb-4 lg:flex lg:w-auto lg:flex-1 lg:flex-row lg:items-center lg:justify-between lg:pb-0")}
        >
          <ul className="flex flex-col lg:flex-row lg:gap-2 lg:pl-6">
            {items.map((item) => (
              <li key={item.href}>
                {item.external ? (
                  <a href={item.href} className={LINK_CLASS}>
                    {item.label}
                  </a>
                ) : (
                  <Link href={item.href} aria-current={pathname === item.href ? "page" : undefined} onClick={() => { setOpen(false); }} className={LINK_CLASS}>
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2 lg:flex-row">
            <LinkButton href={loginHref} variant="secondary" external>
              Se connecter
            </LinkButton>
            <LinkButton href="/contact">Demander une démonstration</LinkButton>
          </div>
        </nav>
      </div>
    </header>
  );
}
