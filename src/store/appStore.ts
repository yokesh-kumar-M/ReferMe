import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { encryptKey, decryptKey } from '@/lib/utils';

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
      groqApiKey: '',
      geminiApiKey: '',
      setGroqApiKey: (key) => set({ groqApiKey: key }),
      setGeminiApiKey: (key) => set({ geminiApiKey: key }),
      userResume: '',
      setUserResume: (resume) => set({ userResume: resume }),
    }),
    {
      name: 'referme-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        ...state,
        // Encrypt API keys before storing them
        groqApiKey: encryptKey(state.groqApiKey),
        geminiApiKey: encryptKey(state.geminiApiKey),
      }),
      onRehydrateStorage: () => (state) => {
        // Decrypt API keys after loading them from storage
        if (state) {
          state.groqApiKey = decryptKey(state.groqApiKey);
          state.geminiApiKey = decryptKey(state.geminiApiKey);
        }
      },
    }
  )
);