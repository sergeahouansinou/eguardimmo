import { create } from "zustand";

export interface Notice {
  tone: "success" | "info" | "warning" | "danger";
  title: string;
  message?: string;
}

interface NoticeState {
  notice: Notice | null;
  carry: boolean;
  show: (notice: Notice, options?: { carry?: boolean }) => void;
  dismiss: () => void;
  settle: () => void;
}

export const useNoticeStore = create<NoticeState>((set, get) => ({
  notice: null,
  carry: false,
  show: (notice, options) => { set({ notice, carry: options?.carry ?? false }); },
  dismiss: () => { set({ notice: null, carry: false }); },
  settle: () => {
    if (get().carry) set({ carry: false });
    else set({ notice: null });
  },
}));
