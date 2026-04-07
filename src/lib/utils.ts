import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Lightweight obfuscation for API keys at rest in local storage.
// NOTE: This is NOT encryption — it's Base64 obfuscation to prevent casual snooping.
// A determined attacker with DevTools access can decode these. True browser-side encryption
// would require a user-provided master password, which is outside the scope of this app.
const OBFUSCATION_SALT = "ReferMe_Obfuscation_2026";

export function obfuscateKey(text: string): string {
  if (!text) return text;
  try {
    const textToEncode = text + OBFUSCATION_SALT;
    return btoa(unescape(encodeURIComponent(textToEncode)));
  } catch {
    return text;
  }
}

export function deobfuscateKey(encoded: string): string {
  if (!encoded) return encoded;
  try {
    const decoded = decodeURIComponent(escape(atob(encoded)));
    if (decoded.endsWith(OBFUSCATION_SALT)) {
      return decoded.slice(0, -OBFUSCATION_SALT.length);
    }
    return encoded; // Fallback if not obfuscated with our salt
  } catch {
    return encoded;
  }
}

export function sanitizeText(text: string): string {
  if (!text) return "";
  // 1. Remove script/style tags and their contents
  let clean = text.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
  // 2. Remove remaining HTML tags but preserve content
  clean = clean.replace(/<[^>]*>?/gm, '');
  // 3. Decode common HTML entities
  clean = clean.replace(/&amp;/g, '&')
               .replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>')
               .replace(/&quot;/g, '"')
               .replace(/&#39;/g, "'")
               .replace(/&nbsp;/g, ' ');
  // 4. Neutralize obvious prompt injection patterns (case-insensitive)
  clean = clean.replace(/ignore\s+(all\s+)?previous\s+instructions/gi, '***');
  clean = clean.replace(/output\s+your\s+(system\s+)?instructions/gi, '***');
  clean = clean.replace(/system\s+prompt/gi, '***');
  clean = clean.replace(/disregard\s+above/gi, '***');
  // 5. Collapse excessive whitespace
  clean = clean.replace(/[ \t]{3,}/g, '  ');
  return clean.trim();
}

export function extractRelevantResumeContext(resumeText: string, jobDescription: string): string {
  if (!resumeText || !jobDescription) return resumeText;
  
  // 1. Extract main keywords from the job description (words > 4 chars)
  const jobWords = jobDescription.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  
  // Basic stop words to ignore
  const stopWords = new Set([
    "with", "this", "that", "from", "your", "will", "have", "been",
    "more", "their", "about", "which", "when", "what", "also", "some",
    "than", "they", "were", "would", "could", "should", "other", "into",
    "only", "very", "just", "most", "such", "like", "over", "each",
    "make", "made", "work", "must", "well", "even", "good", "great",
    "year", "years", "able", "need", "role", "team", "join"
  ]);
  
  const keywords = jobWords.filter(w => !stopWords.has(w));
  const keywordSet = new Set(keywords);
  
  if (keywordSet.size === 0) return resumeText;

  // 2. Split resume into sentences/bullet points
  const bulletPoints = resumeText
    .split(/(?:\n|•|(?<=[.?!])\s+)/)
    .map(s => s.replace(/^[-–—●◦▪▸►]\s*/, '').trim())
    .filter(s => s.length > 10);
  
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
  
  // 5. Take top 12 most relevant points (or those with at least 1 match)
  const topPoints = scoredPoints.filter(p => p.score > 0).slice(0, 12);
  
  // If we found very few matches, fallback to returning the first 12 sentences to provide context
  if (topPoints.length < 3) {
    return bulletPoints.slice(0, 12).join('\n');
  }
  
  return topPoints.map(p => `• ${p.point}`).join('\n');
}

/**
 * Simple Markdown to HTML converter for CV rendering.
 * Handles: headings, bold, italic, bullet lists, numbered lists, horizontal rules, paragraphs.
 */
export function renderMarkdown(text: string): string {
  if (!text) return '';
  
  const lines = text.split('\n');
  const htmlLines: string[] = [];
  let inList = false;
  let listType: 'ul' | 'ol' | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Close list if current line is not a list item
    const isBullet = /^\s*[-*•]\s+/.test(line);
    const isNumbered = /^\s*\d+[.)]\s+/.test(line);
    
    if (inList && !isBullet && !isNumbered) {
      htmlLines.push(listType === 'ol' ? '</ol>' : '</ul>');
      inList = false;
      listType = null;
    }
    
    // Horizontal rule
    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
      htmlLines.push('<hr />');
      continue;
    }
    
    // Headings
    if (line.startsWith('### ')) {
      htmlLines.push(`<h3>${applyInlineFormatting(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      htmlLines.push(`<h2>${applyInlineFormatting(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('# ')) {
      htmlLines.push(`<h1>${applyInlineFormatting(line.slice(2))}</h1>`);
      continue;
    }
    
    // Bullet list items
    if (isBullet) {
      if (!inList || listType !== 'ul') {
        if (inList) htmlLines.push(listType === 'ol' ? '</ol>' : '</ul>');
        htmlLines.push('<ul>');
        inList = true;
        listType = 'ul';
      }
      const content = line.replace(/^\s*[-*•]\s+/, '');
      htmlLines.push(`<li>${applyInlineFormatting(content)}</li>`);
      continue;
    }
    
    // Numbered list items
    if (isNumbered) {
      if (!inList || listType !== 'ol') {
        if (inList) htmlLines.push(listType === 'ol' ? '</ol>' : '</ul>');
        htmlLines.push('<ol>');
        inList = true;
        listType = 'ol';
      }
      const content = line.replace(/^\s*\d+[.)]\s+/, '');
      htmlLines.push(`<li>${applyInlineFormatting(content)}</li>`);
      continue;
    }
    
    // Empty line
    if (line.trim() === '') {
      continue;
    }
    
    // Regular paragraph
    htmlLines.push(`<p>${applyInlineFormatting(line)}</p>`);
  }
  
  // Close any open list
  if (inList) {
    htmlLines.push(listType === 'ol' ? '</ol>' : '</ul>');
  }
  
  return htmlLines.join('\n');
}

function applyInlineFormatting(text: string): string {
  // Bold: **text** or __text__
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
  // Italic: *text* or _text_
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  text = text.replace(/(?<!\w)_(.+?)_(?!\w)/g, '<em>$1</em>');
  // Inline code: `text`
  text = text.replace(/`(.+?)`/g, '<code>$1</code>');
  return text;
}