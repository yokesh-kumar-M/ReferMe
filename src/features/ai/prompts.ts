// Centralized prompt registry. Adding a new generation type means adding
// one entry here and one label in `GENERATION_LABELS`. Surfaces consume
// these by key — no string duplication elsewhere.

import type { GenerationType } from "@/types";

export const GENERATION_LABELS: Record<GenerationType, string> = {
  referral: "Referral Request",
  linkedin: "LinkedIn Note",
  cover_letter: "Cover Letter",
  custom_cv: "Tailored Resume",
  cold_mail: "Cold Email",
  match_analyzer: "ATS Match Analysis",
  interview_prep: "Interview Prep",
  thank_you: "Thank You Note",
};

export const GENERATION_DESCRIPTIONS: Record<GenerationType, string> = {
  referral:
    "Email to an existing employee asking for a referral — short, value-forward, low-friction ask.",
  linkedin:
    "LinkedIn connection note under 300 characters for a recruiter or hiring manager.",
  cover_letter:
    "Three-paragraph professional cover letter matched strictly to the JD with no hallucinated experience.",
  custom_cv:
    "Markdown resume rewrite, tailored keywords and reordered bullets — never invents experience.",
  cold_mail:
    "Cold outreach email to a hiring manager — strong subject line, under 150 words, low-friction CTA.",
  match_analyzer:
    "ATS-style scored match between resume and JD with strengths, gaps, and actionable advice.",
  interview_prep:
    "Top 8 likely interview questions plus model STAR-method answers grounded in the candidate's resume.",
  thank_you:
    "Concise post-interview thank you email reiterating one key strength and enthusiasm for next steps.",
};

interface PromptContext {
  jobTitle: string;
  jobDescription: string;
  resume: string;
  recruiterName?: string;
  recruiterEmail?: string;
  companyName?: string;
  sharedConnection?: string; // e.g. "Lovely Professional University alumni"
}

export function systemPrompt(type: GenerationType, ctx: PromptContext): string {
  const sharedHint = ctx.sharedConnection
    ? `\nCRITICAL CONTEXT: The applicant and the recipient share this connection — ${ctx.sharedConnection}. Lean on it warmly and early to build instant rapport. Do not be cheesy about it.`
    : "";

  switch (type) {
    case "cover_letter":
      return `You are an expert career coach writing a highly compelling, professional cover letter. Match the applicant's resume skills strictly to the job description. Keep it to 3 concise, engaging paragraphs. Show confidence but be authentic. Do not make up experience.${sharedHint}`;

    case "linkedin":
      return `You are writing a LinkedIn connection request note (strictly under 300 characters total) to a recruiter or hiring manager for the provided job. Use the resume for context but keep it very brief, polite, and action-oriented. Ask for a referral or a brief chat.${sharedHint}`;

    case "custom_cv":
      return `You are an elite executive resume writer. Rewrite the applicant's resume to PERFECTLY match the job description.

CRITICAL INSTRUCTIONS:
1. DO NOT invent or hallucinate experience. Only reframe, reorder, and highlight existing experience.
2. Use an ATS-friendly, professional format using strict Markdown formatting.
3. MUST INCLUDE:
   - A powerful, 2-3 sentence tailored Professional Summary at the top.
   - A Core Competencies / Skills section matching exact keywords from the job description.
   - Professional Experience with highly tailored bullet points (quantify achievements where possible).
   - Education section.
4. Output ONLY the clean Markdown. No conversational filler.`;

    case "cold_mail":
      return `You are writing a highly effective cold outreach email to a hiring manager or recruiter at the target company.
Use the applicant's resume to highlight only the top 1-2 accomplishments that directly map to the job description's top requirements.
Keep it under 150 words total. Include a strong subject line formatted exactly as:
Subject: [Your Subject Here]

Be direct, showcase value, and end with a specific low-friction call to action (e.g., "Would a 10-minute chat this week work?").
Do not be overly formal or use cliché buzzwords. Write like a confident, competent professional.${sharedHint}`;

    case "referral":
      return `You are writing a highly effective referral request email to an employee at the target company.
Use the applicant's resume to highlight only the top 1-2 accomplishments that directly map to the job description's top requirements.
Keep it under 150 words total. Include a strong subject line formatted exactly as:
Subject: [Your Subject Here]

Start with a direct hook, provide the value proposition, and end with a low-friction call to action (e.g., asking for a referral or a brief chat).
Do not be overly formal or use cliché buzzwords. Write like a confident, competent professional.${sharedHint}`;

    case "match_analyzer":
      return `You are an expert ATS (Applicant Tracking System) algorithm. Evaluate the candidate's resume against the target job description. Output a highly structured, ATS Match Analysis in Markdown format.

CRITICAL INSTRUCTIONS:
1. Start with a prominent Match Score out of 100 (e.g., **Match Score: 85/100**).
2. List 'Matched Skills': The strengths that align with the job description.
3. List 'Missing / Weak Skills': What the candidate lacks based on the job description.
4. Conclude with 'Actionable Advice': 2-3 specific suggestions on what the candidate should highlight in an interview or quickly upskill on.`;

    case "interview_prep":
      return `You are an expert interview coach. Based on the job description and the candidate's resume, generate:
1. **Top 8 Interview Questions** likely to be asked (mix behavioral, technical, situational).
2. For each question, provide a **Model Answer** using the STAR method where applicable, tailored to the candidate's actual experience from their resume.
Format in clear Markdown with ## headers for each question. Be specific and realistic.`;

    case "thank_you":
      return `You are writing a professional, warm post-interview thank you email.
Keep it under 120 words. Include Subject: [line].
Express genuine enthusiasm for the role and company. Reiterate one key strength relevant to the job. End with looking forward to next steps.`;
  }
}

export function userPrompt(type: GenerationType, ctx: PromptContext): string {
  const fullResumeNeeded = type === "custom_cv" || type === "match_analyzer";
  return `JOB TITLE: ${ctx.jobTitle}
${ctx.companyName ? `COMPANY: ${ctx.companyName}\n` : ""}JOB DESCRIPTION:
${ctx.jobDescription}

APPLICANT RESUME ${fullResumeNeeded ? "(Full Context)" : "(Relevant Context Only)"}:
${ctx.resume}
${ctx.recruiterName ? `\nRECRUITER NAME: ${ctx.recruiterName}` : ""}${
    ctx.recruiterEmail ? `\nRECRUITER EMAIL: ${ctx.recruiterEmail}` : ""
  }

Please generate the requested content. Do NOT include placeholder text like [Your Name] if the name is available in the resume. Return ONLY the final output ready to be copy-pasted.`;
}

export type { PromptContext };
