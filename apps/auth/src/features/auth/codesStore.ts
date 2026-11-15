import { create } from "zustand";

interface CodesState {
  codes: string[] | null;
  reveal: (codes: string[]) => void;
  clear: () => void;
}

export const useCodesStore = create<CodesState>((set) => ({
  codes: null,
  reveal: (codes) => { set({ codes }); },
  clear: () => { set({ codes: null }); },
}));
