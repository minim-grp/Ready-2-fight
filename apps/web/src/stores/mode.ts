import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ActiveMode = "athlete" | "coach";

type ModeState = {
  mode: ActiveMode;
  setMode: (mode: ActiveMode) => void;
};

export const useModeStore = create<ModeState>()(
  persist(
    (set) => ({
      mode: "athlete",
      setMode: (mode) => set({ mode }),
    }),
    { name: "r2f:active-mode" },
  ),
);
