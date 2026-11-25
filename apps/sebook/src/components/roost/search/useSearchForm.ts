"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EMPTY_SEARCH, searchHref } from "@/marketplace/search";
import type { Kind } from "@/marketplace/schemas";
import type { Place } from "@/marketplace/schemas";

export const MAX_GUESTS = 50;

export interface SearchFormState {
  text: string;
  place: Place | null;
  checkIn: string;
  checkOut: string;
  guests: number;
}

const EMPTY_FORM: SearchFormState = { text: "", place: null, checkIn: "", checkOut: "", guests: 0 };

export interface SearchForm {
  state: SearchFormState;
  setText: (text: string) => void;
  choosePlace: (place: Place, label: string) => void;
  pickDay: (day: string) => "checkout" | "who";
  setGuests: (guests: number) => void;
  clear: () => void;
  submit: (firstSuggestion: Place | null) => void;
}

export function useSearchForm(scope: Kind, onSubmitted: () => void): SearchForm {
  const router = useRouter();
  const [state, setState] = useState<SearchFormState>(EMPTY_FORM);

  const setText = (text: string) => {
    setState((current) => ({ ...current, text, place: null }));
  };
  const choosePlace = (place: Place, label: string) => {
    setState((current) => ({ ...current, text: label, place }));
  };
  const pickDay = (day: string): "checkout" | "who" => {
    if (state.checkIn === "" || state.checkOut !== "" || day <= state.checkIn) {
      setState((current) => ({ ...current, checkIn: day, checkOut: "" }));
      return "checkout";
    }
    setState((current) => ({ ...current, checkOut: day }));
    return "who";
  };
  const setGuests = (guests: number) => {
    setState((current) => ({ ...current, guests: Math.min(MAX_GUESTS, Math.max(0, guests)) }));
  };
  const clear = () => {
    setState(EMPTY_FORM);
  };
  const submit = (firstSuggestion: Place | null) => {
    const place = state.place ?? (state.text.trim() !== "" ? firstSuggestion : null);
    onSubmitted();
    router.push(
      searchHref({
        ...EMPTY_SEARCH,
        scope,
        place: place?.slug ?? "",
        checkIn: state.checkIn && state.checkOut ? state.checkIn : "",
        checkOut: state.checkIn && state.checkOut ? state.checkOut : "",
        guests: state.guests > 0 ? state.guests : null,
      }),
    );
  };

  return { state, setText, choosePlace, pickDay, setGuests, clear, submit };
}
