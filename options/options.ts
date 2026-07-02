/* Options script for Theater Everywhere */
import { fetchAndApplyTheme } from '../src/themeHelper';

// Apply browser theme colors immediately
fetchAndApplyTheme();

interface Shortcuts {
  toggle: string;
  exit: string;
  seekBack: string;
  seekForward: string;
  cycle: string;
  playPause: string;
  frameBack: string;
  frameForward: string;
  toggleFullscreen: string;
}

const defaultShortcuts: Shortcuts = {
  toggle: 'T',
  exit: 'Escape',
  seekBack: 'ArrowLeft',
  seekForward: 'ArrowRight',
  cycle: 'Shift+T',
  playPause: 'Space',
  frameBack: '<',
  frameForward: '>',
  toggleFullscreen: 'F'
};

function safeGetStorage(keys: string | string[]): Promise<any> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.warn('[Theater Everywhere] Storage request timed out, using fallback.');
      resolve({});
    }, 800);

    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(keys, (result) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            console.warn('[Theater Everywhere] chrome.runtime.lastError inside safeGetStorage:', chrome.runtime.lastError);
            resolve({});
          } else {
            resolve(result || {});
          }
        });
      } else {
        clearTimeout(timeout);
        resolve({});
      }
    } catch (e) {
      clearTimeout(timeout);
      console.error('[Theater Everywhere] Exception in safeGetStorage:', e);
      resolve({});
    }
  });
}

async function init() {
  const form = document.getElementById('add-domain-form') as HTMLFormElement;
  const input = document.getElementById('domain-input') as HTMLInputElement;
  const validationMsg = document.getElementById('validation-msg') as HTMLElement;
  const container = document.getElementById('blacklist-container') as HTMLElement;
  const countBadge = document.getElementById('blacklist-count') as HTMLElement;

  // Load and render blacklist on startup
  await loadAndRenderBlacklist();

  // Load and bind keyboard shortcuts on startup
  await loadAndRenderShortcuts();
  setupShortcutListeners();

  // Handle Form Submit
  form.addEventListener('submit', async (e: Event) => {
    e.preventDefault();
    validationMsg.textContent = '';

    const inputValue = input.value;
    const domain = cleanDomain(inputValue);

    if (!domain) {
      validationMsg.textContent = 'Invalid domain or URL format.';
      return;
    }

    try {
      const data = await safeGetStorage('blacklist');
      const blacklist = (data.blacklist || []) as string[];

      if (blacklist.includes(domain)) {
        validationMsg.textContent = 'This website is already excluded.';
        return;
      }

      blacklist.push(domain);
      await chrome.storage.sync.set({ blacklist });

      input.value = '';
      await loadAndRenderBlacklist();
      await notifyAllTabs();
    } catch (err) {
      console.error('Error adding domain:', err);
      validationMsg.textContent = 'Error saving settings.';
    }
  });

  // Load and render domains list
  async function loadAndRenderBlacklist() {
    try {
      const data = await safeGetStorage('blacklist');
      let blacklist = (data.blacklist || []) as string[];
      
      // Normalize blacklist: strip www. and remove duplicates
      let normalized = false;
      const cleanedBlacklist = Array.from(new Set(blacklist.map(d => {
        const cleaned = d.toLowerCase().trim();
        if (cleaned.startsWith('www.')) {
          normalized = true;
          return cleaned.substring(4);
        }
        return cleaned;
      })));

      if (normalized || cleanedBlacklist.length !== blacklist.length) {
        await chrome.storage.sync.set({ blacklist: cleanedBlacklist });
        blacklist = cleanedBlacklist;
      }

      // Sort alphabetically
      blacklist.sort();

      countBadge.textContent = String(blacklist.length);
      container.innerHTML = '';

      if (blacklist.length === 0) {
        // Render empty state
        container.innerHTML = `
          <div class="empty-state">
            <svg class="empty-state-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <h3>No exclusions yet</h3>
            <p>Theater mode will activate automatically on all video pages.</p>
          </div>
        `;
        return;
      }

      // Render items as a list of compact rows
      blacklist.forEach(domain => {
        const item = document.createElement('div');
        item.className = 'exclusion-list-item';

        const domainSpan = document.createElement('span');
        domainSpan.className = 'domain-name';
        domainSpan.textContent = domain;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-list-btn';
        deleteBtn.title = 'Remove exclusion';
        deleteBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        `;
        deleteBtn.addEventListener('click', () => removeDomain(domain));

        item.appendChild(domainSpan);
        item.appendChild(deleteBtn);
        container.appendChild(item);
      });

    } catch (err) {
      console.error('Error loading exclusion list:', err);
      container.innerHTML = '<div style="padding: 20px; color: var(--danger-color)">Error loading settings.</div>';
    }
  }

  // Remove domain from storage
  async function removeDomain(domain: string) {
    try {
      const data = await safeGetStorage('blacklist');
      let blacklist = (data.blacklist || []) as string[];
      
      blacklist = blacklist.filter(d => d !== domain);
      await chrome.storage.sync.set({ blacklist });
      
      await loadAndRenderBlacklist();
      await notifyAllTabs();
    } catch (err) {
      console.error('Error removing domain:', err);
    }
  }

  // Clean and validate domain input (resolves urls into hostnames)
  function cleanDomain(inputVal: string) {
    let str = inputVal.trim().toLowerCase();
    if (!str) return null;

    // Check if it looks like a URL with protocol, otherwise prepend http:// to parse
    if (!/^https?:\/\//i.test(str)) {
      str = 'http://' + str;
    }

    try {
      const url = new URL(str);
      let host = url.hostname;
      
      // Basic domain check: must have at least one dot, and length > 3
      if (host && host.includes('.') && host.length > 3) {
        if (host.startsWith('www.')) {
          host = host.substring(4);
        }
        return host;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  // Notify all open tabs to reload their status dynamically
  async function notifyAllTabs() {
    try {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id && tab.url && tab.url.startsWith('http')) {
          try {
            await chrome.tabs.sendMessage(tab.id, { action: 'statusChanged' });
          } catch (e) {
            // Ignore tabs without content script loaded
          }
        }
      }
    } catch (err) {
      console.error('Error notifying tabs:', err);
    }
  }

  // Removed internal declarations (moved to top of file)

  function renderShortcuts(shortcuts: Shortcuts) {
    const toggleInput = document.getElementById('shortcut-toggle') as HTMLInputElement;
    const exitInput = document.getElementById('shortcut-exit') as HTMLInputElement;
    const seekBackInput = document.getElementById('shortcut-seek-back') as HTMLInputElement;
    const seekForwardInput = document.getElementById('shortcut-seek-forward') as HTMLInputElement;
    const cycleInput = document.getElementById('shortcut-cycle') as HTMLInputElement;
    const playPauseInput = document.getElementById('shortcut-play-pause') as HTMLInputElement;
    const frameBackInput = document.getElementById('shortcut-frame-back') as HTMLInputElement;
    const frameForwardInput = document.getElementById('shortcut-frame-forward') as HTMLInputElement;
    const toggleFullscreenInput = document.getElementById('shortcut-toggle-fullscreen') as HTMLInputElement;

    if (toggleInput) toggleInput.value = shortcuts.toggle || defaultShortcuts.toggle;
    if (exitInput) exitInput.value = shortcuts.exit || defaultShortcuts.exit;
    if (seekBackInput) seekBackInput.value = shortcuts.seekBack || defaultShortcuts.seekBack;
    if (seekForwardInput) seekForwardInput.value = shortcuts.seekForward || defaultShortcuts.seekForward;
    if (cycleInput) cycleInput.value = shortcuts.cycle || defaultShortcuts.cycle;
    if (playPauseInput) playPauseInput.value = shortcuts.playPause || defaultShortcuts.playPause;
    if (frameBackInput) frameBackInput.value = shortcuts.frameBack || defaultShortcuts.frameBack;
    if (frameForwardInput) frameForwardInput.value = shortcuts.frameForward || defaultShortcuts.frameForward;
    if (toggleFullscreenInput) toggleFullscreenInput.value = shortcuts.toggleFullscreen || defaultShortcuts.toggleFullscreen;
  }

  async function loadAndRenderShortcuts() {
    try {
      const data = await safeGetStorage('shortcuts');
      const saved = data.shortcuts || {};
      
      const shortcuts = {
        toggle: saved.toggle || defaultShortcuts.toggle,
        exit: saved.exit || defaultShortcuts.exit,
        seekBack: saved.seekBack || defaultShortcuts.seekBack,
        seekForward: saved.seekForward || defaultShortcuts.seekForward,
        cycle: saved.cycle || defaultShortcuts.cycle,
        playPause: saved.playPause || defaultShortcuts.playPause,
        frameBack: saved.frameBack || defaultShortcuts.frameBack,
        frameForward: saved.frameForward || defaultShortcuts.frameForward,
        toggleFullscreen: saved.toggleFullscreen || defaultShortcuts.toggleFullscreen
      } as Shortcuts;
      
      renderShortcuts(shortcuts);
    } catch (err) {
      console.error('Error loading shortcuts, using defaults:', err);
      renderShortcuts(defaultShortcuts);
    }
  }

  function getShortcutString(e: KeyboardEvent): string {
    const parts: string[] = [];
    if (e.ctrlKey && e.key !== 'Control') parts.push('Ctrl');
    if (e.altKey && e.key !== 'Alt') parts.push('Alt');
    if (e.shiftKey && e.key !== 'Shift') parts.push('Shift');
    if (e.metaKey && e.key !== 'Meta') parts.push('Meta');
    
    // Add the main key
    if (e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Shift' && e.key !== 'Meta') {
      let keyName = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      if (keyName === ' ') {
        keyName = 'Space';
      }
      parts.push(keyName);
    }
    
    return parts.join('+');
  }

  function setupShortcutListeners() {
    // 1. Keyboard recording listener
    const inputs = document.querySelectorAll('.shortcut-input') as NodeListOf<HTMLInputElement>;
    inputs.forEach(input => {
      input.addEventListener('keydown', async (e: KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const isModifierOnly = ['Control', 'Alt', 'Shift', 'Meta'].includes(e.key);
        if (isModifierOnly) {
          const tempParts: string[] = [];
          if (e.ctrlKey) tempParts.push('Ctrl');
          if (e.altKey) tempParts.push('Alt');
          if (e.shiftKey) tempParts.push('Shift');
          if (e.metaKey) tempParts.push('Meta');
          tempParts.push('...');
          input.value = tempParts.join('+');
          return;
        }

        const shortcutStr = getShortcutString(e);
        if (!shortcutStr) return;

        input.value = shortcutStr;

        // Save to storage
        try {
          const data = await safeGetStorage('shortcuts');
          const saved = data.shortcuts || {};
          const shortcuts = {
            toggle: saved.toggle || defaultShortcuts.toggle,
            exit: saved.exit || defaultShortcuts.exit,
            seekBack: saved.seekBack || defaultShortcuts.seekBack,
            seekForward: saved.seekForward || defaultShortcuts.seekForward,
            cycle: saved.cycle || defaultShortcuts.cycle,
            playPause: saved.playPause || defaultShortcuts.playPause,
            frameBack: saved.frameBack || defaultShortcuts.frameBack,
            frameForward: saved.frameForward || defaultShortcuts.frameForward,
            toggleFullscreen: saved.toggleFullscreen || defaultShortcuts.toggleFullscreen
          } as Shortcuts;

          const shortcutId = input.id;
          if (shortcutId === 'shortcut-toggle') shortcuts.toggle = shortcutStr;
          else if (shortcutId === 'shortcut-exit') shortcuts.exit = shortcutStr;
          else if (shortcutId === 'shortcut-seek-back') shortcuts.seekBack = shortcutStr;
          else if (shortcutId === 'shortcut-seek-forward') shortcuts.seekForward = shortcutStr;
          else if (shortcutId === 'shortcut-cycle') shortcuts.cycle = shortcutStr;
          else if (shortcutId === 'shortcut-play-pause') shortcuts.playPause = shortcutStr;
          else if (shortcutId === 'shortcut-frame-back') shortcuts.frameBack = shortcutStr;
          else if (shortcutId === 'shortcut-frame-forward') shortcuts.frameForward = shortcutStr;
          else if (shortcutId === 'shortcut-toggle-fullscreen') shortcuts.toggleFullscreen = shortcutStr;

          await chrome.storage.sync.set({ shortcuts });
          await notifyAllTabs();
        } catch (err) {
          console.error('Error saving shortcut:', err);
        }
      });
    });

    // 2. Individual reset buttons listener
    const singleResetBtns = document.querySelectorAll('.reset-single-btn') as NodeListOf<HTMLButtonElement>;
    singleResetBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const shortcutKey = btn.getAttribute('data-shortcut') as keyof Shortcuts;
        if (!shortcutKey || !defaultShortcuts[shortcutKey]) return;

        try {
          const data = await safeGetStorage('shortcuts');
          const saved = data.shortcuts || {};
          const shortcuts = {
            toggle: saved.toggle || defaultShortcuts.toggle,
            exit: saved.exit || defaultShortcuts.exit,
            seekBack: saved.seekBack || defaultShortcuts.seekBack,
            seekForward: saved.seekForward || defaultShortcuts.seekForward,
            cycle: saved.cycle || defaultShortcuts.cycle,
            playPause: saved.playPause || defaultShortcuts.playPause,
            frameBack: saved.frameBack || defaultShortcuts.frameBack,
            frameForward: saved.frameForward || defaultShortcuts.frameForward,
            toggleFullscreen: saved.toggleFullscreen || defaultShortcuts.toggleFullscreen
          } as Shortcuts;

          shortcuts[shortcutKey] = defaultShortcuts[shortcutKey];

          await chrome.storage.sync.set({ shortcuts });
          await loadAndRenderShortcuts();
          await notifyAllTabs();
        } catch (err) {
          console.error(`Error resetting individual shortcut ${shortcutKey}:`, err);
        }
      });
    });

    // 3. Reset all to defaults button listener
    const resetBtn = document.getElementById('reset-shortcuts-btn') as HTMLButtonElement | null;
    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        try {
          await chrome.storage.sync.set({ shortcuts: defaultShortcuts });
          await loadAndRenderShortcuts();
          await notifyAllTabs();
        } catch (err) {
          console.error('Error resetting shortcuts:', err);
        }
      });
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
