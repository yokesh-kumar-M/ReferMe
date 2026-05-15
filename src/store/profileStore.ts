// User profile (autofill data) + resume profiles. One profile per resume
// so a user can keep, say, a "Frontend" resume and a "Backend" resume and
// pick which one feeds tailoring / autofill on a per-application basis.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { unifiedStorage } from "@/lib/storage";
import type { ResumeProfile, UserProfile } from "@/types";
import { EMPTY_PROFILE } from "@/types";

const DEFAULT_RESUME_ID = "default";

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

interface ProfileState {
  // personal info used by autofill
  profile: UserProfile;
  setProfile: (updates: Partial<UserProfile>) => void;
  setProfileField: <K extends keyof UserProfile>(field: K, value: UserProfile[K]) => void;

  // custom Q&A — answers to non-standard application questions that the
  // user gave us before; key is a normalized field identifier.
  customAnswers: Record<string, string>;
  setCustomAnswer: (key: string, value: string) => void;
  setCustomAnswers: (entries: Record<string, string>) => void;
  clearCustomAnswers: () => void;

  // resumes
  resumes: ResumeProfile[];
  activeResumeId: string;
  addResume: (name: string, content: string) => string;
  updateResume: (id: string, updates: Partial<Omit<ResumeProfile, "id">>) => void;
  deleteResume: (id: string) => void;
  setActiveResume: (id: string) => void;
  getActiveResume: () => ResumeProfile | null;
  getActiveResumeText: () => string;

  hydrated: boolean;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      profile: { ...EMPTY_PROFILE },

      setProfile: (updates) => set((s) => ({ profile: { ...s.profile, ...updates } })),

      setProfileField: (field, value) =>
        set((s) => ({ profile: { ...s.profile, [field]: value } })),

      customAnswers: {},

      setCustomAnswer: (key, value) =>
        set((s) => ({ customAnswers: { ...s.customAnswers, [key]: value } })),

      setCustomAnswers: (entries) =>
        set((s) => ({ customAnswers: { ...s.customAnswers, ...entries } })),

      clearCustomAnswers: () => set({ customAnswers: {} }),

      resumes: [
        { id: DEFAULT_RESUME_ID, name: "Default Resume", content: "", updatedAt: Date.now() },
      ],
      activeResumeId: DEFAULT_RESUME_ID,

      addResume: (name, content) => {
        const id = genId();
        set((s) => ({
          resumes: [...s.resumes, { id, name, content, updatedAt: Date.now() }],
          activeResumeId: id,
        }));
        return id;
      },

      updateResume: (id, updates) =>
        set((s) => ({
          resumes: s.resumes.map((r) =>
            r.id === id ? { ...r, ...updates, updatedAt: Date.now() } : r
          ),
        })),

      deleteResume: (id) =>
        set((s) => {
          const remaining = s.resumes.filter((r) => r.id !== id);
          const nextActive =
            s.activeResumeId === id ? remaining[0]?.id ?? DEFAULT_RESUME_ID : s.activeResumeId;
          return {
            resumes: remaining.length
              ? remaining
              : [{ id: DEFAULT_RESUME_ID, name: "Default Resume", content: "", updatedAt: Date.now() }],
            activeResumeId: nextActive,
          };
        }),

      setActiveResume: (id) => set({ activeResumeId: id }),

      getActiveResume: () => {
        const s = get();
        return s.resumes.find((r) => r.id === s.activeResumeId) ?? null;
      },

      getActiveResumeText: () => {
        const r = get().getActiveResume();
        return r?.content ?? "";
      },

      hydrated: false,
    }),
    {
      name: "referme/profile",
      version: 2,
      storage: createJSONStorage(() => unifiedStorage()),
      partialize: (state) => ({
        profile: state.profile,
        customAnswers: state.customAnswers,
        resumes: state.resumes,
        activeResumeId: state.activeResumeId,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    }
  )
);
