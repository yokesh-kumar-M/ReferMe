// content.js
console.log("ReferMe Agent: Content script loaded");

let agentContainer = null;
let agentIframe = null;
let isOpen = false;

function detectJobApplication() {
  const url = window.location.href.toLowerCase();
  // Basic heuristic: check if URL contains job board patterns
  const jobBoards = [
    "linkedin.com/jobs",
    "greenhouse.io",
    "lever.co",
    "workday.com",
    "myworkdayjobs.com",
    "indeed.com/viewjob",
    "glassdoor.com/job-listing"
  ];
  
  if (jobBoards.some(board => url.includes(board))) {
    return true;
  }
  
  // Or check for common "Apply" buttons or "Job Description" text
  const pageText = document.body.innerText.toLowerCase();
  if ((pageText.includes("job description") || pageText.includes("role responsibilities")) && 
      (pageText.includes("apply") || pageText.includes("submit application"))) {
    return true;
  }
  
  return false;
}

function extractJobDetails() {
  // A very basic extraction heuristic
  let jobTitle = document.title.split('-')[0].trim();
  let jobDescription = document.body.innerText.substring(0, 5000); // Extract some text for context

  // Basic LinkedIn specifically
  if (window.location.href.includes("linkedin.com/jobs")) {
    const titleEl = document.querySelector(".job-details-jobs-unified-top-card__job-title") || document.querySelector("h1");
    if (titleEl) jobTitle = titleEl.innerText;
    
    const descEl = document.querySelector("#job-details") || document.querySelector(".jobs-description__content");
    if (descEl) jobDescription = descEl.innerText;
  }
  
  return { jobTitle, jobDescription };
}

function autoFillForm(data) {
  console.log("ReferMe Agent: Attempting to autofill with data:", data);
  
  // A simple heuristic to find matching form fields based on label text or name attributes
  const inputs = document.querySelectorAll('input, textarea');
  
  inputs.forEach(input => {
    // Avoid changing already filled, hidden, or non-text inputs
    if (input.value && input.value.trim() !== "") return;
    if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button') return;
    
    const labelText = input.labels && input.labels[0] ? input.labels[0].innerText.toLowerCase() : "";
    const nameAttr = (input.name || input.id || input.placeholder || "").toLowerCase();
    
    const combinedIdent = labelText + " " + nameAttr;

    // Helper to safely set value and trigger events
    const setValue = (val) => {
      input.value = val;
      // Dispatch events so modern frameworks like React/Vue pick up the change
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
      input.style.backgroundColor = '#e0e7ff'; // Highlight filled fields briefly
      setTimeout(() => { input.style.backgroundColor = ''; }, 1500);
    };

    if ((combinedIdent.includes('first name') || combinedIdent.includes('fname')) && data.firstName) {
      setValue(data.firstName);
    } else if ((combinedIdent.includes('last name') || combinedIdent.includes('lname')) && data.lastName) {
      setValue(data.lastName);
    } else if (combinedIdent.includes('name') && data.fullName && !combinedIdent.includes('company')) {
      setValue(data.fullName);
    } else if ((combinedIdent.includes('email') || combinedIdent.includes('e-mail')) && data.email) {
      setValue(data.email);
    } else if (combinedIdent.includes('phone') && data.phone) {
      setValue(data.phone);
    } else if (combinedIdent.includes('linkedin') && data.linkedin) {
      setValue(data.linkedin);
    } else if ((combinedIdent.includes('website') || combinedIdent.includes('portfolio') || combinedIdent.includes('github')) && data.website) {
      setValue(data.website);
    } else if (input.tagName.toLowerCase() === 'textarea' && (combinedIdent.includes('cover letter') || combinedIdent.includes('additional information')) && data.coverLetter) {
      setValue(data.coverLetter);
    }
  });
}

function initAgent() {
  if (agentContainer) return;
  if (!detectJobApplication()) return;

  console.log("ReferMe Agent: Job application detected!");

  agentContainer = document.createElement("div");
  agentContainer.id = "referme-agent-container";
  
  const toggleBtn = document.createElement("div");
  toggleBtn.id = "referme-agent-toggle";
  toggleBtn.innerHTML = "✨";
  toggleBtn.title = "Open ReferMe Agent";
  toggleBtn.onclick = () => toggleAgent();
  
  agentIframe = document.createElement("iframe");
  agentIframe.id = "referme-agent-iframe";
  // The URL must be defined in web_accessible_resources
  agentIframe.src = chrome.runtime.getURL("index.html");
  
  agentContainer.appendChild(toggleBtn);
  agentContainer.appendChild(agentIframe);
  document.body.appendChild(agentContainer);

  // Auto-open
  setTimeout(() => {
    toggleAgent(true);
    
    // Wait a bit for iframe to load before sending data
    setTimeout(() => {
      sendJobData();
    }, 1500);
  }, 1000);
}

function toggleAgent(forceOpen = null) {
  if (forceOpen !== null) {
    isOpen = forceOpen;
  } else {
    isOpen = !isOpen;
  }
  
  if (isOpen) {
    agentContainer.classList.add("open");
    sendJobData();
  } else {
    agentContainer.classList.remove("open");
  }
}

function sendJobData() {
  if (!agentIframe || !agentIframe.contentWindow) return;
  const data = extractJobDetails();
  agentIframe.contentWindow.postMessage({
    type: "REFERME_JOB_DATA",
    ...data
  }, "*");
}

// Listen for messages from the Agent iframe
window.addEventListener('message', (event) => {
  // Always check origin/source in production, but since we are injecting we trust the iframe we created
  if (event.data && event.data.type === 'REFERME_AUTOFILL') {
    autoFillForm(event.data.payload);
  }
});

// Run init on load
if (document.readyState === "complete" || document.readyState === "interactive") {
  initAgent();
} else {
  document.addEventListener("DOMContentLoaded", initAgent);
}

// Handle URL changes in SPAs
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    if (!agentContainer) {
      initAgent();
    } else if (detectJobApplication()) {
      sendJobData();
    }
  }
}).observe(document, { subtree: true, childList: true });
