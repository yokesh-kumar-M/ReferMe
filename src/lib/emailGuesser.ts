/**
 * Smart Email Guesser — generates multiple corporate email pattern guesses
 * from a LinkedIn URL slug and a company domain.
 */

export interface EmailGuess {
  email: string;
  pattern: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Extract first and last name from a LinkedIn profile URL slug.
 * Handles patterns like: john-doe-123abc, jane-smith, john-doe-a1b2c3
 */
export function parseLinkedInName(url: string): { first: string; last: string } | null {
  // Match the /in/slug part
  const slugMatch = url.match(/\/in\/([a-z0-9-]+)/i);
  if (!slugMatch) return null;

  const slug = slugMatch[1].toLowerCase();
  
  // Split by dashes
  const parts = slug.split('-').filter(Boolean);
  
  if (parts.length === 0) return null;
  
  // Filter out trailing hash/ID segments (alphanumeric IDs like "a1b2c3", "123abc")
  const nameParts = parts.filter(part => {
    // Keep parts that are mostly letters (at least 70% alpha)
    const alphaCount = (part.match(/[a-z]/g) || []).length;
    return alphaCount / part.length >= 0.7 && part.length > 1;
  });

  if (nameParts.length === 0) {
    // Fallback: just use first part
    return { first: parts[0], last: '' };
  }
  
  if (nameParts.length === 1) {
    return { first: nameParts[0], last: '' };
  }

  return {
    first: nameParts[0],
    last: nameParts[nameParts.length - 1],
  };
}

/**
 * Extract a likely company domain from job title and description.
 * Looks for "at Company" patterns and company.com mentions.
 */
export function extractCompanyDomain(jobTitle: string, jobDescription: string): string {
  // Common company name → domain mappings for well-known companies
  const knownDomains: Record<string, string> = {
    'google': 'google.com',
    'meta': 'meta.com',
    'facebook': 'meta.com',
    'amazon': 'amazon.com',
    'apple': 'apple.com',
    'microsoft': 'microsoft.com',
    'netflix': 'netflix.com',
    'spotify': 'spotify.com',
    'uber': 'uber.com',
    'airbnb': 'airbnb.com',
    'stripe': 'stripe.com',
    'salesforce': 'salesforce.com',
    'oracle': 'oracle.com',
    'ibm': 'ibm.com',
    'adobe': 'adobe.com',
    'twitter': 'x.com',
    'linkedin': 'linkedin.com',
    'shopify': 'shopify.com',
    'atlassian': 'atlassian.com',
    'github': 'github.com',
    'slack': 'slack.com',
    'zoom': 'zoom.us',
    'coinbase': 'coinbase.com',
    'databricks': 'databricks.com',
    'snowflake': 'snowflake.com',
    'palantir': 'palantir.com',
    'nvidia': 'nvidia.com',
    'intel': 'intel.com',
    'samsung': 'samsung.com',
    'tcs': 'tcs.com',
    'infosys': 'infosys.com',
    'wipro': 'wipro.com',
    'accenture': 'accenture.com',
    'deloitte': 'deloitte.com',
    'pwc': 'pwc.com',
    'kpmg': 'kpmg.com',
  };

  const combined = `${jobTitle} ${jobDescription}`.toLowerCase();

  // Strategy 1: Look for "at CompanyName" in job title
  const atMatch = jobTitle.match(/\bat\s+([A-Za-z][A-Za-z0-9\s&.-]+)/i);
  if (atMatch) {
    const companyName = atMatch[1].trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    if (knownDomains[companyName]) return knownDomains[companyName];
    if (companyName.length >= 2) return `${companyName}.com`;
  }

  // Strategy 2: Look for known company names anywhere
  for (const [name, domain] of Object.entries(knownDomains)) {
    const regex = new RegExp(`\\b${name}\\b`, 'i');
    if (regex.test(combined)) return domain;
  }

  // Strategy 3: Look for explicit domain mentions in the JD
  const domainMatch = combined.match(/\b([a-z][a-z0-9-]+)\.(com|io|co|org|dev|ai|tech)\b/);
  if (domainMatch) {
    return `${domainMatch[1]}.${domainMatch[2]}`;
  }

  return '';
}

/**
 * Generate multiple email pattern guesses ranked by likelihood.
 */
export function generateEmailGuesses(
  recruiterUrl: string,
  jobTitle: string,
  jobDescription: string,
  manualDomain?: string
): EmailGuess[] {
  const name = parseLinkedInName(recruiterUrl);
  if (!name) return [];

  const domain = manualDomain || extractCompanyDomain(jobTitle, jobDescription);
  if (!domain) return [];

  const { first, last } = name;
  const guesses: EmailGuess[] = [];

  if (first && last) {
    // Most common corporate patterns (ranked by real-world frequency)
    guesses.push(
      { email: `${first}.${last}@${domain}`, pattern: 'first.last', confidence: 'high' },
      { email: `${first}@${domain}`, pattern: 'first', confidence: 'high' },
      { email: `${first[0]}${last}@${domain}`, pattern: 'flast', confidence: 'medium' },
      { email: `${first}${last[0]}@${domain}`, pattern: 'firstl', confidence: 'medium' },
      { email: `${first}_${last}@${domain}`, pattern: 'first_last', confidence: 'medium' },
      { email: `${first}${last}@${domain}`, pattern: 'firstlast', confidence: 'low' },
      { email: `${last}.${first}@${domain}`, pattern: 'last.first', confidence: 'low' },
    );
  } else if (first) {
    guesses.push(
      { email: `${first}@${domain}`, pattern: 'first', confidence: 'medium' },
    );
  }

  return guesses;
}
