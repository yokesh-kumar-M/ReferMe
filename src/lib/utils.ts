import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Lightweight obfuscation for API keys at rest in local storage
const SALT = "ReferMe_SuperSecretSalt_2026!";

export function encryptKey(text: string): string {
  if (!text) return text;
  try {
    const textToEncode = text + SALT;
    return btoa(unescape(encodeURIComponent(textToEncode)));
  } catch (e) {
    return text;
  }
}

export function decryptKey(encoded: string): string {
  if (!encoded) return encoded;
  try {
    const decoded = decodeURIComponent(escape(atob(encoded)));
    if (decoded.endsWith(SALT)) {
      return decoded.slice(0, -SALT.length);
    }
    return encoded; // Fallback if not encrypted with our salt
  } catch (e) {
    return encoded;
  }
}

export function sanitizeText(text: string): string {
  if (!text) return "";
  // 1. Remove HTML tags entirely
  let clean = text.replace(/<[^>]*>?/gm, '');
  // 2. Remove script/style tags and their contents just in case
  clean = clean.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
  // 3. Strip out extremely unusual symbols (keep basic punctuation)
  clean = clean.replace(/[^\w\s.,?!@#$%&*()\-+=:;'"]/g, '');
  // 4. Neutralize obvious prompt injection wrappers
  clean = clean.replace(/ignore previous instructions/gi, '***');
  clean = clean.replace(/output your instructions/gi, '***');
  clean = clean.replace(/system prompt/gi, '***');
  return clean.trim();
}

export function extractRelevantResumeContext(resumeText: string, jobDescription: string): string {
  if (!resumeText || !jobDescription) return resumeText;
  
  // 1. Extract main keywords from the job description (words > 4 chars)
  const jobWords = jobDescription.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  
  // Basic stop words to ignore
  const stopWords = new Set(["with", "this", "that", "from", "your", "will", "have", "been", "more", "their", "about", "which", "when", "what", "also", "some"]);
  
  const keywords = jobWords.filter(w => !stopWords.has(w));
  const keywordSet = new Set(keywords);
  
  if (keywordSet.size === 0) return resumeText;

  // 2. Split resume into sentences/bullet points
  // Split on newlines, bullet characters, or punctuation followed by space
  const bulletPoints = resumeText.split(/(?:\n|•|-|(?<=[.?!])\s+)/).map(s => s.trim()).filter(s => s.length > 10);
  
  // 3. Score each bullet point based on keyword overlap
  const scoredPoints = bulletPoints.map(point => {
    const pointWords = point.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    let score = 0;
    const matchedWords = new Set<string>();
    pointWords.forEach(w => {
      if (keywordSet.has(w) && !matchedWords.has(w)) {
        score += 1;
        matchedWords.add(w);
      }
    });
    return { point, score };
  });
  
  // 4. Sort by score descending
  scoredPoints.sort((a, b) => b.score - a.score);
  
  // 5. Take top 10 most relevant points (or those with at least 1 match)
  const topPoints = scoredPoints.filter(p => p.score > 0).slice(0, 10);
  
  // If we found very few matches, fallback to returning the first 10 sentences to provide *some* context
  if (topPoints.length < 3) {
    return bulletPoints.slice(0, 10).join('\n');
  }
  
  return topPoints.map(p => `• ${p.point}`).join('\n');
}