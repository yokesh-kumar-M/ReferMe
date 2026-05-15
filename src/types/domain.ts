// Core domain types shared by website and extension.

export type AIProvider = "groq" | "gemini" | "mistral";

export interface AIKeys {
  groq: string;
  gemini: string;
  mistral: string;
}

export interface ProviderModel {
  groq: string;
  gemini: string;
  mistral: string;
}

export const DEFAULT_MODELS: ProviderModel = {
  groq: "llama-3.3-70b-versatile",
  gemini: "gemini-2.0-flash",
  mistral: "mistral-small-latest",
};

// ──────────────────────────────────────────────────────────────────────
// Profile & resume
// ──────────────────────────────────────────────────────────────────────

export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  linkedin: string;
  website: string;
  github: string;
  city: string;
  state: string;
  country: string;
  zip: string;
  address: string;
  workAuthorized: boolean;
  needsSponsorship: boolean;
  expectedSalary: string;
  yearsOfExperience: string;
  noticePeriod: string;
  pronouns: string;
  gender: string;
  ethnicity: string;
  veteranStatus: string;
  disability: string;
  summary: string;
}

export const EMPTY_PROFILE: UserProfile = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  linkedin: "",
  website: "",
  github: "",
  city: "",
  state: "",
  country: "",
  zip: "",
  address: "",
  workAuthorized: true,
  needsSponsorship: false,
  expectedSalary: "",
  yearsOfExperience: "",
  noticePeriod: "",
  pronouns: "",
  gender: "",
  ethnicity: "",
  veteranStatus: "",
  disability: "",
  summary: "",
};

export interface ResumeProfile {
  id: string;
  name: string;
  content: string;
  updatedAt: number;
}

// ──────────────────────────────────────────────────────────────────────
// Applications & tracker
// ──────────────────────────────────────────────────────────────────────

export type ApplicationStatus =
  | "saved"
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "rejected"
  | "withdrawn";

export type InterviewType = "phone" | "video" | "onsite" | "technical" | "hr";
export type InterviewOutcome = "passed" | "failed" | "pending";

export interface Interview {
  id: string;
  date: number;
  type: InterviewType;
  notes: string;
  outcome: InterviewOutcome;
}

export type Priority = "low" | "medium" | "high";
export type JobType = "full-time" | "part-time" | "contract" | "internship";

export interface JobApplication {
  id: string;
  jobTitle: string;
  company: string;
  location: string;
  jobUrl: string;
  jobDescription: string;
  salary: string;
  jobType: JobType | "";
  remote: boolean;
  status: ApplicationStatus;
  appliedDate: number | null;
  savedDate: number;
  lastUpdated: number;
  resumeProfileId: string;
  coverLetter: string;
  atsScore: number | null;
  matchedKeywords: string[];
  missingKeywords: string[];
  notes: string;
  interviews: Interview[];
  source: string;
  tags: string[];
  priority: Priority;
  companyDomain: string;
}

// ──────────────────────────────────────────────────────────────────────
// Contacts (Insider Connections)
// ──────────────────────────────────────────────────────────────────────

export type ContactType = "recruiter" | "hiring-manager" | "employee" | "referrer" | "other";

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  company: string;
  role: string;
  type: ContactType;
  notes: string;
  addedDate: number;
  lastContacted: number | null;
  linkedJobIds: string[];
}

// ──────────────────────────────────────────────────────────────────────
// Generation history
// ──────────────────────────────────────────────────────────────────────

export type GenerationType =
  | "referral"
  | "linkedin"
  | "cover_letter"
  | "custom_cv"
  | "cold_mail"
  | "match_analyzer"
  | "interview_prep"
  | "thank_you";

export interface GenerationEntry {
  id: string;
  type: GenerationType;
  jobTitle: string;
  company: string;
  result: string;
  timestamp: number;
}

// ──────────────────────────────────────────────────────────────────────
// ATS analysis
// ──────────────────────────────────────────────────────────────────────

export interface ATSAnalysis {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  matchedSkills: string[];
  missingSkills: string[];
  totalKeywords: number;
}

// ──────────────────────────────────────────────────────────────────────
// Job context (extracted from a job page)
// ──────────────────────────────────────────────────────────────────────

export interface JobContext {
  jobTitle: string;
  company: string;
  location: string;
  jobDescription: string;
  jobUrl: string;
  platform: string;
  hmUrl?: string;
  salary?: string;
  remote?: boolean;
}
