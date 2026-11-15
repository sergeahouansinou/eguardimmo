"use client";

import { IconButton, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@eguardimmo/ui";
import { Ellipsis } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";

export interface RowMenuItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  href?: string;
  onSelect?: () => void;
  tone?: "default" | "danger";
  separatorBefore?: boolean;
}

export function RowMenu({ label, items }: { label: string; items: readonly RowMenuItem[] }) {
  const router = useRouter();
  return (
    <Menu>
      <MenuTrigger asChild>
        <IconButton label={label} icon={Ellipsis} />
      </MenuTrigger>
      <MenuContent>
        {items.map((item) => (
          <span key={item.id} className="contents">
            {item.separatorBefore ? <MenuSeparator /> : null}
            <MenuItem
              {...(item.icon ? { icon: item.icon } : {})}
              {...(item.tone ? { tone: item.tone } : {})}
              onSelect={() => {
                if (item.href) router.push(item.href);
                item.onSelect?.();
              }}
            >
              {item.label}
            </MenuItem>
          </span>
        ))}
      </MenuContent>
    </Menu>
  );
}
