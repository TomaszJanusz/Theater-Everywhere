declare const chrome: any;

export function fetchAndApplyTheme() {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
    applyFallbackTheme();
    return;
  }

  try {
    chrome.runtime.sendMessage({ action: 'getBrowserTheme' }, (response: any) => {
      // Handle runtime.lastError gracefully
      if (chrome.runtime.lastError) {
        console.log('[Theater Everywhere] Background page not ready, using default theme.');
        applyFallbackTheme();
        return;
      }

      if (response && response.theme) {
        applyBrowserTheme(response.theme);
      } else {
        applyFallbackTheme();
      }
    });
  } catch (e) {
    console.error('[Theater Everywhere] Failed to query theme:', e);
    applyFallbackTheme();
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
  const root = document.documentElement;
  // If AccentColor keyword is supported, let the CSS @supports handle it or apply explicitly:
  root.style.setProperty('--accent-color', 'var(--native-accent, AccentColor)');
  root.style.setProperty('--accent-text', 'var(--native-accent-text, AccentColorText)');
  root.style.setProperty('--accent-hover', 'color-mix(in srgb, var(--accent-color) 85%, black)');
}

function applyFallbackTheme() {
  // Let the default CSS rules or system color fallbacks take care of it
  applyAccentFallback();
}
