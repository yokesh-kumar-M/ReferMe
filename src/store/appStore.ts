import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  groqApiKey: string;
  setGroqApiKey: (key: string) => void;
  userResume: string;
  setUserResume: (resume: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      groqApiKey: '',
      setGroqApiKey: (key) => set({ groqApiKey: key }),
      userResume: '',
      setUserResume: (resume) => set({ userResume: resume }),
    }),
    {
      name: 'referme-storage',
    }
  )
);