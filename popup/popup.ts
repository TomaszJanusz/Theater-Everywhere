/* Popup script for Theater Everywhere */
import { fetchAndApplyTheme } from '../src/themeHelper';

// Apply browser theme colors immediately
fetchAndApplyTheme();

document.addEventListener('DOMContentLoaded', async () => {
  const domainNameEl = document.getElementById('domain-name') as HTMLElement;
  const toggleEl = document.getElementById('extension-toggle') as HTMLInputElement;
  const statusDotEl = document.getElementById('status-dot') as HTMLElement;
  const statusTextEl = document.getElementById('status-text') as HTMLElement;
  const optionsBtn = document.getElementById('options-btn') as HTMLButtonElement;

  let currentDomain = '';
  let activeTabId: number | null = null;

  // 1. Get current active tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && tab.id !== undefined) {
      activeTabId = tab.id;
      const url = new URL(tab.url);
      
      // Check for valid http/https pages
      if (url.protocol.startsWith('http')) {
        let domain = url.hostname;
        if (domain.startsWith('www.')) {
          domain = domain.substring(4);
        }
        currentDomain = domain;
        domainNameEl.textContent = url.hostname;
        
        // Load settings and update UI
        await updateStatusUI();
      } else {
        // System pages (chrome://, about://, etc.)
        domainNameEl.textContent = 'System page';
        toggleEl.disabled = true;
        setUIState(false, 'Inactive (system)');
      }
    } else {
      domainNameEl.textContent = 'No active page';
      toggleEl.disabled = true;
      setUIState(false, 'Unavailable');
    }
  } catch (err) {
    console.error('Popup initialization error:', err);
    domainNameEl.textContent = 'Error loading';
    toggleEl.disabled = true;
  }

  try {
    const data = await chrome.storage.sync.get('shortcuts');
    const toggleShortcut = (data.shortcuts && data.shortcuts.toggle) || 'T';
    const keyCapEl = document.querySelector('.key-cap') as HTMLElement | null;
    if (keyCapEl) {
      keyCapEl.textContent = toggleShortcut;
    }
  } catch (err) {
    console.error('Error loading shortcuts in popup:', err);
  }

  // 2. Open options page
  optionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // 3. Handle toggle change
  toggleEl.addEventListener('change', async () => {
    if (!currentDomain) return;

    const isActive = toggleEl.checked;
    
    try {
      const data = await chrome.storage.sync.get({ blacklist: [] });
      let blacklist = (data.blacklist || []) as string[];

      // Normalize all stored blacklist entries to strip www.
      blacklist = blacklist.map(d => d.startsWith('www.') ? d.substring(4) : d);

      if (isActive) {
        // Remove from blacklist to activate
        blacklist = blacklist.filter(d => d !== currentDomain);
      } else {
        // Add to blacklist to deactivate
        if (!blacklist.includes(currentDomain)) {
          blacklist.push(currentDomain);
        }
      }

      // Deduplicate
      blacklist = Array.from(new Set(blacklist));

      await chrome.storage.sync.set({ blacklist });
      
      // Update local UI
      setUIState(isActive, isActive ? 'Active' : 'Disabled');

      // Notify the active tab's content script to update its state dynamically
      if (activeTabId) {
        try {
          await chrome.tabs.sendMessage(activeTabId, { action: 'statusChanged' });
        } catch (msgErr) {
          // Content script might not be injected (e.g. extension just installed, or page loading)
          console.log('Could not send message to tab (content script inactive):', msgErr);
        }
      }
    } catch (err) {
      console.error('Error saving settings:', err);
    }
  });

  // Helper to read storage and set toggle state
  async function updateStatusUI() {
    try {
      const data = await chrome.storage.sync.get({ blacklist: [] });
      const blacklist = (data.blacklist || []) as string[];
      
      const isBlacklisted = blacklist.some(d => {
        const clean = d.startsWith('www.') ? d.substring(4) : d;
        return clean === currentDomain;
      });

      // In blacklist = not active = checkbox unchecked
      const isActive = !isBlacklisted;
      toggleEl.checked = isActive;
      setUIState(isActive, isActive ? 'Active' : 'Disabled');
    } catch (err) {
      console.error('Error reading storage:', err);
    }
  }

  // Helper to change classes/texts of indicators
  function setUIState(active: boolean, text: string) {
    statusTextEl.textContent = text;
    if (active) {
      statusDotEl.className = 'dot active';
    } else {
      statusDotEl.className = 'dot disabled';
    }
  }
});
