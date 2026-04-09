// hot-reload.js
let lastTimestamp = null;

const pollForChanges = async () => {
  try {
    const response = await fetch('/timestamp.json?t=' + Date.now());
    if (response.ok) {
      const data = await response.json();
      if (!lastTimestamp) {
        lastTimestamp = data.timestamp;
      } else if (lastTimestamp !== data.timestamp) {
        console.log('Change detected, reloading extension...');
        chrome.runtime.reload();
      }
    }
  } catch (error) {
    // Ignore fetch errors
  }
  
  // Poll every 1 second
  setTimeout(pollForChanges, 1000);
};

// Check if we are running as an unpacked extension
chrome.management.getSelf((self) => {
  if (self.installType === 'development') {
    pollForChanges();
  }
});