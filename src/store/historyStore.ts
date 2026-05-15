// Generation history — last N AI outputs across the surfaces, with the
// jobTitle and result so the user can restore prior drafts.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { unifiedStorage } from "@/lib/storage";
import type { GenerationEntry, GenerationType } from "@/types";

const MAX_ENTRIES = 50;

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

interface HistoryState {
  entries: GenerationEntry[];
  add: (entry: Omit<GenerationEntry, "id" | "timestamp">) => void;
  remove: (id: string) => void;
  clear: () => void;
  byType: (type: GenerationType) => GenerationEntry[];
  hydrated: boolean;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      entries: [],
      hydrated: false,

      add: (entry) =>
        set((s) => ({
          entries: [
            { ...entry, id: genId(), timestamp: Date.now() },
            ...s.entries,
          ].slice(0, MAX_ENTRIES),
        })),

      remove: (id) =>
        set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),

      clear: () => set({ entries: [] }),

      byType: (type) => get().entries.filter((e) => e.type === type),
    }),
    {
      name: "referme/history",
      version: 2,
      storage: createJSONStorage(() => unifiedStorage()),
      partialize: (state) => ({ entries: state.entries }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    }
  )
);
