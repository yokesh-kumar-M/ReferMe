// API keys store. Kept separate from profile/resume so a key rotation
// doesn't trigger a re-persist of the entire app state.
//
// Obfuscation is intentionally weak (base64 + salt) — it stops casual
// snooping in DevTools, nothing more. Real protection would require a
// user-supplied master password, which is outside the scope.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { unifiedStorage } from "@/lib/storage";
import type { AIKeys, AIProvider, ProviderModel } from "@/types";
import { DEFAULT_MODELS } from "@/types";

const SALT = "ReferMe::v2";

function obf(text: string): string {
  if (!text) return "";
  try {
    return btoa(unescape(encodeURIComponent(text + SALT)));
  } catch {
    return text;
  }
}

function deobf(enc: string): string {
  if (!enc) return "";
  try {
    const decoded = decodeURIComponent(escape(atob(enc)));
    return decoded.endsWith(SALT) ? decoded.slice(0, -SALT.length) : decoded;
  } catch {
    return enc;
  }
}

interface KeysState {
  keys: AIKeys;
  models: ProviderModel;
  primary: AIProvider;
  hydrated: boolean;

  setKey: (provider: AIProvider, value: string) => void;
  setModel: (provider: AIProvider, value: string) => void;
  setPrimary: (provider: AIProvider) => void;
  clearAll: () => void;
}

const EMPTY_KEYS: AIKeys = { groq: "", gemini: "", mistral: "" };

export const useKeysStore = create<KeysState>()(
  persist(
    (set) => ({
      keys: EMPTY_KEYS,
      models: { ...DEFAULT_MODELS },
      primary: "groq",
      hydrated: false,

      setKey: (provider, value) =>
        set((s) => ({ keys: { ...s.keys, [provider]: value.trim() } })),

      setModel: (provider, value) =>
        set((s) => ({ models: { ...s.models, [provider]: value.trim() || DEFAULT_MODELS[provider] } })),

      setPrimary: (provider) => set({ primary: provider }),

      clearAll: () => set({ keys: EMPTY_KEYS }),
    }),
    {
      name: "referme/keys",
      version: 2,
      storage: createJSONStorage(() => unifiedStorage()),
      partialize: (state) => ({
        keys: {
          groq: obf(state.keys.groq),
          gemini: obf(state.keys.gemini),
          mistral: obf(state.keys.mistral),
        },
        models: state.models,
        primary: state.primary,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.keys = {
            groq: deobf(state.keys.groq),
            gemini: deobf(state.keys.gemini),
            mistral: deobf(state.keys.mistral),
          };
          state.hydrated = true;
        }
      },
    }
  )
);

export function hasAnyKey(state: KeysState): boolean {
  return !!(state.keys.groq || state.keys.gemini || state.keys.mistral);
}
