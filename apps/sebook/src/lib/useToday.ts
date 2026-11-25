import { useEffect, useState } from "react";
import { todayIso } from "./dates";

// Vide au rendu serveur et à l'hydratation : une date « du jour » ne doit pas figer dans le HTML prérendu.
export function useToday(): string {
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(todayIso());
  }, []);
  return today;
}
