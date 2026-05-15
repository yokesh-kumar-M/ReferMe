// Lightweight, deterministic ATS-style match scorer. Used everywhere we
// don't want to spend an LLM call: the popup, the in-page badge, the
// tracker card. The AI-powered match_analyzer prompt is a richer
// alternative for the resume optimizer page.

import type { ATSAnalysis } from "@/types";

const STOP_WORDS = new Set([
  "with", "that", "from", "your", "will", "have", "this", "they", "been",
  "were", "more", "their", "about", "which", "when", "what", "also", "some",
  "than", "would", "could", "should", "other", "into", "only", "very",
  "just", "most", "such", "like", "over", "each", "make", "made", "work",
  "must", "well", "even", "good", "great", "year", "years", "able", "need",
  "role", "team", "join", "looking", "candidate", "experience",
]);

const SKILL_HINTS = [
  "python", "typescript", "javascript", "react", "node", "next", "django",
  "kubernetes", "docker", "aws", "gcp", "azure", "graphql", "sql", "nosql",
  "postgres", "mongodb", "redis", "kafka", "spark", "airflow", "tensorflow",
  "pytorch", "rest", "grpc", "rust", "go", "kotlin", "swift", "ios",
  "android", "ml", "ai", "llm", "nlp", "etl", "ci", "cd", "tdd",
  "agile", "scrum", "leadership", "mentor", "communication", "stakeholder",
];

function tokenize(text: string): Set<string> {
  return new Set(
    (text.toLowerCase().match(/\b[a-z][a-z0-9+#.-]{2,}\b/g) || []).filter(
      (w) => !STOP_WORDS.has(w)
    )
  );
}

export function scoreATS(resume: string, jobDescription: string): ATSAnalysis {
  if (!resume || !jobDescription) {
    return {
      score: 0,
      matchedKeywords: [],
      missingKeywords: [],
      matchedSkills: [],
      missingSkills: [],
      totalKeywords: 0,
    };
  }

  const jdTokens = tokenize(jobDescription);
  const resumeTokens = tokenize(resume);
  const resumeText = resume.toLowerCase();

  const matched: string[] = [];
  const missing: string[] = [];
  jdTokens.forEach((w) => {
    if (resumeTokens.has(w) || resumeText.includes(w)) matched.push(w);
    else missing.push(w);
  });

  const matchedSkills = SKILL_HINTS.filter(
    (s) => jdTokens.has(s) && (resumeTokens.has(s) || resumeText.includes(s))
  );
  const missingSkills = SKILL_HINTS.filter(
    (s) => jdTokens.has(s) && !resumeTokens.has(s) && !resumeText.includes(s)
  );

  const ratio = jdTokens.size > 0 ? matched.length / jdTokens.size : 0;
  // Bias upward slightly so a resume hitting >70% of keywords reads as a
  // strong match (which it usually is in practice).
  const score = Math.min(100, Math.round(ratio * 100 * 1.4));

  return {
    score,
    matchedKeywords: matched,
    missingKeywords: missing,
    matchedSkills,
    missingSkills,
    totalKeywords: jdTokens.size,
  };
}
