"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function useConsumedParams<Name extends string>(names: readonly Name[]): Record<Name, string> {
  const params = useSearchParams();
  const [values] = useState(() => Object.fromEntries(names.map((name) => [name, params.get(name) ?? ""])) as Record<Name, string>);

  useEffect(() => {
    const url = new URL(window.location.href);
    const present = names.filter((name) => url.searchParams.has(name));
    if (present.length === 0) return;
    for (const name of present) url.searchParams.delete(name);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [names]);

  return values;
}
