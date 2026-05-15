// Job tracker — applications + contacts (Insider Connections). The two
// share a store because they cross-reference (Contact.linkedJobIds points
// at Application.id; updates to one often touch the other).

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { unifiedStorage } from "@/lib/storage";
import type {
  ApplicationStatus,
  Contact,
  Interview,
  JobApplication,
} from "@/types";

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function newApplication(
  partial: Partial<JobApplication> & { jobTitle: string }
): JobApplication {
  const now = Date.now();
  return {
    id: genId(),
    jobTitle: partial.jobTitle,
    company: partial.company ?? "",
    location: partial.location ?? "",
    jobUrl: partial.jobUrl ?? "",
    jobDescription: partial.jobDescription ?? "",
    salary: partial.salary ?? "",
    jobType: partial.jobType ?? "",
    remote: partial.remote ?? false,
    status: partial.status ?? "saved",
    appliedDate: partial.appliedDate ?? null,
    savedDate: partial.savedDate ?? now,
    lastUpdated: now,
    resumeProfileId: partial.resumeProfileId ?? "",
    coverLetter: partial.coverLetter ?? "",
    atsScore: partial.atsScore ?? null,
    matchedKeywords: partial.matchedKeywords ?? [],
    missingKeywords: partial.missingKeywords ?? [],
    notes: partial.notes ?? "",
    interviews: partial.interviews ?? [],
    source: partial.source ?? "manual",
    tags: partial.tags ?? [],
    priority: partial.priority ?? "medium",
    companyDomain: partial.companyDomain ?? "",
  };
}

export interface TrackerStats {
  total: number;
  applied: number;
  interviewing: number;
  offers: number;
  rejected: number;
  responseRate: number;
  offerRate: number;
  savedThisWeek: number;
  appliedThisWeek: number;
}

interface TrackerState {
  applications: JobApplication[];
  contacts: Contact[];
  hydrated: boolean;

  // applications
  addApplication: (partial: Partial<JobApplication> & { jobTitle: string }) => string;
  updateApplication: (id: string, updates: Partial<JobApplication>) => void;
  deleteApplication: (id: string) => void;
  moveApplication: (id: string, status: ApplicationStatus) => void;
  addInterview: (appId: string, interview: Omit<Interview, "id">) => void;
  updateInterview: (appId: string, interviewId: string, updates: Partial<Interview>) => void;
  deleteInterview: (appId: string, interviewId: string) => void;

  // contacts
  addContact: (contact: Omit<Contact, "id" | "addedDate">) => string;
  updateContact: (id: string, updates: Partial<Contact>) => void;
  deleteContact: (id: string) => void;
  linkContactToJob: (contactId: string, jobId: string) => void;
  unlinkContactFromJob: (contactId: string, jobId: string) => void;

  // queries
  getStats: () => TrackerStats;
  getApplicationsByStatus: (status: ApplicationStatus) => JobApplication[];
  getContactsForJob: (jobId: string) => Contact[];
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const useTrackerStore = create<TrackerState>()(
  persist(
    (set, get) => ({
      applications: [],
      contacts: [],
      hydrated: false,

      addApplication: (partial) => {
        const app = newApplication(partial);
        set((s) => ({ applications: [app, ...s.applications] }));
        return app.id;
      },

      updateApplication: (id, updates) =>
        set((s) => ({
          applications: s.applications.map((a) =>
            a.id === id ? { ...a, ...updates, lastUpdated: Date.now() } : a
          ),
        })),

      deleteApplication: (id) =>
        set((s) => ({
          applications: s.applications.filter((a) => a.id !== id),
          contacts: s.contacts.map((c) => ({
            ...c,
            linkedJobIds: c.linkedJobIds.filter((j) => j !== id),
          })),
        })),

      moveApplication: (id, status) =>
        set((s) => ({
          applications: s.applications.map((a) => {
            if (a.id !== id) return a;
            const now = Date.now();
            return {
              ...a,
              status,
              lastUpdated: now,
              appliedDate:
                status === "applied" && !a.appliedDate ? now : a.appliedDate,
            };
          }),
        })),

      addInterview: (appId, interview) =>
        set((s) => ({
          applications: s.applications.map((a) =>
            a.id === appId
              ? {
                  ...a,
                  interviews: [...a.interviews, { ...interview, id: genId() }],
                  lastUpdated: Date.now(),
                }
              : a
          ),
        })),

      updateInterview: (appId, interviewId, updates) =>
        set((s) => ({
          applications: s.applications.map((a) =>
            a.id === appId
              ? {
                  ...a,
                  interviews: a.interviews.map((i) =>
                    i.id === interviewId ? { ...i, ...updates } : i
                  ),
                  lastUpdated: Date.now(),
                }
              : a
          ),
        })),

      deleteInterview: (appId, interviewId) =>
        set((s) => ({
          applications: s.applications.map((a) =>
            a.id === appId
              ? {
                  ...a,
                  interviews: a.interviews.filter((i) => i.id !== interviewId),
                  lastUpdated: Date.now(),
                }
              : a
          ),
        })),

      addContact: (contact) => {
        const id = genId();
        set((s) => ({
          contacts: [
            { ...contact, id, addedDate: Date.now() },
            ...s.contacts,
          ],
        }));
        return id;
      },

      updateContact: (id, updates) =>
        set((s) => ({
          contacts: s.contacts.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        })),

      deleteContact: (id) =>
        set((s) => ({ contacts: s.contacts.filter((c) => c.id !== id) })),

      linkContactToJob: (contactId, jobId) =>
        set((s) => ({
          contacts: s.contacts.map((c) =>
            c.id === contactId && !c.linkedJobIds.includes(jobId)
              ? { ...c, linkedJobIds: [...c.linkedJobIds, jobId] }
              : c
          ),
        })),

      unlinkContactFromJob: (contactId, jobId) =>
        set((s) => ({
          contacts: s.contacts.map((c) =>
            c.id === contactId
              ? { ...c, linkedJobIds: c.linkedJobIds.filter((j) => j !== jobId) }
              : c
          ),
        })),

      getStats: () => {
        const apps = get().applications;
        const now = Date.now();
        const total = apps.length;
        const applied = apps.filter((a) => a.status !== "saved").length;
        const interviewing = apps.filter((a) => a.status === "interview").length;
        const offers = apps.filter((a) => a.status === "offer").length;
        const rejected = apps.filter((a) => a.status === "rejected").length;
        const responded = apps.filter((a) =>
          ["screening", "interview", "offer"].includes(a.status)
        ).length;
        return {
          total,
          applied,
          interviewing,
          offers,
          rejected,
          responseRate: applied > 0 ? Math.round((responded / applied) * 100) : 0,
          offerRate: applied > 0 ? Math.round((offers / applied) * 100) : 0,
          savedThisWeek: apps.filter((a) => now - a.savedDate < WEEK_MS).length,
          appliedThisWeek: apps.filter(
            (a) => a.appliedDate && now - a.appliedDate < WEEK_MS
          ).length,
        };
      },

      getApplicationsByStatus: (status) =>
        get().applications.filter((a) => a.status === status),

      getContactsForJob: (jobId) =>
        get().contacts.filter((c) => c.linkedJobIds.includes(jobId)),
    }),
    {
      name: "referme/tracker",
      version: 2,
      storage: createJSONStorage(() => unifiedStorage()),
      partialize: (state) => ({
        applications: state.applications,
        contacts: state.contacts,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    }
  )
);
