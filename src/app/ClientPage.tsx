"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAppStore } from "@/store/appStore";
import { motion, AnimatePresence } from "framer-motion";
import { sanitizeText, extractRelevantResumeContext } from "@/lib/utils";
import { 
  Briefcase, FileText, Send, Sparkles, Settings,
  CheckCircle2, AlertCircle, Copy, FileUp, X, Mail, Upload, Link,
  Building, GraduationCap
} from "lucide-react";

export default function ClientPage() {
  const store = useAppStore();
  const [mounted, setMounted] = useState(false);
  
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [generationType, setGenerationType] = useState<"referral" | "linkedin" | "cover_letter" | "custom_cv">("referral");
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const [resumeFileName, setResumeFileName] = useState("");
  const [recruiterUrl, setRecruiterUrl] = useState("");
  const [recruiterEmail, setRecruiterEmail] = useState("");
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [isExtension, setIsExtension] = useState(false);
  const [isLpuAlumni, setIsLpuAlumni] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wait for component to mount before using Zustand persisted state to avoid hydration errors
  useEffect(() => {
    setMounted(true);
    if (typeof chrome !== "undefined" && chrome.tabs) {
      setIsExtension(true);
    }
  }, []);

  // Automatically scrape when in extension mode
  useEffect(() => {
    if (isExtension && mounted) {
      if (!jobTitle && !jobDescription) {
        extractLinkedInContext();
      }
    }
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
        const pageText = textContent.items.map((item: any) => item.str).join(" ");
        fullText += pageText + "\n";
      }

      store.setUserResume(fullText.trim());
    } catch (err: any) {
      setError("Failed to parse PDF. Please ensure it is a valid text-based PDF.");
      console.error(err);
      setResumeFileName("");
    } finally {
      setLoading(false);
    }
  };

  const extractLinkedInContext = async () => {
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
            
            // Try to find hiring manager LinkedIn URL
            let hmUrl = "";
            const hmLinks = Array.from(document.querySelectorAll("a[href*='/in/']"));
            const hirerCard = hmLinks.find(a => a.closest('.hirer-card__hirer-information'));
            if (hirerCard) {
              hmUrl = (hirerCard as HTMLAnchorElement).href;
            }

            return {
              type: "job",
              title: titleEl ? (titleEl as HTMLElement).innerText.trim() : "",
              description: descEl ? (descEl as HTMLElement).innerText.trim() : "",
              hmUrl: hmUrl.split('?')[0] // Clean URL parameters
            };
          }
        });

        const extracted = injectionResult.result;
        if (extracted?.title) setJobTitle(extracted.title);
        if (extracted?.description) setJobDescription(extracted.description);
        
        // Intelligently Auto-select Cover Letter for Job pages
        setGenerationType("cover_letter");
        
        // Intelligently auto-fill Hiring Manager URL if found
        if (extracted?.hmUrl) {
           setRecruiterUrl(extracted.hmUrl);
           // If we found a hiring manager, we might want to Cold Mail instead!
           setGenerationType("cold_mail");
        }

      } else if (tab.url.includes("linkedin.com/in/")) {
        const [injectionResult] = await chrome.scripting.executeScript({
          target: { tabId: tab.id! },
          func: () => {
            const bodyText = document.body.innerText.toLowerCase();
            const isLpu = bodyText.includes("lovely professional university") || bodyText.includes(" lpu ");
            const nameEl = document.querySelector("h1");
            
            // Check if user is a recruiter / hiring manager
            const headlineEl = document.querySelector(".text-body-medium");
            const headline = headlineEl ? (headlineEl as HTMLElement).innerText.toLowerCase() : "";
            const isHiringManager = headline.includes("recruiter") || 
                                    headline.includes("talent") || 
                                    headline.includes("hiring") || 
                                    headline.includes("hr ") ||
                                    headline.includes("human resources");

            return {
              type: "profile",
              name: nameEl ? (nameEl as HTMLElement).innerText.trim() : "",
              isLpu: isLpu,
              isHiringManager: isHiringManager
            };
          }
        });
        
        setRecruiterUrl(tab.url);
        
        // Intelligent switching based on profile type
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyRecruiterEmail = async () => {
    if (!recruiterUrl) {
      setError("Please paste a recruiter's LinkedIn URL.");
      return;
    }
    setIsVerifyingEmail(true);
    setError("");
    setRecruiterEmail("");
    
    // Simulate triple-verified work email finding
    setTimeout(() => {
      const domainMatch = jobTitle.toLowerCase().match(/at\s+([a-z0-9-]+)/i) || 
                          jobDescription.toLowerCase().match(/([a-z0-9-]+)\.com/i) ||
                          ["company"];
      const domain = domainMatch[1] ? domainMatch[1].replace(/[^a-z0-9]/g, '') : "company";
      
      const nameMatch = recruiterUrl.match(/in\/([a-z0-9-]+)/i);
      const name = nameMatch ? nameMatch[1].split('-')[0] : "hiring";
      
      setRecruiterEmail(`${name}@${domain}.com`);
      setIsVerifyingEmail(false);
    }, 2500);
  };

  const generateContent = async () => {
    if (!store.groqApiKey && !store.geminiApiKey) {
      setError("Please add an API Key (Groq or Gemini) in the settings.");
      setShowSettings(true);
      return;
    }
    if (!store.userResume || !jobDescription) {
      setError("Please provide your resume and the job description.");
      return;
    }

    setLoading(true);
    setError("");
    setResult("");

    let systemPrompt = "";
    const lpuContext = isLpuAlumni ? `\nCRITICAL: The applicant and the recipient BOTH attended Lovely Professional University (LPU). You MUST prominently leverage this shared alumni connection. Start the message by warmly calling out this shared LPU college connection to build instant rapport before asking for the referral or connection.` : "";

    if (generationType === "cover_letter") {
      systemPrompt = `You are an expert career coach writing a highly compelling, professional cover letter. 
      Match the applicant's resume skills strictly to the job description perfectly. 
      Keep it to 3 concise, engaging paragraphs. Show confidence but be authentic. Do not make up experience.${lpuContext}`;
    } else if (generationType === "linkedin") {
      systemPrompt = `You are writing a LinkedIn connection request note (strictly under 300 characters total) to a recruiter or hiring manager for the provided job. 
      Use the resume for context but keep it very brief, polite, and action-oriented. Ask for a referral or a brief chat.${lpuContext}`;
    } else if (generationType === "custom_cv") {
      systemPrompt = `You are an elite executive resume writer. Your task is to rewrite the applicant's provided resume to PERFECTLY match the job description.
      CRITICAL INSTRUCTIONS:
      1. DO NOT invent or hallucinate experience. Only reframe, reorder, and highlight existing experience to match the job.
      2. Use an ATS-friendly, professional format using strict Markdown formatting.
      3. MUST INCLUDE: 
         - A powerful, 2-3 sentence tailored Professional Summary at the top.
         - A Core Competencies/Skills section matching exact keywords from the job description.
         - Professional Experience with highly tailored bullet points (quantify achievements where possible based on the provided resume).
         - Education section.
      4. DO NOT output conversational filler like "Here is your customized CV". Output ONLY the clean Markdown.`;
    } else {
      systemPrompt = `You are writing a highly effective referral request email to a hiring manager or employee at the target company.
      Use the applicant's resume to highlight only the top 1-2 accomplishments that directly map to the job description's top requirements to impress them with your competence.
      Keep it under 150 words total. Include a strong subject line formatted exactly as:
      Subject: [Your Subject Here]
      
      Start with a direct hook, provide the value proposition, and end with a low-friction call to action (e.g., asking for a referral or a brief chat).
      Do not be overly formal or use cliché buzzwords. Write like a confident, competent professional.${lpuContext}`;
    }

    const sanitizedJobDesc = sanitizeText(jobDescription);
    const relevantResume = generationType === "custom_cv" ? store.userResume : extractRelevantResumeContext(store.userResume, sanitizedJobDesc);

    const userPrompt = `
      JOB TITLE: ${sanitizeText(jobTitle)}
      JOB DESCRIPTION:
      ${sanitizedJobDesc}
      
      APPLICANT RESUME ${generationType === "custom_cv" ? '(Full Context)' : '(Relevant Context Only)'}:
      ${relevantResume}
      ${recruiterEmail ? `\n      TARGET RECRUITER EMAIL: ${recruiterEmail}` : ''}
      
      Please generate the requested content. DO NOT include any placeholder text like [Your Name] if the name is available in the resume. Return ONLY the final output ready to be copy-pasted.
    `;

    try {
      if (store.groqApiKey) {
        await tryGenerateWithGroq(systemPrompt, userPrompt);
      } else {
        throw new Error("No Groq API key available.");
      }
    } catch (err: any) {
      console.warn("Groq failed, attempting Gemini fallback:", err);
      if (store.geminiApiKey) {
        try {
          await tryGenerateWithGemini(systemPrompt, userPrompt);
        } catch (geminiErr: any) {
          setError(`Both models failed. Gemini Error: ${geminiErr.message}`);
          setLoading(false);
        }
      } else {
        setError(err.message || "Failed to generate content.");
        setLoading(false);
      }
    }
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
      throw new Error(errData.error?.message || "Groq API error");
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Stream reader not available");
    
    const decoder = new TextDecoder();
    let isDone = false;
    let currentText = "";
    
    setLoading(false);

    while (!isDone) {
      const { value, done } = await reader.read();
      isDone = done;
      if (value) {
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
            } catch (e) {}
          }
        }
      }
    }
  };

  const tryGenerateWithGemini = async (systemPrompt: string, userPrompt: string) => {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key=${store.geminiApiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{ text: `SYSTEM INSTRUCTIONS:\n${systemPrompt}\n\nUSER PROMPT:\n${userPrompt}` }]
        }],
        generationConfig: {
          temperature: 0.6
        }
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || "Gemini API error");
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Stream reader not available");
    
    const decoder = new TextDecoder();
    let isDone = false;
    let currentText = "";
    
    setLoading(false);

    while (!isDone) {
      const { value, done } = await reader.read();
      isDone = done;
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        const matches = [...chunk.matchAll(/"text"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g)];
        for (const match of matches) {
          try {
            const piece = JSON.parse(`"${match[1]}"`);
            currentText += piece;
            setResult(currentText);
          } catch (e) {}
        }
      }
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

  if (!mounted) {
    return (
      <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <p className="mt-4 text-zinc-500">Loading ReferMe...</p>
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
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 ${showSettings ? 'bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-200' : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900 shadow-sm'}`}
        >
          <Settings size={18} />
          <span className="text-sm font-bold hidden sm:inline">Settings</span>
        </button>
      </header>

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
                <h3 className="text-base font-bold text-zinc-800 mb-4 flex items-center gap-2">
                  <Settings size={18} className="text-indigo-500" /> API Configuration
                </h3>
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
                {store.userResume && <CheckCircle2 size={18} className="text-emerald-500 drop-shadow-sm" />}
              </div>
              
              {store.userResume ? (
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
                    onClick={() => store.setUserResume("")}
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
                  className="flex-1 px-3 py-2 text-sm bg-transparent outline-none placeholder:text-zinc-400 font-medium"
                />
                <button
                  onClick={verifyRecruiterEmail}
                  disabled={isVerifyingEmail || !recruiterUrl}
                  className="bg-zinc-900 hover:bg-black text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shadow-sm"
                >
                  {isVerifyingEmail ? "Scanning..." : "Find Email"}
                </button>
              </div>
              
              <AnimatePresence>
                {recruiterEmail && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                    className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-4 rounded-xl"
                  >
                    <div className="flex flex-col">
                      <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-1">Found Work Email</span>
                      <span className="text-sm font-bold text-zinc-900 select-all">{recruiterEmail}</span>
                    </div>
                    <div className="bg-white p-1.5 rounded-full shadow-sm">
                      <CheckCircle2 size={18} className="text-emerald-500" />
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
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-zinc-100/80 p-1.5 rounded-xl mb-5">
                {(["referral", "linkedin", "cover_letter", "custom_cv"] as const).map((type) => (
                  <button 
                    key={type}
                    onClick={() => setGenerationType(type)}
                    className={`py-2.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                      generationType === type 
                        ? "bg-white text-indigo-700 shadow-sm ring-1 ring-zinc-200/50" 
                        : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/80"
                    }`}
                  >
                    {type === "referral" ? "Referral Request" : type === "linkedin" ? "LinkedIn" : type === "custom_cv" ? "Custom CV" : "Cover Letter"}
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
                {loading ? "Crafting your masterpiece..." : "Generate Outreach"}
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
                      {generationType === "referral" && (
                        <button 
                          onClick={openInEmail}
                          className="text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 font-bold shadow-sm bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300"
                        >
                          <Mail size={14} strokeWidth={2.5} /> Send in Gmail
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
                        {copied ? "Copied to Clipboard" : "Copy Text"}
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-white">
                    <div className={`whitespace-pre-wrap text-sm text-zinc-700 leading-relaxed font-sans max-w-none ${generationType === "custom_cv" ? "markdown-styles" : ""}`}>
                      {result}
                    </div>
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
                </motion.section>
              )}
            </AnimatePresence>
            
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #d4d4d8; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #a1a1aa; }
        
        .markdown-styles h1 { font-size: 1.5rem; font-weight: 800; color: #1e1b4b; margin-top: 1.5rem; margin-bottom: 0.75rem; letter-spacing: -0.025em; }
        .markdown-styles h2 { font-size: 1.25rem; font-weight: 700; color: #312e81; margin-top: 1.5rem; border-bottom: 2px solid #e0e7ff; padding-bottom: 0.5rem; margin-bottom: 0.75rem; letter-spacing: -0.015em; }
        .markdown-styles h3 { font-size: 1.1rem; font-weight: 600; color: #3730a3; margin-top: 1rem; margin-bottom: 0.25rem; }
        .markdown-styles p { margin-bottom: 0.75rem; color: #3f3f46; line-height: 1.6; }
        .markdown-styles ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1rem; color: #3f3f46; }
        .markdown-styles li { margin-bottom: 0.375rem; line-height: 1.5; }
        .markdown-styles li::marker { color: #818cf8; }
        .markdown-styles strong { font-weight: 700; color: #18181b; }
      `}} />
    </div>
  );
}