import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type AppStatus =
  | 'saved'
  | 'applied'
  | 'screening'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'withdrawn';

export interface Interview {
  id: string;
  date: number;
  type: 'phone' | 'video' | 'onsite' | 'technical' | 'hr';
  notes: string;
  outcome?: 'passed' | 'failed' | 'pending';
}

export interface JobApplication {
  id: string;
  jobTitle: string;
  company: string;
  location: string;
  jobUrl: string;
  jobDescription: string;
  salary?: string;
  jobType?: 'full-time' | 'part-time' | 'contract' | 'internship';
  remote?: boolean;
  status: AppStatus;
  appliedDate?: number;
  savedDate: number;
  lastUpdated: number;
  resumeProfileId?: string;
  coverLetter?: string;
  atsScore?: number;
  matchedKeywords?: string[];
  missingKeywords?: string[];
  notes: string;
  interviews: Interview[];
  source: string;
  tags: string[];
  priority: 'low' | 'medium' | 'high';
  companyDomain?: string;
}

export interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  company: string;
  role: string;
  notes: string;
  addedDate: number;
  linkedJobIds: string[];
}

interface DashboardState {
  applications: JobApplication[];
  contacts: Contact[];

  addApplication: (app: Omit<JobApplication, 'id' | 'savedDate' | 'lastUpdated' | 'interviews'>) => string;
  updateApplication: (id: string, updates: Partial<JobApplication>) => void;
  deleteApplication: (id: string) => void;
  moveApplication: (id: string, status: AppStatus) => void;

  addContact: (contact: Omit<Contact, 'id' | 'addedDate'>) => string;
  updateContact: (id: string, updates: Partial<Contact>) => void;
  deleteContact: (id: string) => void;

  getApplicationsByStatus: (status: AppStatus) => JobApplication[];
  getStats: () => {
    total: number;
    applied: number;
    interviewing: number;
    offers: number;
    responseRate: number;
    offerRate: number;
  };
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      applications: [],
      contacts: [],

      addApplication: (app) => {
        const id = genId();
        const now = Date.now();
        set((s) => ({
          applications: [
            {
              ...app,
              id,
              savedDate: now,
              lastUpdated: now,
              interviews: [],
            },
            ...s.applications,
          ],
        }));
        return id;
      },

      updateApplication: (id, updates) => {
        set((s) => ({
          applications: s.applications.map((a) =>
            a.id === id ? { ...a, ...updates, lastUpdated: Date.now() } : a
          ),
        }));
      },

      deleteApplication: (id) => {
        set((s) => ({ applications: s.applications.filter((a) => a.id !== id) }));
      },

      moveApplication: (id, status) => {
        set((s) => ({
          applications: s.applications.map((a) =>
            a.id === id
              ? {
                  ...a,
                  status,
                  lastUpdated: Date.now(),
                  appliedDate: status === 'applied' && !a.appliedDate ? Date.now() : a.appliedDate,
                }
              : a
          ),
        }));
      },

      addContact: (contact) => {
        const id = genId();
        set((s) => ({
          contacts: [{ ...contact, id, addedDate: Date.now() }, ...s.contacts],
        }));
        return id;
      },

      updateContact: (id, updates) => {
        set((s) => ({
          contacts: s.contacts.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        }));
      },

      deleteContact: (id) => {
        set((s) => ({ contacts: s.contacts.filter((c) => c.id !== id) }));
      },

      getApplicationsByStatus: (status) => {
        return get().applications.filter((a) => a.status === status);
      },

      getStats: () => {
        const apps = get().applications;
        const total = apps.length;
        const applied = apps.filter((a) => a.status !== 'saved').length;
        const interviewing = apps.filter((a) => a.status === 'interview').length;
        const offers = apps.filter((a) => a.status === 'offer').length;
        const responseRate = applied > 0 ? Math.round((apps.filter(a => ['screening', 'interview', 'offer'].includes(a.status)).length / applied) * 100) : 0;
        const offerRate = applied > 0 ? Math.round((offers / applied) * 100) : 0;
        return { total, applied, interviewing, offers, responseRate, offerRate };
      },
    }),
    {
      name: 'jobright-dashboard',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
