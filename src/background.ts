declare const browser: any;

const isFirefox = typeof browser !== 'undefined' && typeof browser.theme !== 'undefined';

chrome.runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
  if (message && message.action === 'getBrowserTheme') {
    if (isFirefox) {
      browser.theme.getCurrent()
        .then((theme: any) => {
          sendResponse({ theme });
        })
        .catch((error: any) => {
          console.error('[Theater Everywhere] Error fetching theme:', error);
          sendResponse({ theme: null });
        });
      return true; // Keep response channel open for async sendResponse
    } else {
      sendResponse({ theme: null });
    }
  }
  return false;
});

// Initialize default shortcuts upon installation
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    try {
      const data = await chrome.storage.sync.get('shortcuts');
      if (!data.shortcuts) {
        await chrome.storage.sync.set({
          shortcuts: {
            toggle: 'T',
            exit: 'Escape',
            seekBack: 'ArrowLeft',
            seekForward: 'ArrowRight'
          }
        });
        console.log('[Theater Everywhere] Initialized default shortcuts in storage.');
      }
    } catch (err) {
      console.error('[Theater Everywhere] Error initializing default shortcuts:', err);
    }
  }
});
