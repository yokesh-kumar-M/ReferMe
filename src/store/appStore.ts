import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { obfuscateKey, deobfuscateKey } from '@/lib/utils';
import { DEFAULT_RESUME } from '@/lib/yokesh_resume';

interface AppState {
  groqApiKey: string;
  geminiApiKey: string;
  setGroqApiKey: (key: string) => void;
  setGeminiApiKey: (key: string) => void;
  userResume: string;
  setUserResume: (resume: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Note: The API key has been removed from the git history for security reasons as GitHub blocked the push.
      // Please paste your key in the settings UI.
      groqApiKey: '',
      geminiApiKey: '',
      setGroqApiKey: (key) => set({ groqApiKey: key }),
      setGeminiApiKey: (key) => set({ geminiApiKey: key }),
      userResume: DEFAULT_RESUME,
      setUserResume: (resume) => set({ userResume: resume }),
    }),
    {
      name: 'referme-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        ...state,
        // Encrypt API keys before storing them
        groqApiKey: obfuscateKey(state.groqApiKey),
        geminiApiKey: obfuscateKey(state.geminiApiKey),
      }),
      onRehydrateStorage: () => (state) => {
        // Decrypt API keys after loading them from storage
        if (state) {
          state.groqApiKey = deobfuscateKey(state.groqApiKey);
          state.geminiApiKey = deobfuscateKey(state.geminiApiKey);
        }
      },
    }
  )
);