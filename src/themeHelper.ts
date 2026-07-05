import {
  ACCENT_COLOR_STORAGE_KEY,
  DEFAULT_ACCENT_COLOR,
  applyAccentColorPreset,
  resolveAccentColorPreset
} from './accentTheme';

declare const chrome: any;

export function fetchAndApplyTheme() {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
    applyFallbackTheme();
    applyStoredAccentColor();
    return;
  }

  try {
    chrome.runtime.sendMessage({ action: 'getBrowserTheme' }, (response: any) => {
      // Handle runtime.lastError gracefully
      if (chrome.runtime.lastError) {
        console.log('[Theater Everywhere] Background page not ready, using default theme.');
        applyFallbackTheme();
        applyStoredAccentColor();
        return;
      }

      if (response && response.theme) {
        applyBrowserTheme(response.theme);
      } else {
        applyFallbackTheme();
      }
      applyStoredAccentColor();
    });
  } catch (e) {
    console.error('[Theater Everywhere] Failed to query theme:', e);
    applyFallbackTheme();
    applyStoredAccentColor();
  }
}

function applyBrowserTheme(theme: any) {
  const root = document.documentElement;
  const colors = theme.colors;

  if (!colors) {
    applyFallbackTheme();
    return;
  }

  const setVar = (name: string, value: string | undefined) => {
    if (value) {
      root.style.setProperty(name, value);
    }
  };

  // 1. Primary Page/Popup background color
  const bg = colors.popup || colors.toolbar || colors.frame || colors.accentcolor || colors.ntp_background;
  setVar('--bg-color', bg);

  // 2. Card/Panel background color (slightly lighter or darker for contrast)
  const cardBg = colors.tab_selected || colors.toolbar_field || colors.toolbar || colors.popup;
  setVar('--card-bg', cardBg);

  // 3. Border color
  const border = colors.popup_border || colors.toolbar_field_border || colors.sidebar_border;
  setVar('--border-color', border);

  // 4. Primary text color
  const textPrimary = colors.popup_text || colors.toolbar_text || colors.textcolor || colors.toolbar_field_text || colors.ntp_text;
  setVar('--text-primary', textPrimary);

  // 5. Secondary text color (computed mix if primary and bg exist)
  if (textPrimary && bg) {
    root.style.setProperty('--text-secondary', `color-mix(in srgb, ${textPrimary} 70%, ${bg})`);
  }

  // 6. Accent color
  const accent = colors.tab_line || colors.popup_border || colors.sidebar_border;
  if (accent) {
    setVar('--accent-color', accent);
    root.style.setProperty('--accent-hover', `color-mix(in srgb, ${accent} 85%, black)`);
  } else {
    applyAccentFallback();
  }

  console.log('[Theater Everywhere] Applied browser theme colors:', colors);
}

function applyAccentFallback() {
  applyAccentColorPreset(document.documentElement, DEFAULT_ACCENT_COLOR);
}

function applyFallbackTheme() {
  // Let the default CSS rules or system color fallbacks take care of it
  applyAccentFallback();
}

function applyStoredAccentColor() {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.sync) {
    applyAccentColorPreset(document.documentElement, DEFAULT_ACCENT_COLOR);
    return;
  }

  try {
    chrome.storage.sync.get({ [ACCENT_COLOR_STORAGE_KEY]: DEFAULT_ACCENT_COLOR }, (result: any) => {
      if (chrome.runtime.lastError) {
        applyAccentColorPreset(document.documentElement, DEFAULT_ACCENT_COLOR);
        return;
      }

      applyAccentColorPreset(
        document.documentElement,
        resolveAccentColorPreset(result && result[ACCENT_COLOR_STORAGE_KEY])
      );
    });
  } catch (_) {
    applyAccentColorPreset(document.documentElement, DEFAULT_ACCENT_COLOR);
  }
}
