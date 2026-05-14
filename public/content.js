// ReferMe / JobRight Clone — Enhanced Content Script v2.0
// Supports: LinkedIn, Greenhouse, Lever, Workday, Indeed, Glassdoor, SmartRecruiters, AshbyHQ, iCIMS

(function () {
  'use strict';

  let agentContainer = null;
  let agentIframe = null;
  let isOpen = false;
  let atsScoreBadge = null;
  let lastUrl = location.href;
  let initialized = false;

  // ─── Platform Detectors ────────────────────────────────────────
  const PLATFORMS = {
    linkedin_job: (url) => url.includes("linkedin.com/jobs"),
    linkedin_apply: (url) => url.includes("linkedin.com/jobs") && (url.includes("/apply") || document.querySelector('[data-test="applicant-input-form"]') !== null),
    linkedin_profile: (url) => url.includes("linkedin.com/in/"),
    greenhouse: (url) => url.includes("greenhouse.io") || url.includes("boards.greenhouse.io"),
    lever: (url) => url.includes("jobs.lever.co"),
    workday: (url) => url.includes("myworkdayjobs.com") || url.includes("workday.com"),
    indeed: (url) => url.includes("indeed.com"),
    glassdoor: (url) => url.includes("glassdoor.com"),
    smartrecruiters: (url) => url.includes("smartrecruiters.com"),
    ashby: (url) => url.includes("jobs.ashbyhq.com"),
    icims: (url) => url.includes("icims.com"),
    rippling: (url) => url.includes("app.rippling.com"),
    generic_apply: (url) => {
      const text = document.body?.innerText?.toLowerCase() || "";
      return (text.includes("apply for this position") || text.includes("submit application") || text.includes("apply now"))
        && (document.querySelector('input[name*="first"], input[name*="fname"], input[id*="firstName"]') !== null);
    },
  };

  function detectPlatform() {
    const url = window.location.href.toLowerCase();
    for (const [name, fn] of Object.entries(PLATFORMS)) {
      try { if (fn(url)) return name; } catch { /* ignore */ }
    }
    return null;
  }

  function isJobPage() {
    return detectPlatform() !== null;
  }

  // ─── Job Data Extractors ────────────────────────────────────────
  const EXTRACTORS = {
    linkedin_job: () => {
      const titleEl = document.querySelector(".job-details-jobs-unified-top-card__job-title h1, .jobs-unified-top-card__job-title, h1.topcard__title");
      const companyEl = document.querySelector(".job-details-jobs-unified-top-card__company-name a, .jobs-unified-top-card__company-name, .topcard__org-name-link");
      const locationEl = document.querySelector(".job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet");
      const descEl = document.querySelector("#job-details, .jobs-description__content, .description__text");
      const hmLinks = Array.from(document.querySelectorAll("a[href*='/in/']"));
      const hirerCard = hmLinks.find(a => a.closest(".hirer-card__hirer-information"));
      return {
        jobTitle: titleEl?.innerText?.trim() || document.title.split(" | ")[0],
        company: companyEl?.innerText?.trim() || "",
        location: locationEl?.innerText?.trim() || "",
        jobDescription: descEl?.innerText?.trim() || "",
        hmUrl: hirerCard ? hirerCard.href.split("?")[0] : "",
        platform: "LinkedIn",
      };
    },
    greenhouse: () => {
      const titleEl = document.querySelector(".app-title, h1.posting-headline");
      const companyEl = document.querySelector(".company-name, .location");
      const descEl = document.querySelector("#content, .posting-description, .section-content");
      return {
        jobTitle: titleEl?.innerText?.trim() || document.title.split(" - ")[0],
        company: companyEl?.innerText?.trim() || window.location.hostname,
        jobDescription: descEl?.innerText?.trim() || "",
        platform: "Greenhouse",
      };
    },
    lever: () => {
      const titleEl = document.querySelector(".posting-header h2, h2");
      const companyEl = document.querySelector(".posting-header .posting-department");
      const descEl = document.querySelector(".posting-description");
      return {
        jobTitle: titleEl?.innerText?.trim() || document.title,
        company: document.title.split(" - ").pop()?.trim() || window.location.hostname,
        jobDescription: descEl?.innerText?.trim() || "",
        platform: "Lever",
      };
    },
    workday: () => {
      const titleEl = document.querySelector("[data-automation-id='jobPostingHeader'], h1");
      const descEl = document.querySelector("[data-automation-id='jobPostingDescription'], .job-description");
      return {
        jobTitle: titleEl?.innerText?.trim() || document.title.split(" - ")[0],
        company: document.title.split(" - ").pop()?.trim() || window.location.hostname,
        jobDescription: descEl?.innerText?.trim() || "",
        platform: "Workday",
      };
    },
    indeed: () => {
      const titleEl = document.querySelector('[data-testid="jobsearch-JobInfoHeader-title"], h1.jobsearch-JobInfoHeader-title');
      const companyEl = document.querySelector('[data-testid="inlineHeader-companyName"], .icl-u-lg-mr--sm.icl-u-xs-mr--xs');
      const descEl = document.querySelector('#jobDescriptionText, .jobsearch-jobDescriptionText');
      return {
        jobTitle: titleEl?.innerText?.trim() || document.title,
        company: companyEl?.innerText?.trim() || "",
        jobDescription: descEl?.innerText?.trim() || "",
        platform: "Indeed",
      };
    },
    generic_apply: () => ({
      jobTitle: document.title.split("-")[0].trim(),
      company: window.location.hostname.replace("www.", "").replace("jobs.", "").split(".")[0],
      jobDescription: document.body.innerText.substring(0, 3000),
      platform: "Generic ATS",
    }),
  };

  function extractJobData() {
    const platform = detectPlatform();
    if (!platform) return null;
    const extractor = EXTRACTORS[platform] || EXTRACTORS.generic_apply;
    try { return extractor(); } catch { return null; }
  }

  // ─── Smart Form Autofill ────────────────────────────────────────
  function smartSetValue(input, value) {
    if (!value || !input) return;
    // Use native setter to bypass React's synthetic event system
    const proto = input.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(input, value);
    } else {
      input.value = value;
    }
    // Fire all events React and other frameworks listen to
    ['input', 'change', 'blur', 'keyup', 'keydown'].forEach(evt =>
      input.dispatchEvent(new Event(evt, { bubbles: true, cancelable: true }))
    );
    // Also fire a React-specific synthetic input event
    try {
      const reactInputEvent = new InputEvent('input', { bubbles: true, cancelable: true, data: value });
      input.dispatchEvent(reactInputEvent);
    } catch { /* ignore */ }
    input.style.transition = 'background-color 0.4s';
    input.style.backgroundColor = '#e0e7ff';
    setTimeout(() => { input.style.backgroundColor = ''; }, 1500);
  }

  function getFieldIdentifier(input) {
    const label = input.labels?.[0]?.innerText?.toLowerCase()
      || document.querySelector(`label[for="${input.id}"]`)?.innerText?.toLowerCase()
      || '';
    const attrs = [input.name, input.id, input.placeholder, input.getAttribute('aria-label'), input.getAttribute('data-automation-id')]
      .filter(Boolean).join(' ').toLowerCase();
    return label + ' ' + attrs;
  }

  function matchField(ident, patterns) {
    return patterns.some(p => ident.includes(p));
  }

  function autoFillForm(data) {
    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), textarea, select');
    let filled = 0;

    inputs.forEach(input => {
      const ident = getFieldIdentifier(input);

      const fieldMap = [
        { patterns: ['first name', 'firstname', 'fname', 'given name'], value: data.firstName },
        { patterns: ['last name', 'lastname', 'lname', 'surname', 'family name'], value: data.lastName },
        { patterns: ['full name', 'your name', 'candidate name'], value: data.fullName, exclude: ['company', 'first', 'last'] },
        { patterns: ['email', 'e-mail', 'email address'], value: data.email },
        { patterns: ['phone', 'mobile', 'cell', 'telephone'], value: data.phone },
        { patterns: ['linkedin', 'linkedin url', 'linkedin profile'], value: data.linkedin },
        { patterns: ['github', 'portfolio', 'website', 'personal url', 'personal site'], value: data.website },
        { patterns: ['city', 'current city'], value: data.city },
        { patterns: ['state', 'province'], value: data.state },
        { patterns: ['country'], value: data.country },
        { patterns: ['address'], value: data.address, exclude: ['email'] },
        { patterns: ['zip', 'postal', 'postcode'], value: data.zip },
        { patterns: ['salary', 'expected salary', 'compensation'], value: data.expectedSalary },
        { patterns: ['cover letter', 'additional information', 'why do you want', 'tell us about yourself'], value: data.coverLetter, isTextarea: true },
        { patterns: ['summary', 'professional summary', 'about yourself'], value: data.summary },
        { patterns: ['years of experience', 'how many years'], value: data.yearsOfExperience },
      ];

      for (const { patterns, value, exclude, isTextarea } of fieldMap) {
        if (!value) continue;
        if (isTextarea && input.tagName.toLowerCase() !== 'textarea') continue;
        if (matchField(ident, patterns) && (!exclude || !exclude.some(e => ident.includes(e)))) {
          if (!input.value || input.value.trim() === '') {
            smartSetValue(input, value);
            filled++;
            break;
          }
        }
      }
    });

    // Handle select dropdowns (work authorization, job type, etc.)
    document.querySelectorAll('select').forEach(select => {
      const ident = getFieldIdentifier(select);
      if (matchField(ident, ['authorized', 'work authorization', 'legally authorized']) && data.workAuthorized) {
        const opt = Array.from(select.options).find(o => o.text.toLowerCase().includes('yes') || o.text.toLowerCase().includes('authorized'));
        if (opt) { select.value = opt.value; select.dispatchEvent(new Event('change', { bubbles: true })); }
      }
    });

    showToast(`✓ Autofilled ${filled} field${filled !== 1 ? 's' : ''}`);

    // Detect remaining unfilled labeled fields and ask the user once
    setTimeout(() => detectUnknownFields(), 600);
  }

  async function detectUnknownFields() {
    // Get previously answered custom fields from storage
    const stored = await chrome.storage.local.get(['referme-custom-fields']);
    const customFields = stored['referme-custom-fields'] || {};

    const unknownFields = [];
    const allInputs = document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]), textarea'
    );

    allInputs.forEach(input => {
      if (input.value && input.value.trim()) return; // Already filled
      const ident = getFieldIdentifier(input);
      if (!ident.trim()) return; // No label = skip

      const knownPatterns = [
        'first name', 'last name', 'email', 'phone', 'linkedin', 'github',
        'website', 'city', 'state', 'country', 'address', 'zip', 'postal',
        'salary', 'cover letter', 'summary', 'years', 'experience', 'authorized',
        'fullname', 'full name', 'fname', 'lname', 'firstname', 'lastname',
      ];
      const isKnown = knownPatterns.some(p => ident.includes(p));
      if (isKnown) return;

      // If we have a saved answer, fill it automatically
      const savedAnswer = customFields[ident.trim().slice(0, 80)];
      if (savedAnswer) {
        smartSetValue(input, savedAnswer);
        return;
      }

      const labelText = (input.labels?.[0]?.innerText || document.querySelector(`label[for="${input.id}"]`)?.innerText || ident).trim();
      if (labelText && labelText.length > 3 && labelText.length < 150) {
        unknownFields.push({ label: labelText.slice(0, 100), id: input.id || ident.slice(0, 40) });
      }
    });

    if (unknownFields.length > 0 && agentIframe?.contentWindow) {
      agentIframe.contentWindow.postMessage({ type: 'REFERME_UNKNOWN_FIELDS', fields: unknownFields.slice(0, 8) }, '*');
    }
  }

  // ─── Toast Notification ─────────────────────────────────────────
  function showToast(message, type = 'success') {
    const existing = document.getElementById('referme-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'referme-toast';
    toast.style.cssText = `
      position: fixed; bottom: 24px; right: 24px; z-index: 999999;
      background: ${type === 'success' ? '#10b981' : '#ef4444'};
      color: white; padding: 12px 20px; border-radius: 12px;
      font-family: -apple-system, sans-serif; font-size: 13px; font-weight: 600;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2); transform: translateY(0);
      transition: all 0.3s ease; cursor: pointer; user-select: none;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    toast.addEventListener('click', () => toast.remove());
    setTimeout(() => toast.remove(), 3000);
  }

  // ─── ATS Score Badge ────────────────────────────────────────────
  async function injectATSBadge(jobData) {
    if (!jobData?.jobDescription || !jobData?.jobTitle) return;

    // Get resume from chrome.storage
    const stored = await chrome.storage.local.get(['referme-storage']);
    const parsed = JSON.parse(stored['referme-storage'] || '{}');
    const resume = parsed?.state?.resumeProfiles?.[0]?.content || parsed?.state?.userResume || '';
    if (!resume) return;

    // Simple keyword matching for score
    const jdWords = new Set(
      (jobData.jobDescription.toLowerCase().match(/\b[a-z]{4,}\b/g) || [])
        .filter(w => !['with', 'that', 'from', 'your', 'will', 'have', 'this', 'they', 'been', 'were', 'more'].includes(w))
    );
    const resumeText = resume.toLowerCase();
    let matched = 0;
    jdWords.forEach(w => { if (resumeText.includes(w)) matched++; });
    const score = jdWords.size > 0 ? Math.min(100, Math.round((matched / jdWords.size) * 100 * 1.4)) : 0;

    // Remove old badge
    document.getElementById('referme-ats-badge')?.remove();

    const badge = document.createElement('div');
    badge.id = 'referme-ats-badge';
    const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
    badge.style.cssText = `
      position: fixed; top: 80px; right: 16px; z-index: 99998;
      background: white; border: 2px solid ${color}; border-radius: 16px;
      padding: 10px 16px; font-family: -apple-system, sans-serif;
      box-shadow: 0 4px 20px rgba(0,0,0,0.12); cursor: pointer;
      display: flex; align-items: center; gap: 10px;
      transition: all 0.2s ease;
    `;
    badge.innerHTML = `
      <div style="text-align:center">
        <div style="font-size:20px;font-weight:900;color:${color};line-height:1">${score}</div>
        <div style="font-size:9px;color:#71717a;font-weight:700;letter-spacing:0.05em">ATS</div>
      </div>
      <div>
        <div style="font-size:11px;font-weight:800;color:#18181b">Resume Match</div>
        <div style="font-size:10px;color:#71717a">${matched}/${jdWords.size} keywords</div>
      </div>
    `;
    badge.addEventListener('mouseenter', () => { badge.style.transform = 'scale(1.03)'; badge.style.boxShadow = '0 8px 30px rgba(0,0,0,0.15)'; });
    badge.addEventListener('mouseleave', () => { badge.style.transform = 'scale(1)'; badge.style.boxShadow = '0 4px 20px rgba(0,0,0,0.12)'; });
    badge.addEventListener('click', () => toggleAgent(true));
    document.body.appendChild(badge);
    atsScoreBadge = badge;
  }

  // ─── Save to Tracker Button ─────────────────────────────────────
  function injectSaveButton(jobData) {
    document.getElementById('referme-save-btn')?.remove();
    if (!jobData?.jobTitle) return;

    const btn = document.createElement('button');
    btn.id = 'referme-save-btn';
    btn.style.cssText = `
      position: fixed; bottom: 24px; left: 24px; z-index: 99998;
      background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white;
      border: none; border-radius: 14px; padding: 10px 18px;
      font-family: -apple-system, sans-serif; font-size: 12px; font-weight: 700;
      cursor: pointer; display: flex; align-items: center; gap: 8px;
      box-shadow: 0 4px 20px rgba(79,70,229,0.35); transition: all 0.2s ease;
      user-select: none;
    `;
    btn.innerHTML = `<span style="font-size:16px">📌</span> Save to Tracker`;
    btn.addEventListener('mouseenter', () => { btn.style.transform = 'translateY(-2px)'; btn.style.boxShadow = '0 8px 30px rgba(79,70,229,0.45)'; });
    btn.addEventListener('mouseleave', () => { btn.style.transform = 'none'; btn.style.boxShadow = '0 4px 20px rgba(79,70,229,0.35)'; });
    btn.addEventListener('click', async () => {
      const saved = await chrome.storage.local.get(['jobright-dashboard']);
      let dashboard = { applications: [], contacts: [] };
      try { dashboard = JSON.parse(saved['jobright-dashboard'] || '{}'); } catch { /* use defaults */ }
      if (!Array.isArray(dashboard.applications)) dashboard.applications = [];

      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      const newApp = {
        id, jobTitle: jobData.jobTitle, company: jobData.company || '',
        location: jobData.location || '', jobUrl: window.location.href,
        jobDescription: jobData.jobDescription || '', status: 'saved',
        savedDate: Date.now(), lastUpdated: Date.now(),
        interviews: [], notes: '', tags: [],
        source: jobData.platform || detectPlatform() || 'browser',
        priority: 'medium',
      };

      dashboard.applications.unshift(newApp);
      await chrome.storage.local.set({ 'jobright-dashboard': JSON.stringify(dashboard) });
      showToast(`📌 Saved "${jobData.jobTitle}" to Job Tracker!`);
      btn.innerHTML = `<span style="font-size:16px">✅</span> Saved!`;
      btn.style.background = '#10b981';
      setTimeout(() => {
        btn.innerHTML = `<span style="font-size:16px">📌</span> Save to Tracker`;
        btn.style.background = 'linear-gradient(135deg, #4f46e5, #7c3aed)';
      }, 3000);
    });
    document.body.appendChild(btn);
  }

  // ─── Agent UI (Iframe Popup) ─────────────────────────────────────
  function initAgent() {
    if (agentContainer || !isJobPage()) return;

    // Inject styles
    if (!document.getElementById('referme-styles')) {
      const style = document.createElement('style');
      style.id = 'referme-styles';
      style.textContent = `
        #referme-agent-container {
          position: fixed; bottom: 80px; right: 16px; z-index: 99999;
          display: flex; flex-direction: column; align-items: flex-end; gap: 12px;
        }
        #referme-agent-toggle {
          width: 52px; height: 52px; background: linear-gradient(135deg, #4f46e5, #7c3aed);
          border-radius: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center;
          font-size: 22px; box-shadow: 0 4px 20px rgba(79,70,229,0.4);
          transition: all 0.2s ease; user-select: none;
        }
        #referme-agent-toggle:hover { transform: scale(1.08); box-shadow: 0 8px 32px rgba(79,70,229,0.5); }
        #referme-agent-iframe {
          width: 420px; height: 600px; border: none; border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.25); display: none;
          background: white; transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1);
          transform: scale(0.9) translateY(20px); opacity: 0;
        }
        #referme-agent-container.open #referme-agent-iframe {
          display: block; transform: scale(1) translateY(0); opacity: 1;
        }
        @media (max-width: 480px) {
          #referme-agent-iframe { width: calc(100vw - 32px); height: 80vh; }
        }
      `;
      document.head.appendChild(style);
    }

    agentContainer = document.createElement('div');
    agentContainer.id = 'referme-agent-container';

    const toggle = document.createElement('div');
    toggle.id = 'referme-agent-toggle';
    toggle.title = 'Open ReferMe AI Agent';
    toggle.innerHTML = '✨';
    toggle.onclick = () => toggleAgent();

    agentIframe = document.createElement('iframe');
    agentIframe.id = 'referme-agent-iframe';
    agentIframe.src = chrome.runtime.getURL('popup/index.html');
    agentIframe.allow = 'clipboard-write';

    agentContainer.appendChild(agentIframe);
    agentContainer.appendChild(toggle);
    document.body.appendChild(agentContainer);

    setTimeout(() => {
      toggleAgent(true);
      setTimeout(() => sendJobData(), 1200);
    }, 800);
  }

  function toggleAgent(forceOpen = null) {
    isOpen = forceOpen !== null ? forceOpen : !isOpen;
    if (isOpen) {
      agentContainer?.classList.add('open');
      sendJobData();
    } else {
      agentContainer?.classList.remove('open');
    }
  }

  function sendJobData() {
    if (!agentIframe?.contentWindow) return;
    const data = extractJobData();
    if (data) {
      agentIframe.contentWindow.postMessage({ type: 'REFERME_JOB_DATA', ...data }, '*');
    }
  }

  // ─── Main Init ───────────────────────────────────────────────────
  async function init() {
    if (initialized) return;
    initialized = true;

    const platform = detectPlatform();
    if (!platform) return;

    const jobData = extractJobData();

    // Inject ATS badge on job listing pages
    if (['linkedin_job', 'greenhouse', 'lever', 'workday', 'indeed', 'glassdoor', 'ashby'].includes(platform)) {
      if (jobData) {
        await injectATSBadge(jobData);
        injectSaveButton(jobData);
      }
    }

    // Init the extension popup on apply pages
    initAgent();
  }

  // ─── Message Listener ────────────────────────────────────────────
  window.addEventListener('message', (event) => {
    if (!event.data) return;
    if (event.data.type === 'REFERME_AUTOFILL') {
      autoFillForm(event.data.payload);
    }
    if (event.data.type === 'REFERME_CLOSE') {
      toggleAgent(false);
    }
    if (event.data.type === 'REFERME_CUSTOM_FIELDS') {
      const answers = event.data.answers || {};
      // Save answers to storage for future autofill
      chrome.storage.local.get(['referme-custom-fields'], ({ 'referme-custom-fields': existing = {} }) => {
        const merged = { ...existing, ...answers };
        chrome.storage.local.set({ 'referme-custom-fields': merged });
      });
      // Fill the fields now
      const allInputs = document.querySelectorAll(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea'
      );
      allInputs.forEach(input => {
        const ident = getFieldIdentifier(input);
        const answer = answers[input.id] || answers[ident.trim().slice(0, 40)];
        if (answer && (!input.value || !input.value.trim())) {
          smartSetValue(input, answer);
        }
      });
      showToast(`✓ Saved ${Object.keys(answers).length} custom answer${Object.keys(answers).length !== 1 ? 's' : ''}`);
    }
  });

  // ─── SPA Navigation ─────────────────────────────────────────────
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      initialized = false;
      agentContainer = null;
      agentIframe = null;
      atsScoreBadge = null;
      document.getElementById('referme-ats-badge')?.remove();
      document.getElementById('referme-save-btn')?.remove();
      setTimeout(init, 500);
    }
  }).observe(document.documentElement, { subtree: true, childList: true });

  // ─── Bootstrap ──────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 500));
  } else {
    setTimeout(init, 500);
  }

})();
