// ReferMe v2 — Content Script
// Runs on every web page. Detects job pages, extracts context, autofills
// applications, scores resume match, and bridges the side-panel iframe.
//
// Listens on BOTH chrome.runtime.onMessage (toolbar popup, dashboard,
// service worker) AND window.message (side-panel iframe). v1 only
// listened on window.message which is why toolbar-popup autofill was
// silently a no-op.

(function () {
  'use strict';

  // ────────────────────────────────────────────────────────────────────
  // Module-level state
  // ────────────────────────────────────────────────────────────────────
  let agentContainer = null;
  let agentIframe = null;
  let agentToggle = null;
  let isPanelOpen = false;
  let lastUrl = location.href;
  let initialized = false;

  // ────────────────────────────────────────────────────────────────────
  // Platform detection
  // ────────────────────────────────────────────────────────────────────
  const APPLY_PLATFORMS = {
    linkedin_apply: (url) =>
      url.includes('linkedin.com/jobs') &&
      (url.includes('/apply') ||
        document.querySelector('[data-test="applicant-input-form"]') !== null),
    greenhouse: (url) =>
      url.includes('greenhouse.io') || url.includes('boards.greenhouse.io'),
    lever: (url) => url.includes('jobs.lever.co'),
    workday: (url) =>
      url.includes('myworkdayjobs.com') || url.includes('workday.com'),
    smartrecruiters: (url) => url.includes('smartrecruiters.com'),
    ashby: (url) => url.includes('jobs.ashbyhq.com'),
    icims: (url) => url.includes('icims.com'),
    rippling: (url) => url.includes('app.rippling.com'),
    bamboo: (url) => url.includes('bamboohr.com'),
    jobvite: (url) => url.includes('jobvite.com'),
    generic_apply: (url) => {
      void url;
      const text = (document.body && document.body.innerText) || '';
      const lower = text.toLowerCase();
      const hint =
        lower.includes('apply for this position') ||
        lower.includes('submit application') ||
        lower.includes('apply now');
      const formish = document.querySelector(
        'input[name*="first" i], input[name*="fname" i], input[id*="firstName" i]'
      );
      return hint && !!formish;
    },
  };

  const LISTING_PLATFORMS = {
    linkedin_job: (url) => url.includes('linkedin.com/jobs'),
    indeed: (url) => url.includes('indeed.com'),
    glassdoor: (url) => url.includes('glassdoor.com'),
  };

  function detectPlatform() {
    const url = location.href.toLowerCase();
    for (const [name, fn] of Object.entries(APPLY_PLATFORMS)) {
      try {
        if (fn(url)) return { name, kind: 'apply' };
      } catch (_) {}
    }
    for (const [name, fn] of Object.entries(LISTING_PLATFORMS)) {
      try {
        if (fn(url)) return { name, kind: 'listing' };
      } catch (_) {}
    }
    return null;
  }

  // ────────────────────────────────────────────────────────────────────
  // Job extractors
  // ────────────────────────────────────────────────────────────────────
  const EXTRACTORS = {
    linkedin_job: () => {
      const titleEl = document.querySelector(
        '.job-details-jobs-unified-top-card__job-title h1, .jobs-unified-top-card__job-title, h1.topcard__title'
      );
      const companyEl = document.querySelector(
        '.job-details-jobs-unified-top-card__company-name a, .jobs-unified-top-card__company-name, .topcard__org-name-link'
      );
      const locationEl = document.querySelector(
        '.job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet'
      );
      const descEl = document.querySelector(
        '#job-details, .jobs-description__content, .description__text'
      );
      const hmLinks = Array.from(document.querySelectorAll('a[href*="/in/"]'));
      const hirerCard = hmLinks.find((a) =>
        a.closest('.hirer-card__hirer-information')
      );
      return {
        jobTitle: textOf(titleEl) || document.title.split(' | ')[0],
        company: textOf(companyEl),
        location: textOf(locationEl),
        jobDescription: textOf(descEl),
        hmUrl: hirerCard ? hirerCard.href.split('?')[0] : '',
        platform: 'LinkedIn',
      };
    },
    greenhouse: () => ({
      jobTitle:
        textOf(document.querySelector('.app-title, h1.posting-headline')) ||
        document.title.split(' - ')[0],
      company:
        textOf(document.querySelector('.company-name, .location')) ||
        location.hostname,
      jobDescription: textOf(
        document.querySelector('#content, .posting-description, .section-content')
      ),
      platform: 'Greenhouse',
    }),
    lever: () => ({
      jobTitle:
        textOf(document.querySelector('.posting-header h2, h2')) ||
        document.title,
      company:
        (document.title.split(' - ').pop() || '').trim() || location.hostname,
      jobDescription: textOf(document.querySelector('.posting-description')),
      platform: 'Lever',
    }),
    workday: () => ({
      jobTitle:
        textOf(
          document.querySelector(
            '[data-automation-id="jobPostingHeader"], h1'
          )
        ) || document.title.split(' - ')[0],
      company:
        (document.title.split(' - ').pop() || '').trim() || location.hostname,
      jobDescription: textOf(
        document.querySelector(
          '[data-automation-id="jobPostingDescription"], .job-description'
        )
      ),
      platform: 'Workday',
    }),
    indeed: () => ({
      jobTitle:
        textOf(
          document.querySelector(
            '[data-testid="jobsearch-JobInfoHeader-title"], h1.jobsearch-JobInfoHeader-title'
          )
        ) || document.title,
      company: textOf(
        document.querySelector(
          '[data-testid="inlineHeader-companyName"], .icl-u-lg-mr--sm.icl-u-xs-mr--xs'
        )
      ),
      jobDescription: textOf(
        document.querySelector(
          '#jobDescriptionText, .jobsearch-jobDescriptionText'
        )
      ),
      platform: 'Indeed',
    }),
    ashby: () => ({
      jobTitle:
        textOf(document.querySelector('h1, [class*="JobPostingHeader"] h1')) ||
        document.title,
      company:
        (document.title.split(' at ').pop() || '').trim() || location.hostname,
      jobDescription: textOf(
        document.querySelector('[class*="JobDescription"], main')
      ),
      platform: 'Ashby',
    }),
    generic_apply: () => ({
      jobTitle: (document.title.split('-')[0] || '').trim(),
      company:
        location.hostname.replace('www.', '').replace('jobs.', '').split('.')[0],
      jobDescription: (document.body.innerText || '').slice(0, 4000),
      platform: 'Generic ATS',
    }),
  };

  function textOf(el) {
    if (!el) return '';
    return (el.innerText || el.textContent || '').trim();
  }

  function extractJobData() {
    const platform = detectPlatform();
    if (!platform) return null;
    const extractor = EXTRACTORS[platform.name] || EXTRACTORS.generic_apply;
    try {
      const data = extractor();
      data.jobUrl = location.href;
      data.platform = data.platform || platform.name;
      return data;
    } catch (_) {
      return null;
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // Autofill engine
  // ────────────────────────────────────────────────────────────────────
  function smartSetValue(input, value) {
    if (!value || !input) return false;
    const proto =
      input.tagName === 'TEXTAREA'
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value');
    if (nativeSetter && nativeSetter.set) {
      nativeSetter.set.call(input, value);
    } else {
      input.value = value;
    }
    ['input', 'change', 'blur', 'keyup'].forEach((evt) => {
      try {
        input.dispatchEvent(new Event(evt, { bubbles: true, cancelable: true }));
      } catch (_) {}
    });
    try {
      input.dispatchEvent(
        new InputEvent('input', { bubbles: true, cancelable: true, data: value })
      );
    } catch (_) {}

    input.style.transition = 'background-color 0.4s';
    input.style.backgroundColor = '#e0e7ff';
    setTimeout(() => {
      input.style.backgroundColor = '';
    }, 1500);
    return true;
  }

  function getFieldIdentifier(input) {
    const labelEl =
      (input.labels && input.labels[0]) ||
      (input.id ? document.querySelector(`label[for="${cssEscape(input.id)}"]`) : null);
    const labelText = labelEl ? (labelEl.innerText || labelEl.textContent || '') : '';
    const attrs = [
      input.name,
      input.id,
      input.placeholder,
      input.getAttribute('aria-label'),
      input.getAttribute('aria-labelledby'),
      input.getAttribute('data-automation-id'),
      input.getAttribute('data-testid'),
    ]
      .filter(Boolean)
      .join(' ');
    return (labelText + ' ' + attrs).toLowerCase().trim();
  }

  function cssEscape(s) {
    if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(s);
    return String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function matchAny(ident, patterns) {
    return patterns.some((p) => ident.includes(p));
  }

  function excludedBy(ident, exclude) {
    return !!(exclude && exclude.some((e) => ident.includes(e)));
  }

  function buildFieldMap(profile) {
    const fullName =
      [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
    return [
      { patterns: ['first name', 'firstname', 'fname', 'given name'], value: profile.firstName },
      { patterns: ['last name', 'lastname', 'lname', 'surname', 'family name'], value: profile.lastName },
      { patterns: ['preferred name'], value: profile.firstName, exclude: ['company'] },
      { patterns: ['full name', 'your name', 'candidate name', 'legal name'], value: fullName, exclude: ['company', 'first', 'last'] },
      { patterns: ['email', 'e-mail'], value: profile.email },
      { patterns: ['phone', 'mobile', 'cell', 'telephone'], value: profile.phone },
      { patterns: ['linkedin'], value: profile.linkedin },
      { patterns: ['github'], value: profile.github },
      { patterns: ['portfolio', 'website', 'personal url', 'personal site'], value: profile.website, exclude: ['github', 'linkedin'] },
      { patterns: ['city', 'current city'], value: profile.city },
      { patterns: ['state', 'province', 'region'], value: profile.state },
      { patterns: ['country'], value: profile.country },
      { patterns: ['address', 'street'], value: profile.address, exclude: ['email'] },
      { patterns: ['zip', 'postal', 'postcode'], value: profile.zip },
      { patterns: ['salary', 'expected salary', 'compensation', 'desired pay'], value: profile.expectedSalary },
      { patterns: ['summary', 'professional summary', 'about yourself'], value: profile.summary },
      { patterns: ['years of experience', 'how many years', 'total experience'], value: profile.yearsOfExperience },
      { patterns: ['notice period', 'available start', 'when can you start'], value: profile.noticePeriod },
      { patterns: ['pronouns'], value: profile.pronouns },
    ];
  }

  function autofillForm({ profile, coverLetter }) {
    let filled = 0;
    const fieldMap = buildFieldMap(profile);

    const inputs = document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea'
    );

    inputs.forEach((input) => {
      if (input.value && input.value.trim()) return; // do not overwrite

      const ident = getFieldIdentifier(input);

      // Cover-letter style fields get the generated cover letter (if any)
      if (
        coverLetter &&
        input.tagName === 'TEXTAREA' &&
        matchAny(ident, [
          'cover letter',
          'additional information',
          'why do you want',
          'tell us about yourself',
          'why are you interested',
        ])
      ) {
        if (smartSetValue(input, coverLetter)) filled++;
        return;
      }

      for (const { patterns, value, exclude } of fieldMap) {
        if (!value) continue;
        if (matchAny(ident, patterns) && !excludedBy(ident, exclude)) {
          if (smartSetValue(input, String(value))) filled++;
          break;
        }
      }
    });

    // Selects: work authorization, sponsorship, etc.
    document.querySelectorAll('select').forEach((select) => {
      const ident = getFieldIdentifier(select);
      const trySet = (matcher) => {
        const opt = Array.from(select.options).find(matcher);
        if (opt) {
          select.value = opt.value;
          try {
            select.dispatchEvent(new Event('change', { bubbles: true }));
          } catch (_) {}
          return true;
        }
        return false;
      };
      if (matchAny(ident, ['authorized', 'work authorization', 'legally authorized'])) {
        if (profile.workAuthorized) {
          if (trySet((o) => /yes|authorized/i.test(o.text))) filled++;
        }
      }
      if (matchAny(ident, ['sponsorship', 'visa', 'require sponsorship'])) {
        const matcher = profile.needsSponsorship
          ? (o) => /yes/i.test(o.text)
          : (o) => /no\b/i.test(o.text);
        if (trySet(matcher)) filled++;
      }
      if (matchAny(ident, ['gender']) && profile.gender) {
        if (
          trySet((o) => o.text.trim().toLowerCase() === profile.gender.toLowerCase())
        )
          filled++;
      }
      if (matchAny(ident, ['ethnicity', 'race']) && profile.ethnicity) {
        if (trySet((o) => o.text.toLowerCase().includes(profile.ethnicity.toLowerCase())))
          filled++;
      }
    });

    showToast(`✓ Autofilled ${filled} field${filled !== 1 ? 's' : ''}`);

    // Cache for multi-step forms (Workday, Greenhouse multipage)
    try {
      chrome.storage.local.set({
        'referme/last-autofill': { profile, coverLetter, timestamp: Date.now() },
      });
    } catch (_) {}

    setTimeout(() => detectUnknownFields(), 600);

    return { filled, total: inputs.length };
  }

  async function detectUnknownFields() {
    try {
      const stored = await new Promise((resolve) =>
        chrome.storage.local.get(['referme/custom-answers'], resolve)
      );
      const customAnswers = stored['referme/custom-answers'] || {};

      const unknown = [];
      const allInputs = document.querySelectorAll(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]), textarea'
      );

      allInputs.forEach((input) => {
        if (input.value && input.value.trim()) return;
        const ident = getFieldIdentifier(input);
        if (!ident) return;

        const known = [
          'first name', 'last name', 'email', 'phone', 'linkedin', 'github',
          'website', 'city', 'state', 'country', 'address', 'zip', 'postal',
          'salary', 'cover letter', 'summary', 'years', 'experience',
          'authorized', 'sponsorship', 'gender', 'ethnicity',
        ].some((p) => ident.includes(p));
        if (known) return;

        const key = ident.slice(0, 80);
        const savedAnswer = customAnswers[key];
        if (savedAnswer) {
          smartSetValue(input, savedAnswer);
          return;
        }

        const labelEl =
          (input.labels && input.labels[0]) ||
          (input.id
            ? document.querySelector(`label[for="${cssEscape(input.id)}"]`)
            : null);
        const labelText = labelEl ? (labelEl.innerText || labelEl.textContent || '') : ident;
        const clean = labelText.trim().slice(0, 120);
        if (clean.length > 3) {
          unknown.push({
            id: input.id || key.slice(0, 40),
            label: clean,
            inputType: input.tagName === 'TEXTAREA' ? 'textarea' : 'text',
          });
        }
      });

      if (unknown.length > 0) {
        // Tell the side-panel iframe (if mounted) so it can prompt the user
        if (agentIframe && agentIframe.contentWindow) {
          agentIframe.contentWindow.postMessage(
            { type: 'content/unknown-fields', fields: unknown.slice(0, 8) },
            '*'
          );
        }
        // Tell the runtime so the toolbar popup / dashboard can also react
        try {
          chrome.runtime.sendMessage({
            type: 'content/unknown-fields',
            fields: unknown.slice(0, 8),
          });
        } catch (_) {}
      }
    } catch (_) {}
  }

  function fillCustomAnswers(answers) {
    if (!answers || typeof answers !== 'object') return 0;
    let filled = 0;
    const inputs = document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea'
    );
    inputs.forEach((input) => {
      const ident = getFieldIdentifier(input);
      const key = ident.slice(0, 80);
      const answer = answers[input.id] || answers[key.slice(0, 40)] || answers[key];
      if (answer && (!input.value || !input.value.trim())) {
        if (smartSetValue(input, answer)) filled++;
      }
    });
    // Persist so future visits autofill these too.
    try {
      chrome.storage.local.get(['referme/custom-answers'], (res) => {
        const merged = Object.assign({}, res['referme/custom-answers'] || {}, answers);
        chrome.storage.local.set({ 'referme/custom-answers': merged });
      });
    } catch (_) {}
    showToast(`✓ Saved ${filled} custom answer${filled !== 1 ? 's' : ''}`);
    return filled;
  }

  // ────────────────────────────────────────────────────────────────────
  // ATS score badge + Save button
  // ────────────────────────────────────────────────────────────────────
  async function readResume() {
    try {
      const stored = await new Promise((resolve) =>
        chrome.storage.local.get(['referme/profile'], resolve)
      );
      const raw = stored['referme/profile'];
      if (!raw) return '';
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const resumes = parsed?.state?.resumes || [];
      const activeId = parsed?.state?.activeResumeId;
      const active = resumes.find((r) => r.id === activeId) || resumes[0];
      return active?.content || '';
    } catch (_) {
      return '';
    }
  }

  async function injectATSBadge(jobData) {
    if (!jobData?.jobDescription || !jobData?.jobTitle) return;

    const resume = await readResume();
    if (!resume) return;

    const stop = new Set([
      'with', 'that', 'from', 'your', 'will', 'have', 'this', 'they',
      'been', 'were', 'more', 'about', 'into', 'such', 'than', 'than',
      'only', 'just', 'over', 'each', 'work', 'team', 'role', 'must',
    ]);
    const jdWords = new Set(
      ((jobData.jobDescription.toLowerCase().match(/\b[a-z]{4,}\b/g)) || []).filter(
        (w) => !stop.has(w)
      )
    );
    const resumeText = resume.toLowerCase();
    let matched = 0;
    jdWords.forEach((w) => {
      if (resumeText.includes(w)) matched++;
    });
    const score =
      jdWords.size > 0
        ? Math.min(100, Math.round((matched / jdWords.size) * 100 * 1.4))
        : 0;

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
    badge.addEventListener('click', () => togglePanel(true));
    document.body.appendChild(badge);
  }

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
    `;
    btn.innerHTML = `<span style="font-size:16px">📌</span> Save to Tracker`;

    btn.addEventListener('click', async () => {
      try {
        const stored = await new Promise((resolve) =>
          chrome.storage.local.get(['referme/tracker'], resolve)
        );
        const raw = stored['referme/tracker'];
        const parsed = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : { state: { applications: [], contacts: [] } };
        const state = parsed.state || { applications: [], contacts: [] };
        const apps = Array.isArray(state.applications) ? state.applications : [];

        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        const now = Date.now();
        apps.unshift({
          id,
          jobTitle: jobData.jobTitle,
          company: jobData.company || '',
          location: jobData.location || '',
          jobUrl: location.href,
          jobDescription: jobData.jobDescription || '',
          salary: '',
          jobType: '',
          remote: false,
          status: 'saved',
          appliedDate: null,
          savedDate: now,
          lastUpdated: now,
          resumeProfileId: '',
          coverLetter: '',
          atsScore: null,
          matchedKeywords: [],
          missingKeywords: [],
          notes: '',
          interviews: [],
          source: jobData.platform || 'browser',
          tags: [],
          priority: 'medium',
          companyDomain: '',
        });

        const next = { ...parsed, state: { ...state, applications: apps }, version: 2 };
        chrome.storage.local.set({ 'referme/tracker': JSON.stringify(next) });

        showToast(`📌 Saved "${jobData.jobTitle}" to Job Tracker!`);
        btn.innerHTML = `<span style="font-size:16px">✅</span> Saved!`;
        btn.style.background = '#10b981';
        setTimeout(() => {
          btn.innerHTML = `<span style="font-size:16px">📌</span> Save to Tracker`;
          btn.style.background = 'linear-gradient(135deg, #4f46e5, #7c3aed)';
        }, 3000);
      } catch (err) {
        showToast('Failed to save — open dashboard to add manually', 'error');
      }
    });
    document.body.appendChild(btn);
  }

  // ────────────────────────────────────────────────────────────────────
  // Side panel (iframe) + toggle
  // ────────────────────────────────────────────────────────────────────
  function initSidePanel() {
    if (agentContainer || !detectPlatform()) return;

    agentContainer = document.createElement('div');
    agentContainer.id = 'referme-agent-container';

    agentIframe = document.createElement('iframe');
    agentIframe.id = 'referme-agent-iframe';
    agentIframe.src = chrome.runtime.getURL('popup/index.html');
    agentIframe.allow = 'clipboard-write';

    agentToggle = document.createElement('div');
    agentToggle.id = 'referme-agent-toggle';
    agentToggle.title = 'Open ReferMe';
    agentToggle.innerHTML = '✨';
    agentToggle.onclick = () => togglePanel();

    agentContainer.appendChild(agentIframe);
    agentContainer.appendChild(agentToggle);
    document.body.appendChild(agentContainer);
  }

  function togglePanel(forceOpen = null) {
    isPanelOpen = forceOpen !== null ? forceOpen : !isPanelOpen;
    if (!agentContainer) initSidePanel();
    if (!agentContainer) return;
    if (isPanelOpen) {
      agentContainer.classList.add('open');
      sendJobToPanel();
    } else {
      agentContainer.classList.remove('open');
    }
  }

  function sendJobToPanel() {
    if (!agentIframe || !agentIframe.contentWindow) return;
    const data = extractJobData();
    if (!data) return;
    agentIframe.contentWindow.postMessage({ type: 'content/job-detected', job: data }, '*');
  }

  // ────────────────────────────────────────────────────────────────────
  // Toast
  // ────────────────────────────────────────────────────────────────────
  function showToast(message, type = 'success') {
    document.getElementById('referme-toast')?.remove();
    const toast = document.createElement('div');
    toast.id = 'referme-toast';
    toast.style.cssText = `
      position: fixed; bottom: 24px; right: 24px; z-index: 999999;
      background: ${type === 'success' ? '#10b981' : '#ef4444'};
      color: white; padding: 12px 20px; border-radius: 12px;
      font-family: -apple-system, sans-serif; font-size: 13px; font-weight: 600;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2); cursor: pointer;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    toast.addEventListener('click', () => toast.remove());
    setTimeout(() => toast.remove(), 3500);
  }

  // ────────────────────────────────────────────────────────────────────
  // Message bus: handle both chrome.runtime AND window.postMessage
  // ────────────────────────────────────────────────────────────────────
  function handleMessage(msg, sendResponse) {
    if (!msg || typeof msg !== 'object' || !msg.type) return false;

    switch (msg.type) {
      case 'content/extract-job': {
        const job = extractJobData();
        sendResponse && sendResponse({ type: 'content/job-detected', job });
        return false;
      }
      case 'content/autofill': {
        const result = autofillForm({
          profile: msg.profile || {},
          coverLetter: msg.coverLetter || '',
        });
        sendResponse && sendResponse({ type: 'content/autofill-result', ...result });
        return false;
      }
      case 'content/fill-custom-answers': {
        const filled = fillCustomAnswers(msg.answers || {});
        sendResponse && sendResponse({ type: 'content/autofill-result', filled, total: filled });
        return false;
      }
      case 'content/toggle-panel': {
        togglePanel(typeof msg.open === 'boolean' ? msg.open : null);
        sendResponse && sendResponse({ type: 'bg/ack' });
        return false;
      }
      case 'content/ping': {
        sendResponse && sendResponse({ type: 'bg/ack' });
        return false;
      }
      default:
        return false;
    }
  }

  // chrome.runtime: toolbar popup, dashboard, service worker
  try {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      const keepAlive = handleMessage(msg, sendResponse);
      return keepAlive === true;
    });
  } catch (_) {}

  // window.postMessage: side-panel iframe
  window.addEventListener('message', (event) => {
    if (!event.data || typeof event.data !== 'object') return;
    handleMessage(event.data, (response) => {
      if (event.source && 'postMessage' in event.source) {
        try {
          event.source.postMessage(response, '*');
        } catch (_) {}
      }
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // Boot
  // ────────────────────────────────────────────────────────────────────
  async function init() {
    if (initialized) return;
    initialized = true;

    const platform = detectPlatform();
    if (!platform) return;

    const jobData = extractJobData();
    if (jobData?.jobTitle) {
      await injectATSBadge(jobData);
      injectSaveButton(jobData);
    }

    initSidePanel();

    if (platform.kind === 'apply') {
      setTimeout(() => {
        togglePanel(true);
        setTimeout(sendJobToPanel, 1200);
      }, 800);
    }
  }

  // SPA navigation
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      initialized = false;
      agentContainer = null;
      agentIframe = null;
      agentToggle = null;
      document.getElementById('referme-ats-badge')?.remove();
      document.getElementById('referme-save-btn')?.remove();
      const old = document.getElementById('referme-agent-container');
      if (old) old.remove();
      setTimeout(init, 500);
    }
  }).observe(document.documentElement, { subtree: true, childList: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 500));
  } else {
    setTimeout(init, 500);
  }
})();
