import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { obfuscateKey, deobfuscateKey } from '@/lib/utils';
import { DEFAULT_RESUME } from '@/lib/yokesh_resume';

// --- Types ---

export interface ResumeProfile {
  id: string;
  name: string;
  content: string;
}

export interface HistoryEntry {
  id: string;
  type: string;
  jobTitle: string;
  result: string;
  timestamp: number;
}

interface AppState {
  // API keys
  groqApiKey: string;
  geminiApiKey: string;
  setGroqApiKey: (key: string) => void;
  setGeminiApiKey: (key: string) => void;

  // Resume profiles
  resumeProfiles: ResumeProfile[];
  activeProfileId: string;
  addResumeProfile: (name: string, content: string) => string;
  updateResumeProfile: (id: string, updates: Partial<Omit<ResumeProfile, 'id'>>) => void;
  deleteResumeProfile: (id: string) => void;
  setActiveProfileId: (id: string) => void;
  getActiveResume: () => string;

  // Legacy — kept for backward compat with existing localStorage
  userResume: string;
  setUserResume: (resume: string) => void;

  // Generation history
  history: HistoryEntry[];
  addHistoryEntry: (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => void;
  deleteHistoryEntry: (id: string) => void;
  clearHistory: () => void;
}

const DEFAULT_PROFILE_ID = 'default';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // API keys
      groqApiKey: '',
      geminiApiKey: '',
      setGroqApiKey: (key) => set({ groqApiKey: key }),
      setGeminiApiKey: (key) => set({ geminiApiKey: key }),

      // Resume profiles
      resumeProfiles: [
        { id: DEFAULT_PROFILE_ID, name: 'Default Resume', content: DEFAULT_RESUME },
      ],
      activeProfileId: DEFAULT_PROFILE_ID,

      addResumeProfile: (name, content) => {
        const id = generateId();
        set((state) => ({
          resumeProfiles: [...state.resumeProfiles, { id, name, content }],
          activeProfileId: id,
        }));
        return id;
      },

      updateResumeProfile: (id, updates) => {
        set((state) => ({
          resumeProfiles: state.resumeProfiles.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
      },

      deleteResumeProfile: (id) => {
        set((state) => {
          const remaining = state.resumeProfiles.filter((p) => p.id !== id);
          // If deleting active profile, switch to first available
          const newActiveId =
            state.activeProfileId === id
              ? remaining[0]?.id || DEFAULT_PROFILE_ID
              : state.activeProfileId;
          return { resumeProfiles: remaining, activeProfileId: newActiveId };
        });
      },

      setActiveProfileId: (id) => set({ activeProfileId: id }),

      getActiveResume: () => {
        const state = get();
        const profile = state.resumeProfiles.find((p) => p.id === state.activeProfileId);
        return profile?.content || state.userResume || '';
      },

      // Legacy
      userResume: DEFAULT_RESUME,
      setUserResume: (resume) => {
        set({ userResume: resume });
        // Also update the active profile's content
        const state = get();
        const activeId = state.activeProfileId;
        set((s) => ({
          resumeProfiles: s.resumeProfiles.map((p) =>
            p.id === activeId ? { ...p, content: resume } : p
          ),
        }));
      },

      // History
      history: [],

      addHistoryEntry: (entry) => {
        set((state) => {
          const newEntry: HistoryEntry = {
            ...entry,
            id: generateId(),
            timestamp: Date.now(),
          };
          // Keep last 20 entries
          const updated = [newEntry, ...state.history].slice(0, 20);
          return { history: updated };
        });
      },

      deleteHistoryEntry: (id) => {
        set((state) => ({
          history: state.history.filter((h) => h.id !== id),
        }));
      },

      clearHistory: () => set({ history: [] }),
    }),
    {
      name: 'referme-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        groqApiKey: obfuscateKey(state.groqApiKey),
        geminiApiKey: obfuscateKey(state.geminiApiKey),
        resumeProfiles: state.resumeProfiles,
        activeProfileId: state.activeProfileId,
        userResume: state.userResume,
        history: state.history,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.groqApiKey = deobfuscateKey(state.groqApiKey);
          state.geminiApiKey = deobfuscateKey(state.geminiApiKey);
        }
      },
    }
  )
);