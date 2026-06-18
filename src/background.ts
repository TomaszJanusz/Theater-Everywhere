declare const browser: any;

const isFirefox = typeof browser !== 'undefined' && typeof browser.theme !== 'undefined';

const ICON_ACTIVE: chrome.action.TabIconDetails['path'] = {
  '16':  'icons/icon-16.png',
  '32':  'icons/icon-32.png',
  '48':  'icons/icon-48.png',
  '96':  'icons/icon-96.png',
  '128': 'icons/icon-128.png',
};

const ICON_DISABLED: chrome.action.TabIconDetails['path'] = {
  '16':  'icons/icon-16-disabled.png',
  '32':  'icons/icon-32-disabled.png',
  '48':  'icons/icon-48-disabled.png',
  '96':  'icons/icon-96-disabled.png',
  '128': 'icons/icon-128-disabled.png',
};

async function updateIconForTab(tabId: number, url: string | undefined): Promise<void> {
  if (!url || !url.startsWith('http')) {
    chrome.action.setIcon({ path: ICON_ACTIVE, tabId });
    return;
  }
  try {
    const hostname = new URL(url).hostname;
    const data = await chrome.storage.sync.get({ blacklist: [] as string[] });
    const blacklist = data.blacklist as string[];
    const isBlacklisted = blacklist.some(
      d => hostname === d || hostname.endsWith('.' + d)
    );
    chrome.action.setIcon({ path: isBlacklisted ? ICON_DISABLED : ICON_ACTIVE, tabId });
  } catch {
    chrome.action.setIcon({ path: ICON_ACTIVE, tabId });
  }
}

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  updateIconForTab(tabId, tab.url);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'complete') {
    updateIconForTab(tabId, tab.url);
  }
});

chrome.storage.onChanged.addListener(async (changes) => {
  if (!changes.blacklist) return;
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id !== undefined) {
      updateIconForTab(tab.id, tab.url);
    }
  }
});

chrome.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: any) => {
  if (message && message.action === 'getBrowserTheme') {
    if (isFirefox) {
      browser.theme.getCurrent()
        .then((theme: any) => { sendResponse({ theme }); })
        .catch((error: any) => {
          console.error('[Theater Everywhere] Error fetching theme:', error);
          sendResponse({ theme: null });
        });
      return true;
    } else {
      sendResponse({ theme: null });
    }
  }
  return false;
});

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    try {
      const data = await chrome.storage.sync.get(['shortcuts', 'blacklist']);
      if (!data.shortcuts) {
        await chrome.storage.sync.set({
          shortcuts: {
            toggle: 'T',
            exit: 'Escape',
            seekBack: 'ArrowLeft',
            seekForward: 'ArrowRight',
          },
        });
      }
      if (!data.blacklist) {
        await chrome.storage.sync.set({ blacklist: ['youtube.com'] });
      }
    } catch (err) {
      console.error('[Theater Everywhere] Error initializing defaults:', err);
    }
  }
});
