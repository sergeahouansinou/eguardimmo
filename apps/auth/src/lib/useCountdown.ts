"use client";

import { useEffect, useState } from "react";

export function useCountdown(initialSeconds: number): number {
  const [target, setTarget] = useState<{ initial: number; endsAt: number }>(() => ({
    initial: initialSeconds,
    endsAt: Date.now() + initialSeconds * 1000,
  }));
  const [now, setNow] = useState(() => Date.now());

  if (target.initial !== initialSeconds) {
    setTarget({ initial: initialSeconds, endsAt: Date.now() + initialSeconds * 1000 });
  }

  useEffect(() => {
    if (target.endsAt <= Date.now()) return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => { clearInterval(timer); };
  }, [target]);

  return Math.max(0, Math.ceil((target.endsAt - now) / 1000));
}
