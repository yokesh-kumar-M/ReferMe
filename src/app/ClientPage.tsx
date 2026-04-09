"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "@/store/appStore";
import { motion, AnimatePresence } from "framer-motion";
import { sanitizeText, extractRelevantResumeContext, renderMarkdown } from "@/lib/utils";
import { generateEmailGuesses, type EmailGuess } from "@/lib/emailGuesser";
import { 
  Briefcase, FileText, Send, Sparkles, Settings,
  CheckCircle2, AlertCircle, Copy, FileUp, X, Mail, Upload, Link,
  Building, GraduationCap, Zap, ArrowRight, Clock, Trash2,
  Plus, User, ChevronDown, Wand2, Download, ListTodo
} from "lucide-react";

type GenerationType = "referral" | "linkedin" | "cover_letter" | "custom_cv" | "cold_mail" | "match_analyzer";

const GENERATION_LABELS: Record<GenerationType, string> = {
  referral: "Referral Request",
  linkedin: "LinkedIn Note",
  cover_letter: "Cover Letter",
  custom_cv: "Custom CV",
  cold_mail: "Cold Email",
  match_analyzer: "Match Analyzer",
};

export default function ClientPage() {
  const store = useAppStore();
  const [mounted, setMounted] = useState(false);
  
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [generationType, setGenerationType] = useState<GenerationType>("referral");
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const [resumeFileName, setResumeFileName] = useState("");
  const [recruiterUrl, setRecruiterUrl] = useState("");
  const [recruiterEmail, setRecruiterEmail] = useState("");
  const [isExtension, setIsExtension] = useState(false);
  const [isLpuAlumni, setIsLpuAlumni] = useState(false);
  const [isAutofilling, setIsAutofilling] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Email guesser state
  const [emailGuesses, setEmailGuesses] = useState<EmailGuess[]>([]);
  // History panel
  const [showHistory, setShowHistory] = useState(false);
  // Profile management
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [showNewProfileInput, setShowNewProfileInput] = useState(false);

  useEffect(() => {
    setMounted(true);
    const inIframe = window !== window.parent;
    
    if (typeof chrome !== "undefined" && chrome.tabs && !inIframe) {
      setIsExtension(true);
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "REFERME_JOB_DATA") {
        if (event.data.jobTitle) setJobTitle(event.data.jobTitle);
        if (event.data.jobDescription) setJobDescription(event.data.jobDescription);
      }
    };
    
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const extractLinkedInContext = useCallback(async () => {
    if (!isExtension) {
      setError("This feature is only available when running as a Chrome Extension.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) {
        throw new Error("No active tab found.");
      }

      if (tab.url.includes("linkedin.com/jobs")) {
        const [injectionResult] = await chrome.scripting.executeScript({
          target: { tabId: tab.id! },
          func: () => {
            const titleEl = document.querySelector(".job-details-jobs-unified-top-card__job-title") || document.querySelector("h1");
            const descEl = document.getElementById("job-details") || document.querySelector(".jobs-description__content");
            
            let hmUrl = "";
            const hmLinks = Array.from(document.querySelectorAll("a[href*='/in/']"));
            const hirerCard = hmLinks.find(a => a.closest('.hirer-card__hirer-information'));
            if (hirerCard) {
              hmUrl = (hirerCard as HTMLAnchorElement).href;
            }

            return {
              type: "job" as const,
              title: titleEl ? (titleEl as HTMLElement).innerText.trim() : "",
              description: descEl ? (descEl as HTMLElement).innerText.trim() : "",
              hmUrl: hmUrl.split('?')[0]
            };
          }
        });

        const extracted = injectionResult.result;
        if (extracted?.title) setJobTitle(extracted.title);
        if (extracted?.description) setJobDescription(extracted.description);
        
        setGenerationType("cover_letter");
        
        if (extracted?.hmUrl) {
           setRecruiterUrl(extracted.hmUrl);
           setGenerationType("cold_mail");
        }

      } else if (tab.url.includes("linkedin.com/in/")) {
        const [injectionResult] = await chrome.scripting.executeScript({
          target: { tabId: tab.id! },
          func: () => {
            const bodyText = document.body.innerText.toLowerCase();
            const isLpu = bodyText.includes("lovely professional university") || bodyText.includes(" lpu ");
            
            const headlineEl = document.querySelector(".text-body-medium");
            const headline = headlineEl ? (headlineEl as HTMLElement).innerText.toLowerCase() : "";
            const isHiringManager = headline.includes("recruiter") || 
                                    headline.includes("talent") || 
                                    headline.includes("hiring") || 
                                    headline.includes("hr ") ||
                                    headline.includes("human resources");

            return {
              type: "profile" as const,
              isLpu: isLpu,
              isHiringManager: isHiringManager
            };
          }
        });
        
        setRecruiterUrl(tab.url);
        
        if (injectionResult.result?.isHiringManager) {
          setGenerationType("cold_mail");
        } else {
          setGenerationType("referral");
        }

        if (injectionResult.result?.isLpu) {
          setIsLpuAlumni(true);
        }
      } else {
        throw new Error("Please navigate to a LinkedIn Job or Profile page first.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error during scraping.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [isExtension]);

  // Automatically scrape when in extension mode
  useEffect(() => {
    if (isExtension && mounted) {
      if (!jobTitle && !jobDescription) {
        extractLinkedInContext();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExtension, mounted]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      return;
    }

    setLoading(true);
    setError("");
    setResumeFileName(file.name);

    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(" ");
        fullText += pageText + "\n";
      }

      store.setUserResume(fullText.trim());
    } catch (err: unknown) {
      setError("Failed to parse PDF. Please ensure it is a valid text-based PDF.");
      console.error(err);
      setResumeFileName("");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateEmailGuesses = () => {
    if (!recruiterUrl) {
      setError("Please paste a recruiter's LinkedIn URL.");
      return;
    }
    
    const guesses = generateEmailGuesses(recruiterUrl, jobTitle, jobDescription);
    if (guesses.length === 0) {
      setError("Could not extract name or company from the URL and job details. Please check the inputs.");
      return;
    }
    
    setEmailGuesses(guesses);
    setRecruiterEmail(guesses[0].email); // Default to highest confidence
  };

  const generateContent = async () => {
    if (!store.groqApiKey && !store.geminiApiKey) {
      setError("Please add an API Key (Groq or Gemini) in the settings.");
      setShowSettings(true);
      return;
    }
    if (!store.getActiveResume()) {
      setError("Please upload your resume first.");
      return;
    }
    if (!jobDescription) {
      setError("Please paste the job description.");
      return;
    }

    setLoading(true);
    setError("");
    setResult("");

    const activeResume = store.getActiveResume();

    const lpuContext = isLpuAlumni 
      ? `\nCRITICAL: The applicant and the recipient BOTH attended Lovely Professional University (LPU). You MUST prominently leverage this shared alumni connection. Start the message by warmly calling out this shared LPU college connection to build instant rapport.` 
      : "";

    const systemPrompts: Record<GenerationType, string> = {
      cover_letter: `You are an expert career coach writing a highly compelling, professional cover letter. Match the applicant's resume skills strictly to the job description. Keep it to 3 concise, engaging paragraphs. Show confidence but be authentic. Do not make up experience.${lpuContext}`,
      
      linkedin: `You are writing a LinkedIn connection request note (strictly under 300 characters total) to a recruiter or hiring manager for the provided job. Use the resume for context but keep it very brief, polite, and action-oriented. Ask for a referral or a brief chat.${lpuContext}`,
      
      custom_cv: `You are an elite executive resume writer. Rewrite the applicant's resume to PERFECTLY match the job description.
CRITICAL INSTRUCTIONS:
1. DO NOT invent or hallucinate experience. Only reframe, reorder, and highlight existing experience.
2. Use an ATS-friendly, professional format using strict Markdown formatting.
3. MUST INCLUDE:
   - A powerful, 2-3 sentence tailored Professional Summary at the top.
   - A Core Competencies/Skills section matching exact keywords from the job description.
   - Professional Experience with highly tailored bullet points (quantify achievements where possible).
   - Education section.
4. Output ONLY the clean Markdown. No conversational filler.`,
      
      cold_mail: `You are writing a highly effective cold outreach email to a hiring manager or recruiter at the target company.
Use the applicant's resume to highlight only the top 1-2 accomplishments that directly map to the job description's top requirements.
Keep it under 150 words total. Include a strong subject line formatted exactly as:
Subject: [Your Subject Here]

Be direct, showcase value, and end with a specific low-friction call to action (e.g., "Would a 10-minute chat this week work?").
Do not be overly formal or use cliché buzzwords. Write like a confident, competent professional.${lpuContext}`,
      
      referral: `You are writing a highly effective referral request email to an employee at the target company.
Use the applicant's resume to highlight only the top 1-2 accomplishments that directly map to the job description's top requirements.
Keep it under 150 words total. Include a strong subject line formatted exactly as:
Subject: [Your Subject Here]

Start with a direct hook, provide the value proposition, and end with a low-friction call to action (e.g., asking for a referral or a brief chat).
Do not be overly formal or use cliché buzzwords. Write like a confident, competent professional.${lpuContext}`,
      
      match_analyzer: `You are an expert ATS (Applicant Tracking System) algorithm. Evaluate the candidate's resume against the target job description. Output a highly structured, ATS Match Analysis in Markdown format. 

CRITICAL INSTRUCTIONS:
1. Start with a prominent Match Score out of 100 (e.g., **Match Score: 85/100**).
2. List 'Matched Skills': The strengths that align with the job description.
3. List 'Missing/Weak Skills': What the candidate lacks based on the job description.
4. Conclude with 'Actionable Advice': 2-3 specific suggestions on what the candidate should highlight in an interview or quickly upskill on.`,
    };

    const systemPrompt = systemPrompts[generationType];
    const sanitizedJobDesc = sanitizeText(jobDescription);
    const relevantResume = (generationType === "custom_cv" || generationType === "match_analyzer")
      ? activeResume 
      : extractRelevantResumeContext(activeResume, sanitizedJobDesc);

    const userPrompt = `
      JOB TITLE: ${sanitizeText(jobTitle)}
      JOB DESCRIPTION:
      ${sanitizedJobDesc}
      
      APPLICANT RESUME ${(generationType === "custom_cv" || generationType === "match_analyzer") ? '(Full Context)' : '(Relevant Context Only)'}:
      ${relevantResume}
      ${recruiterEmail ? `\n      TARGET RECRUITER EMAIL: ${recruiterEmail}` : ''}
      
      Please generate the requested content. DO NOT include any placeholder text like [Your Name] if the name is available in the resume. Return ONLY the final output ready to be copy-pasted.
    `;

    try {
      if (store.groqApiKey) {
        try {
          await tryGenerateWithGroq(systemPrompt, userPrompt);
        } catch (groqErr: unknown) {
          console.warn("Groq failed, attempting Gemini fallback:", groqErr);
          if (store.geminiApiKey) {
            await tryGenerateWithGemini(systemPrompt, userPrompt);
          } else {
            throw groqErr;
          }
        }
      } else if (store.geminiApiKey) {
        await tryGenerateWithGemini(systemPrompt, userPrompt);
      } else {
        throw new Error("No API keys configured.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to generate content.";
      setError(message);
      setLoading(false);
      return;
    }

    // Save to history after generation completes
    // We read result from the latest state via a micro-delay
    setTimeout(() => {
      const currentResult = document.querySelector('.whitespace-pre-wrap, .markdown-output')?.textContent;
      if (currentResult) {
        store.addHistoryEntry({
          type: generationType,
          jobTitle: jobTitle || 'Untitled',
          result: currentResult,
        });
      }
    }, 500);
  };

  const tryGenerateWithGroq = async (systemPrompt: string, userPrompt: string) => {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${store.groqApiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.6,
        stream: true,
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Groq API error (${response.status})`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Stream reader not available");
    
    const decoder = new TextDecoder();
    let currentText = "";
    
    setLoading(false);

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6));
            const content = data.choices?.[0]?.delta?.content;
            if (content) {
              currentText += content;
              setResult(currentText);
            }
          } catch {
            // Skip malformed JSON chunks during streaming
          }
        }
      }
    }
  };

  const tryGenerateWithGemini = async (systemPrompt: string, userPrompt: string) => {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?key=${store.geminiApiKey}`, 
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          contents: [{
            role: "user",
            parts: [{ text: userPrompt }]
          }],
          generationConfig: { temperature: 0.6 }
        })
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Gemini API error (${response.status})`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Stream reader not available");
    
    const decoder = new TextDecoder();
    let currentText = "";
    let buffer = "";
    
    setLoading(false);

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      // Try to extract text chunks from the streamed JSON array
      const matches = [...buffer.matchAll(/"text"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g)];
      for (const match of matches) {
        try {
          const piece = JSON.parse(`"${match[1]}"`);
          currentText += piece;
          setResult(currentText);
        } catch {
          // Skip malformed chunks
        }
      }
      // Keep only the tail after last match to avoid re-processing
      if (matches.length > 0) {
        const lastMatch = matches[matches.length - 1];
        const lastIndex = (lastMatch.index || 0) + lastMatch[0].length;
        buffer = buffer.slice(lastIndex);
      }
    }
  };

  const autoFillApplication = async () => {
    if (!store.groqApiKey && !store.geminiApiKey) {
      setError("Please add an API Key (Groq or Gemini) in the settings.");
      setShowSettings(true);
      return;
    }
    if (!store.getActiveResume()) {
      setError("Please upload your resume first to use Autofill.");
      return;
    }

    setIsAutofilling(true);
    setError("");

    try {
      // 1. Check for recent cached autofill data (Multi-Step Form Persistence)
      if (typeof chrome !== "undefined" && chrome.storage) {
        const { autofillCache } = await chrome.storage.local.get("autofillCache") as { autofillCache?: { timestamp: number, data: any } };
        // Use cache if it's less than 60 minutes old
        if (autofillCache && autofillCache.timestamp > Date.now() - 60 * 60 * 1000) {
          console.log("Using cached autofill data...");
          
          let data = autofillCache.data;
          // Dynamically attach the newest cover letter if available
          if (generationType === "cover_letter" && result) {
            data.coverLetter = result;
          }

          window.parent.postMessage({ type: "REFERME_AUTOFILL", payload: data }, "*");
          setIsAutofilling(false);
          return;
        }
      }

      // 2. Otherwise generate using LLM
      const systemPrompt = `You are a JSON extraction agent. Extract the applicant's personal information from the provided resume to fill out a job application form. 
Return ONLY valid JSON with no markdown formatting, backticks, or extra text.
The JSON must have these exact keys, using empty strings if not found:
{
  "firstName": "",
  "lastName": "",
  "fullName": "",
  "email": "",
  "phone": "",
  "linkedin": "",
  "website": ""
}`;
      const userPrompt = store.getActiveResume();
      let jsonText = "";

      if (store.groqApiKey) {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${store.groqApiKey}`
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            temperature: 0.1,
            response_format: { type: "json_object" }
          })
        });
        
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || "Groq request failed");
        }
        
        const data = await response.json();
        jsonText = data.choices[0].message.content;
      } else if (store.geminiApiKey) {
         const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${store.geminiApiKey}`, 
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [{ role: "user", parts: [{ text: userPrompt }] }],
              generationConfig: { 
                temperature: 0.1,
                responseMimeType: "application/json"
              }
            })
          }
        );
        
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || "Gemini request failed");
        }
        
        const data = await response.json();
        jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      } else {
        throw new Error("API key required for JSON autofill.");
      }

      const extractedData = JSON.parse(jsonText);
      
      // Save to chrome storage for persistence across pagination (Workday, etc)
      if (typeof chrome !== "undefined" && chrome.storage) {
        await chrome.storage.local.set({
          autofillCache: {
            timestamp: Date.now(),
            data: extractedData
          }
        });
      }

      if (generationType === "cover_letter" && result) {
        extractedData.coverLetter = result;
      }

      window.parent.postMessage({
        type: "REFERME_AUTOFILL",
        payload: extractedData
      }, "*");
      
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to extract autofill data.";
      setError(message);
    } finally {
      setIsAutofilling(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openInEmail = () => {
    let subject = jobTitle ? `Application for ${jobTitle}` : "Job Application Inquiry";
    let body = result;

    const subjectMatch = result.match(/^Subject:\s*(.+)$/m);
    if (subjectMatch) {
      subject = subjectMatch[1].trim();
      body = result.replace(/^Subject:\s*(.+)$/m, "").trim();
    }

    const mailtoLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${recruiterEmail ? encodeURIComponent(recruiterEmail) : ''}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, "_blank");
  };

  const downloadPDF = async () => {
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const element = document.querySelector(".markdown-output");
      if (!element) return;
      
      const opt = {
        margin:       10,
        filename:     `Resume_${jobTitle.replace(/[^a-zA-Z0-9]/g, '_') || 'Custom'}.pdf`,
        image:        { type: 'jpeg' as const, quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm' as const, format: 'a4', orientation: 'portrait' as const }
      };

      // Wrap in a temporary styled div to ensure PDF looks like a clean document
      const printWrapper = document.createElement("div");
      printWrapper.innerHTML = element.innerHTML;
      printWrapper.style.padding = "20px";
      printWrapper.style.fontFamily = "Arial, sans-serif";
      printWrapper.style.color = "#000";
      
      html2pdf().set(opt).from(printWrapper).save();
    } catch (e) {
      console.error("Failed to generate PDF", e);
      setError("Failed to generate PDF. Make sure you are generating a Custom CV.");
    }
  };

  // --- Computed state for step indicator ---
  const completedSteps = [
    !!store.getActiveResume(),
    !!jobDescription,
    !!result,
  ];
  const stepLabels = ["Upload Resume", "Add Job Details", "Generate"];

  if (!mounted) {
    return (
      <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <p className="mt-4 text-zinc-500">Loading ReferMe...</p>
      </div>
    );
  }

  const hasApiKey = store.groqApiKey || store.geminiApiKey;

  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6 text-zinc-900 font-sans selection:bg-indigo-200">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl shadow-indigo-500/10 border border-zinc-200/80 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-violet-500" />
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-indigo-600 shadow-inner">
            <Sparkles size={32} strokeWidth={2.5} />
          </div>
          <h2 className="text-2xl font-black tracking-tight mb-2">Welcome to ReferMe Agent</h2>
          <p className="text-sm text-zinc-500 mb-8 leading-relaxed">
            Your personal AI job application assistant. To get started, please provide an API key. Your key is stored securely in your browser.
          </p>
          
          <div className="space-y-4 text-left">
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-zinc-500 mb-2">Groq API Key (Recommended)</label>
              <input 
                type="password"
                value={store.groqApiKey}
                onChange={(e) => store.setGroqApiKey(e.target.value)}
                placeholder="gsk_..."
                className="w-full px-4 py-3 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-zinc-400"
              />
              <p className="text-[10px] text-zinc-500 mt-2 font-medium text-right">
                <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-700 hover:underline transition-colors">Get a Groq key &rarr;</a>
              </p>
            </div>
            
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-zinc-100"></div>
              <span className="flex-shrink-0 mx-4 text-zinc-300 text-[10px] font-bold uppercase tracking-widest">or</span>
              <div className="flex-grow border-t border-zinc-100"></div>
            </div>
            
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-zinc-500 mb-2">Gemini API Key</label>
              <input 
                type="password"
                value={store.geminiApiKey}
                onChange={(e) => store.setGeminiApiKey(e.target.value)}
                placeholder="AIza..."
                className="w-full px-4 py-3 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-zinc-400"
              />
              <p className="text-[10px] text-zinc-500 mt-2 font-medium text-right">
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-700 hover:underline transition-colors">Get a Gemini key &rarr;</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans flex flex-col selection:bg-indigo-200">
      {/* Header */}
      <header className="flex items-center justify-between px-6 lg:px-12 py-4 bg-white/80 backdrop-blur-xl border-b border-zinc-200/80 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-indigo-600 to-violet-500 p-2 rounded-xl text-white shadow-md shadow-indigo-500/20 flex items-center justify-center">
            <Sparkles size={22} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-black tracking-tight text-zinc-900 leading-none">ReferMe</h1>
            <p className="text-xs text-zinc-500 font-medium leading-none mt-1">AI-Powered Career Toolkit</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 ${showHistory ? 'bg-violet-50 text-violet-600 shadow-sm border border-violet-200' : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900 shadow-sm'}`}
          >
            <ListTodo size={18} />
            <span className="text-sm font-bold hidden sm:inline">Tracker</span>
            {store.history.length > 0 && (
              <span className="bg-violet-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{store.history.length}</span>
            )}
          </button>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 ${showSettings ? 'bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-200' : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900 shadow-sm'}`}
          >
            <Settings size={18} />
            <span className="text-sm font-bold hidden sm:inline">Settings</span>
          </button>
        </div>
      </header>

      {/* Step Progress Indicator */}
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <div className="flex items-center gap-2 sm:gap-4">
          {stepLabels.map((label, idx) => (
            <React.Fragment key={label}>
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300
                  ${completedSteps[idx] 
                    ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200' 
                    : 'bg-zinc-200 text-zinc-500'}`}
                >
                  {completedSteps[idx] ? <CheckCircle2 size={14} strokeWidth={3} /> : idx + 1}
                </div>
                <span className={`text-xs font-semibold hidden sm:inline ${completedSteps[idx] ? 'text-emerald-700' : 'text-zinc-500'}`}>
                  {label}
                </span>
              </div>
              {idx < stepLabels.length - 1 && (
                <div className={`flex-1 h-0.5 rounded transition-colors duration-300 ${completedSteps[idx] ? 'bg-emerald-300' : 'bg-zinc-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* Error State - Global */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-red-50 text-red-700 p-4 rounded-2xl flex items-start gap-3 border border-red-100 shadow-sm mb-6"
            >
              <AlertCircle size={20} className="shrink-0 mt-0.5 text-red-500" />
              <p className="text-sm font-medium leading-relaxed">{error}</p>
              <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-700">
                <X size={20} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mb-6"
            >
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-indigo-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500" />
                <h3 className="text-base font-bold text-zinc-800 mb-1 flex items-center gap-2">
                  <Settings size={18} className="text-indigo-500" /> API Configuration
                </h3>
                <p className="text-xs text-zinc-500 mb-4">Your API keys are stored locally in your browser and never sent to our servers.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs uppercase tracking-wider font-bold text-zinc-500 mb-2">Groq API Key (Primary, Fast)</label>
                    <input 
                      type="password"
                      value={store.groqApiKey}
                      onChange={(e) => store.setGroqApiKey(e.target.value)}
                      placeholder="gsk_..."
                      className="w-full px-4 py-2.5 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-zinc-400"
                    />
                    <p className="text-xs text-zinc-500 mt-2 font-medium">
                      Get a free key at <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-700 hover:underline">console.groq.com</a>
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider font-bold text-zinc-500 mb-2">Gemini API Key (Fallback)</label>
                    <input 
                      type="password"
                      value={store.geminiApiKey}
                      onChange={(e) => store.setGeminiApiKey(e.target.value)}
                      placeholder="AIza..."
                      className="w-full px-4 py-2.5 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-zinc-400"
                    />
                    <p className="text-xs text-zinc-500 mt-2 font-medium">
                      Get a free key at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-700 hover:underline">aistudio.google.com</a>
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* History Panel */}
        <AnimatePresence>
          {showHistory && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mb-6"
            >
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-violet-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-violet-500" />
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-zinc-800 flex items-center gap-2">
                    <ListTodo size={18} className="text-violet-500" /> Application Tracker
                  </h3>
                  {store.history.length > 0 && (
                    <button
                      onClick={() => { if (confirm('Clear all tracked applications?')) store.clearHistory(); }}
                      className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1"
                    >
                      <Trash2 size={14} /> Clear All
                    </button>
                  )}
                </div>
                {store.history.length === 0 ? (
                  <p className="text-sm text-zinc-400 text-center py-6">No jobs tracked yet.</p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {store.history.map((entry) => (
                      <div key={entry.id} className="flex items-center gap-3 bg-zinc-50 border border-zinc-200/80 rounded-xl p-3 hover:border-violet-300 transition-all group">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">{entry.type.replace('_', ' ')}</span>
                            <span className="text-[10px] text-zinc-400">{new Date(entry.timestamp).toLocaleDateString()}</span>
                          </div>
                          <p className="text-sm font-bold text-zinc-700 truncate">{entry.jobTitle}</p>
                          <p className="text-xs text-zinc-400 truncate">{entry.result.slice(0, 80)}...</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setResult(entry.result); setShowHistory(false); }}
                            className="text-xs bg-violet-100 text-violet-700 hover:bg-violet-200 px-2.5 py-1.5 rounded-lg font-bold"
                          >
                            Restore
                          </button>
                          <button
                            onClick={() => store.deleteHistoryEntry(entry.id)}
                            className="text-zinc-400 hover:text-red-500 p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          
          {/* Left Column: Inputs & Context */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Resume Section */}
            <section className="bg-white rounded-2xl p-5 shadow-sm border border-zinc-200/80">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
                  <FileText size={18} className="text-indigo-500" /> Document Context
                </h2>
                {store.getActiveResume() && <CheckCircle2 size={18} className="text-emerald-500 drop-shadow-sm" />}
              </div>

              {/* Profile Selector */}
              <div className="mb-4 relative">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <button
                      onClick={() => setShowProfileMenu(!showProfileMenu)}
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-zinc-50 border border-zinc-200/80 rounded-xl text-sm font-bold text-zinc-700 hover:border-indigo-300 transition-all"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <User size={14} className="text-indigo-500 shrink-0" />
                        {store.resumeProfiles.find(p => p.id === store.activeProfileId)?.name || 'Default Resume'}
                      </span>
                      <ChevronDown size={14} className={`text-zinc-400 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {showProfileMenu && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="absolute z-20 top-full mt-1 w-full bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden"
                        >
                          {store.resumeProfiles.map((profile) => (
                            <div
                              key={profile.id}
                              className={`flex items-center justify-between px-3 py-2.5 cursor-pointer transition-all text-sm ${
                                profile.id === store.activeProfileId ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-zinc-50 text-zinc-700'
                              }`}
                            >
                              <span
                                className="flex-1 truncate"
                                onClick={() => { store.setActiveProfileId(profile.id); setShowProfileMenu(false); }}
                              >{profile.name}</span>
                              {profile.id !== 'default' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); store.deleteResumeProfile(profile.id); }}
                                  className="text-zinc-400 hover:text-red-500 p-0.5 shrink-0"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                          ))}
                          {showNewProfileInput ? (
                            <div className="px-3 py-2 border-t border-zinc-100">
                              <div className="flex gap-1.5">
                                <input
                                  value={newProfileName}
                                  onChange={(e) => setNewProfileName(e.target.value)}
                                  placeholder="Profile name..."
                                  className="flex-1 px-2 py-1.5 text-sm rounded-lg border border-zinc-200 bg-zinc-50 outline-none focus:border-indigo-400 min-w-0"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && newProfileName.trim()) {
                                      store.addResumeProfile(newProfileName.trim(), '');
                                      setNewProfileName('');
                                      setShowNewProfileInput(false);
                                      setShowProfileMenu(false);
                                    }
                                  }}
                                />
                                <button
                                  onClick={() => {
                                    if (newProfileName.trim()) {
                                      store.addResumeProfile(newProfileName.trim(), '');
                                      setNewProfileName('');
                                      setShowNewProfileInput(false);
                                      setShowProfileMenu(false);
                                    }
                                  }}
                                  className="bg-indigo-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold shrink-0"
                                >Add</button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setShowNewProfileInput(true)}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-indigo-600 font-bold hover:bg-indigo-50 border-t border-zinc-100"
                            >
                              <Plus size={14} /> New Profile
                            </button>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
              
              {store.getActiveResume() ? (
                <div className="flex items-center justify-between bg-zinc-50 border border-zinc-200/80 rounded-xl p-4 group hover:border-indigo-300 transition-all duration-200">
                  <div className="flex items-center gap-4 overflow-hidden">
                    <div className="bg-indigo-100 p-2.5 rounded-xl text-indigo-600 shrink-0">
                      <FileUp size={20} strokeWidth={2.5} />
                    </div>
                    <div className="flex flex-col truncate">
                      <span className="text-sm text-zinc-800 font-bold truncate">{resumeFileName || "resume_parsed.pdf"}</span>
                      <span className="text-xs text-emerald-600 font-semibold mt-0.5">Parsed & Ready</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => { store.setUserResume(""); setResumeFileName(""); }}
                    className="text-zinc-400 hover:text-red-500 hover:bg-red-50 p-2.5 rounded-xl transition-colors"
                    title="Remove resume"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-zinc-200 hover:border-indigo-400 bg-zinc-50 hover:bg-indigo-50/30 rounded-xl p-8 text-center cursor-pointer transition-all duration-300 group"
                >
                  <input 
                    type="file" 
                    accept="application/pdf" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                  />
                  <div className="bg-white shadow-sm ring-1 ring-zinc-200 group-hover:ring-indigo-200 group-hover:shadow-md w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-all duration-300">
                    <Upload size={24} className="text-zinc-400 group-hover:text-indigo-600 transition-colors" />
                  </div>
                  <p className="text-sm font-bold text-zinc-700 group-hover:text-indigo-700 transition-colors">Upload PDF Resume</p>
                  <p className="text-xs text-zinc-500 mt-2 font-medium">All parsing happens locally in your browser.</p>
                </div>
              )}
            </section>

            {/* Recruiter Section & LPU Check */}
            <section className="bg-white rounded-2xl p-5 shadow-sm border border-zinc-200/80">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
                  <Building size={18} className="text-indigo-500" /> Target Contact
                </h2>
                {isExtension && (
                  <button 
                    onClick={extractLinkedInContext}
                    className="text-xs flex items-center gap-1.5 bg-[#0a66c2]/10 text-[#0a66c2] hover:bg-[#0a66c2]/20 font-bold px-3 py-1.5 rounded-lg transition-all shadow-sm active:scale-95"
                  >
                    <Link size={14} strokeWidth={2.5} /> Scrape Page
                  </button>
                )}
              </div>
              
              <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-1.5 flex gap-2 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-400/10 transition-all duration-300">
                <input 
                  type="text"
                  value={recruiterUrl}
                  onChange={(e) => setRecruiterUrl(e.target.value)}
                  placeholder="Paste Recruiter's LinkedIn URL..."
                  className="flex-1 px-3 py-2 text-sm bg-transparent outline-none placeholder:text-zinc-400 font-medium min-w-0"
                />
                <button
                  onClick={handleGenerateEmailGuesses}
                  disabled={!recruiterUrl}
                  className="bg-zinc-900 hover:bg-black text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shadow-sm shrink-0"
                >
                  Guess Email
                </button>
              </div>
              
              <AnimatePresence>
                {emailGuesses.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                    className="space-y-2"
                  >
                    <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Select Best Guess (Not Verified)</span>
                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto custom-scrollbar">
                      {emailGuesses.map((guess, idx) => (
                        <button
                          key={idx}
                          onClick={() => setRecruiterEmail(guess.email)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-all text-sm ${
                            recruiterEmail === guess.email
                              ? 'bg-indigo-50 border border-indigo-200 ring-2 ring-indigo-400/20'
                              : 'bg-zinc-50 border border-zinc-200/80 hover:bg-zinc-100'
                          }`}
                        >
                          <span className="font-bold text-zinc-800 select-all">{guess.email}</span>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            guess.confidence === 'high' ? 'bg-emerald-100 text-emerald-700' :
                            guess.confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
                            'bg-zinc-100 text-zinc-500'
                          }`}>{guess.confidence}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* LPU Alumni Toggle */}
              <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-orange-50 p-2 rounded-xl text-orange-500 shrink-0 border border-orange-100">
                    <GraduationCap size={18} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-zinc-800">LPU Alumni Connection</span>
                    <span className="text-[11px] text-zinc-500 font-medium">Tailor script for fellow LPU alumni</span>
                  </div>
                </div>
                <button 
                  onClick={() => setIsLpuAlumni(!isLpuAlumni)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${isLpuAlumni ? 'bg-orange-500' : 'bg-zinc-200'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${isLpuAlumni ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </section>

            {/* Job Description Section */}
            <section className="bg-white rounded-2xl p-5 shadow-sm border border-zinc-200/80 flex flex-col h-[320px]">
              <div className="flex items-center justify-between mb-4 shrink-0">
                <h2 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
                  <Briefcase size={18} className="text-indigo-500" /> Job Details
                </h2>
                {jobDescription && <CheckCircle2 size={16} className="text-emerald-500" />}
              </div>
              
              <div className="flex-1 flex flex-col bg-zinc-50 border border-zinc-200/80 rounded-xl overflow-hidden focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-400/10 transition-all duration-300">
                <input 
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Job Title & Company..."
                  className="w-full px-4 py-4 text-sm font-bold text-zinc-900 border-b border-zinc-200/80 bg-transparent outline-none placeholder:text-zinc-400 shrink-0"
                />
                <textarea 
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the full job description here. The AI will analyze this to perfectly tailor your outreach..."
                  className="w-full flex-1 p-4 text-sm text-zinc-700 bg-transparent outline-none resize-none custom-scrollbar placeholder:text-zinc-400 leading-relaxed"
                />
              </div>
            </section>
          </div>

          {/* Right Column: Output Generation & Result */}
          <div className="lg:col-span-7 space-y-6 flex flex-col h-full">
            
            {/* Output Controls */}
            <section className="bg-white rounded-2xl p-5 shadow-sm border border-zinc-200/80">
              <h2 className="text-sm font-bold text-zinc-800 flex items-center gap-2 mb-4">
                <Sparkles size={18} className="text-indigo-500" /> Generation Engine
              </h2>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-zinc-100/80 p-1.5 rounded-xl mb-5">
                {(Object.keys(GENERATION_LABELS) as GenerationType[]).map((type) => (
                  <button 
                    key={type}
                    onClick={() => setGenerationType(type)}
                    className={`py-2.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                      generationType === type 
                        ? "bg-white text-indigo-700 shadow-sm ring-1 ring-zinc-200/50" 
                        : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/80"
                    }`}
                  >
                    {GENERATION_LABELS[type]}
                  </button>
                ))}
              </div>

              <button 
                onClick={generateContent}
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-6 py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2.5 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/40 active:scale-[0.98]"
              >
                {loading ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                    <Sparkles size={18} className="text-white/90" />
                  </motion.div>
                ) : (
                  <Send size={18} className="text-white/90" />
                )}
                {loading ? "Crafting your masterpiece..." : `Generate ${GENERATION_LABELS[generationType]}`}
              </button>
            </section>

            {/* Result Area */}
            <AnimatePresence mode="wait">
              {result ? (
                <motion.section 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="flex-1 bg-white rounded-2xl shadow-sm border border-indigo-100 flex flex-col relative overflow-hidden min-h-[400px]"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />
                  
                  <div className="flex items-center justify-between p-4 border-b border-zinc-100 bg-indigo-50/30">
                    <h2 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                      <FileText size={16} className="text-indigo-600" /> Final Output
                    </h2>
                    <div className="flex items-center gap-2">
                      {isExtension && (
                        <button 
                          onClick={autoFillApplication}
                          disabled={isAutofilling}
                          className="text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 font-bold shadow-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-white border border-transparent hover:from-emerald-600 hover:to-teal-600 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                          {isAutofilling ? (
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                              <Wand2 size={14} strokeWidth={2.5} />
                            </motion.div>
                          ) : (
                            <Wand2 size={14} strokeWidth={2.5} />
                          )}
                          Autofill Form
                        </button>
                      )}
                      {(generationType === "referral" || generationType === "cold_mail" || generationType === "cover_letter") && (
                        <button 
                          onClick={openInEmail}
                          className="text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 font-bold shadow-sm bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300"
                        >
                          <Mail size={14} strokeWidth={2.5} /> Send in Gmail
                        </button>
                      )}
                      {generationType === "custom_cv" && (
                        <button 
                          onClick={downloadPDF}
                          className="text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 font-bold shadow-sm bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300"
                        >
                          <Download size={14} strokeWidth={2.5} /> Download PDF
                        </button>
                      )}
                      <button 
                        onClick={copyToClipboard}
                        className={`text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 font-bold shadow-sm ${
                          copied 
                            ? 'bg-emerald-500 text-white border-transparent' 
                            : 'bg-zinc-900 text-white border-transparent hover:bg-black'
                        }`}
                      >
                        {copied ? <CheckCircle2 size={14} strokeWidth={3} /> : <Copy size={14} strokeWidth={2.5} />}
                        {copied ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-white">
                    {(generationType === "custom_cv" || generationType === "match_analyzer") ? (
                      <div 
                        className="markdown-output text-sm leading-relaxed max-w-none"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(result) }} 
                      />
                    ) : (
                      <div className="whitespace-pre-wrap text-sm text-zinc-700 leading-relaxed font-sans max-w-none">
                        {result}
                      </div>
                    )}
                  </div>
                </motion.section>
              ) : (
                <motion.section 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 bg-zinc-100/50 rounded-2xl border border-dashed border-zinc-200 flex flex-col items-center justify-center p-8 text-center min-h-[400px]"
                >
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm border border-zinc-100 mb-4">
                    <Sparkles size={28} className="text-zinc-300" />
                  </div>
                  <h3 className="text-base font-bold text-zinc-700 mb-2">No Content Generated Yet</h3>
                  <p className="text-sm text-zinc-500 max-w-xs leading-relaxed">
                    Upload your resume, paste a job description, and hit generate to craft your tailored outreach.
                  </p>
                  <div className="flex items-center gap-2 mt-5 text-xs text-zinc-400 font-medium">
                    <span className="flex items-center gap-1"><FileUp size={14} /> Resume</span>
                    <ArrowRight size={12} />
                    <span className="flex items-center gap-1"><Briefcase size={14} /> Job</span>
                    <ArrowRight size={12} />
                    <span className="flex items-center gap-1"><Sparkles size={14} /> AI</span>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>
            
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-zinc-400 border-t border-zinc-100 bg-white/50">
        <p>ReferMe — 100% Free & Open Source AI Job Outreach. Your data stays in your browser.</p>
      </footer>
    </div>
  );
}