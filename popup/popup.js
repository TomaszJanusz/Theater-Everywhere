/* Popup script for Theater Everywhere */

document.addEventListener('DOMContentLoaded', async () => {
  const domainNameEl = document.getElementById('domain-name');
  const toggleEl = document.getElementById('extension-toggle');
  const statusDotEl = document.getElementById('status-dot');
  const statusTextEl = document.getElementById('status-text');
  const optionsBtn = document.getElementById('options-btn');

  let currentDomain = '';
  let activeTabId = null;

  // 1. Get current active tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      activeTabId = tab.id;
      const url = new URL(tab.url);
      
      // Check for valid http/https pages
      if (url.protocol.startsWith('http')) {
        currentDomain = url.hostname;
        domainNameEl.textContent = currentDomain;
        
        // Load settings and update UI
        await updateStatusUI();
      } else {
        // System pages (chrome://, about://, etc.)
        domainNameEl.textContent = 'Strona systemowa';
        toggleEl.disabled = true;
        setUIState(false, 'Nieaktywny (systemowa)');
      }
    } else {
      domainNameEl.textContent = 'Brak aktywnej strony';
      toggleEl.disabled = true;
      setUIState(false, 'Niedostępny');
    }
  } catch (err) {
    console.error('Błąd inicjalizacji popupu:', err);
    domainNameEl.textContent = 'Błąd wczytywania';
    toggleEl.disabled = true;
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
      let blacklist = data.blacklist || [];

      if (isActive) {
        // Remove from blacklist to activate
        blacklist = blacklist.filter(d => d !== currentDomain);
      } else {
        // Add to blacklist to deactivate
        if (!blacklist.includes(currentDomain)) {
          blacklist.push(currentDomain);
        }
      }

      await chrome.storage.sync.set({ blacklist });
      
      // Update local UI
      setUIState(isActive, isActive ? 'Włączony' : 'Wyłączony');

      // Notify the active tab's content script to update its state dynamically
      if (activeTabId) {
        try {
          await chrome.tabs.sendMessage(activeTabId, { action: 'statusChanged' });
        } catch (msgErr) {
          // Content script might not be injected (e.g. extension just installed, or page loading)
          console.log('Nie udało się wysłać wiadomości do karty (content script nieaktywny):', msgErr);
        }
      }
    } catch (err) {
      console.error('Błąd podczas zapisywania ustawień:', err);
    }
  });

  // Helper to read storage and set toggle state
  async function updateStatusUI() {
    try {
      const data = await chrome.storage.sync.get({ blacklist: [] });
      const blacklist = data.blacklist || [];
      const isBlacklisted = blacklist.includes(currentDomain);

      // In blacklist = not active = checkbox unchecked
      const isActive = !isBlacklisted;
      toggleEl.checked = isActive;
      setUIState(isActive, isActive ? 'Włączony' : 'Wyłączony');
    } catch (err) {
      console.error('Błąd odczytu storage:', err);
    }
  }

  // Helper to change classes/texts of indicators
  function setUIState(active, text) {
    statusTextEl.textContent = text;
    if (active) {
      statusDotEl.className = 'dot active';
    } else {
      statusDotEl.className = 'dot disabled';
    }
  }
});
