// ReferMe v2 — Background Service Worker
// Responsibilities:
//   1. Cache the most-recently-detected job per tab, so the popup can show
//      something useful even before the content script answers.
//   2. Route `bg/relay-to-tab` from popup/dashboard to a tab's content
//      script (used when the caller doesn't have a tabs permission scope
//      handy, e.g. an iframe inside the popup window).
//   3. Open the dashboard with a click on the toolbar icon when the
//      current page isn't a job page (popup falls back to dashboard).
//   4. Dev-mode hot-reload (poll a timestamp written by the dev build).
//
// Service workers in MV3 are short-lived. State here is intentionally
// best-effort — anything important is in chrome.storage.local.

const tabJobs = new Map(); // tabId -> JobContext

// ──────────────────────────────────────────────────────────────────────
// Message routing
// ──────────────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object' || !msg.type) return false;

  switch (msg.type) {
    case 'content/job-detected': {
      if (sender.tab?.id != null) {
        tabJobs.set(sender.tab.id, msg.job);
      }
      sendResponse({ type: 'bg/ack' });
      return false;
    }

    case 'bg/get-active-job': {
      chrome.tabs
        .query({ active: true, currentWindow: true })
        .then(([tab]) => {
          const job = tab?.id != null ? tabJobs.get(tab.id) || null : null;
          sendResponse({ type: 'bg/active-job', job, tabId: tab?.id ?? null });
        })
        .catch(() => sendResponse({ type: 'bg/active-job', job: null, tabId: null }));
      return true; // async
    }

    case 'bg/relay-to-tab': {
      const targetId = msg.tabId;
      const forward = (id) => {
        if (id == null) {
          sendResponse({ type: 'bg/ack' });
          return;
        }
        chrome.tabs.sendMessage(id, msg.message, (reply) => {
          // Swallow lastError — caller can interpret null as "not delivered".
          void chrome.runtime.lastError;
          sendResponse(reply ?? { type: 'bg/ack' });
        });
      };
      if (targetId != null) {
        forward(targetId);
      } else {
        chrome.tabs
          .query({ active: true, currentWindow: true })
          .then(([tab]) => forward(tab?.id ?? null))
          .catch(() => sendResponse({ type: 'bg/ack' }));
      }
      return true; // async
    }

    default:
      return false;
  }
});

// Forget cached job context when a tab closes or navigates away.
chrome.tabs.onRemoved.addListener((tabId) => {
  tabJobs.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    tabJobs.delete(tabId);
  }
});

// ──────────────────────────────────────────────────────────────────────
// Dev mode hot-reload (no-op in production)
// ──────────────────────────────────────────────────────────────────────
function startHotReload() {
  let lastTimestamp = null;
  const poll = async () => {
    try {
      const url = chrome.runtime.getURL('timestamp.json') + '?t=' + Date.now();
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (!lastTimestamp) lastTimestamp = data.timestamp;
        else if (lastTimestamp !== data.timestamp) chrome.runtime.reload();
      }
    } catch (_) {}
    setTimeout(poll, 2000);
  };
  poll();
}

try {
  chrome.management?.getSelf((self) => {
    if (self?.installType === 'development') startHotReload();
  });
} catch (_) {}
