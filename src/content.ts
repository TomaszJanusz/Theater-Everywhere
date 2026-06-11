import './content.css';

interface Shortcuts {
  toggle: string;
  exit: string;
  seekBack: string;
  seekForward: string;
}

const defaultShortcuts: Shortcuts = {
  toggle: 'T',
  exit: 'Escape',
  seekBack: 'ArrowLeft',
  seekForward: 'ArrowRight'
};

let configuredShortcuts: Shortcuts = { ...defaultShortcuts };

let activeVideo: HTMLVideoElement | null = null;
let theaterElement: HTMLElement | null = null;
let ancestorsList: HTMLElement[] = [];
let isInitialized = false;
let toolbarTimer: ReturnType<typeof setTimeout> | null = null;

function matchesShortcut(e: KeyboardEvent, shortcutStr: string): boolean {
  if (!shortcutStr) return false;
  
  const parts = shortcutStr.split('+');
  const mainKey = parts[parts.length - 1];
  
  // Check main key (case insensitive comparison for single characters)
  const eventKey = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  if (eventKey !== mainKey) return false;
  
  // Check modifiers
  const hasCtrl = parts.includes('Ctrl');
  const hasAlt = parts.includes('Alt');
  const hasShift = parts.includes('Shift');
  const hasMeta = parts.includes('Meta');
  
  if (e.ctrlKey !== hasCtrl) return false;
  if (e.altKey !== hasAlt) return false;
  if (e.shiftKey !== hasShift) return false;
  if (e.metaKey !== hasMeta) return false;
  
  return true;
}

// Show/hide floating quick actions toolbar based on mouse activity
function showToolbar(): void {
  const controls = document.querySelector('.theater-controls-wrapper') as HTMLElement | null;
  if (!controls) return;
  
  controls.classList.add('visible');
  if (theaterElement && theaterElement.tagName === 'VIDEO') {
    theaterElement.classList.add('controls-visible');
  }
  document.body.style.cursor = 'default';
  
  if (toolbarTimer) clearTimeout(toolbarTimer);
  toolbarTimer = setTimeout(() => {
    const isScrubberDragging = document.querySelector('.theater-scrubber-container.dragging') !== null;
    if (controls && !controls.matches(':hover') && !isScrubberDragging && theaterElement) {
      controls.classList.remove('visible');
      if (theaterElement.tagName === 'VIDEO') {
        theaterElement.classList.remove('controls-visible');
      }
      // Also hide subtitles menu if open
      const ccMenu = controls.querySelector('.theater-cc-menu') as HTMLElement | null;
      if (ccMenu) {
        ccMenu.classList.remove('visible');
      }
      document.body.style.cursor = 'none';
    }
  }, 2500);
}

// Prevent custom player containers from double-toggling play/pause and handle clicks/pointers
function preventDoubleToggle(e: Event): void {
  if (!theaterElement) return;

  // Block double clicks completely to avoid site-level fullscreen conflicts
  if (e.type === 'dblclick') {
    console.log(`[Theater Everywhere] Intercepted double-click event. Blocking propagation...`);
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return;
  }
  
  console.log(`[Theater Everywhere] Intercepted pointer/mouse event: "${e.type}" on video surface.`);

  // Isolate completely
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  // Only toggle play/pause on 'click' to guarantee it happens exactly once per mouse release
  if (e.type === 'click' && theaterElement.tagName === 'VIDEO') {
    const video = theaterElement as HTMLVideoElement;
    console.log(`[Theater Everywhere] Click completed. Toggling playback state manually...`);
    if (video.paused) {
      video.play().catch(err => {
        console.error('[Theater Everywhere] Programmatic play failed:', err);
      });
    } else {
      video.pause();
    }
  }
}

interface Listeners {
  keydown: ((event: KeyboardEvent) => void) | null;
  mousemove: ((event: MouseEvent) => void) | null;
  play: ((event: Event) => void) | null;
  pause: ((event: Event) => void) | null;
  message: ((event: MessageEvent) => void) | null;
}

// Event listener references for clean removal
const listeners: Listeners = {
  keydown: null,
  mousemove: null,
  play: null,
  pause: null,
  message: null
};

// Check blacklist and initialize or destroy listeners
async function checkBlacklistAndInit(): Promise<void> {
  const currentHostname = window.location.hostname;
  
  try {
    const data = await chrome.storage.sync.get(['blacklist', 'shortcuts']);
    const blacklist = (data.blacklist || []) as string[];
    const saved = data.shortcuts || {};
    
    configuredShortcuts = {
      toggle: saved.toggle || defaultShortcuts.toggle,
      exit: saved.exit || defaultShortcuts.exit,
      seekBack: saved.seekBack || defaultShortcuts.seekBack,
      seekForward: saved.seekForward || defaultShortcuts.seekForward
    } as Shortcuts;
    
    const isBlacklisted = blacklist.some(domain => {
      return currentHostname === domain || currentHostname.endsWith('.' + domain);
    });

    if (isBlacklisted) {
      if (isInitialized) {
        destroy();
      }
    } else {
      if (!isInitialized) {
        initialize();
      }
    }
  } catch (err) {
    console.error('[Theater Everywhere] Error loading settings:', err);
    // Safe fallback: initialize if storage fails
    if (!isInitialized) {
      initialize();
    }
  }
}

function getActiveElementDeep(): Element | null {
  let activeEl = document.activeElement;
  while (activeEl && activeEl.shadowRoot && activeEl.shadowRoot.activeElement) {
    activeEl = activeEl.shadowRoot.activeElement;
  }
  return activeEl;
}

function handleVideoKey(e: KeyboardEvent, video: HTMLVideoElement) {
  const shortcuts = configuredShortcuts || defaultShortcuts;
  
  if (e.key === ' ' || e.key === 'Spacebar' || e.code === 'Space') {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    console.log('[Theater Everywhere] Spacebar detected inside theater mode. Toggling playback.');
    if (video.paused) {
      video.play().catch(err => {
        console.error('[Theater Everywhere] Play failed:', err);
      });
    } else {
      video.pause();
    }
  } else if (matchesShortcut(e, shortcuts.seekBack)) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    video.currentTime = Math.max(0, video.currentTime - 5);
    triggerSeekIndicator('left');
  } else if (matchesShortcut(e, shortcuts.seekForward)) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    video.currentTime = Math.min(video.duration, video.currentTime + 5);
    triggerSeekIndicator('right');
  } else if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key.toUpperCase() === 'N') {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    video.currentTime = Math.max(0, video.currentTime - 0.04);
    console.log('[Theater Everywhere] N key detected. Stepping 1 frame backward.');
  } else if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key.toUpperCase() === 'M') {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    video.currentTime = Math.min(video.duration, video.currentTime + 0.04);
    console.log('[Theater Everywhere] M key detected. Stepping 1 frame forward.');
  }
}

// Setup event listeners
function initialize(): void {
  if (isInitialized) return;

  // 1. Keyboard Listener (T and Escape)
  listeners.keydown = (event: KeyboardEvent) => {
    // Ignore key presses in inputs/textareas/editable elements (including inside Shadow DOM)
    const activeEl = getActiveElementDeep() as HTMLElement | null;
    const isEditable = activeEl && (
      (activeEl.tagName === 'INPUT' && !['range', 'checkbox', 'radio', 'button', 'submit', 'image', 'file'].includes((activeEl as HTMLInputElement).type)) ||
      activeEl.tagName === 'TEXTAREA' ||
      activeEl.isContentEditable ||
      activeEl.getAttribute('role') === 'textbox'
    );
    if (isEditable) return;

    const shortcuts = configuredShortcuts || defaultShortcuts;

    if (matchesShortcut(event, shortcuts.toggle)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      toggleTheaterMode();
    } else if (matchesShortcut(event, shortcuts.exit) || event.key === 'Escape' || event.key === 'Esc') {
      if (theaterElement) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        exitTheaterMode();
      }
    } else if (theaterElement) {
      if (theaterElement.tagName === 'VIDEO') {
        const video = theaterElement as HTMLVideoElement;
        handleVideoKey(event, video);
      } else if (theaterElement.tagName === 'IFRAME') {
        const iframe = theaterElement as HTMLIFrameElement;
        if (iframe.contentWindow) {
          iframe.contentWindow.postMessage({
            type: 'theater-everywhere-key',
            key: event.key,
            code: event.code,
            ctrlKey: event.ctrlKey,
            altKey: event.altKey,
            shiftKey: event.shiftKey,
            metaKey: event.metaKey
          }, '*');
          const keyUpper = event.key.toUpperCase();
          const isFrameStep = !event.ctrlKey && !event.altKey && !event.metaKey && (keyUpper === 'N' || keyUpper === 'M');
          if (event.key === ' ' || event.key === 'Spacebar' || event.code === 'Space' ||
              matchesShortcut(event, shortcuts.seekBack) ||
              matchesShortcut(event, shortcuts.seekForward) ||
              isFrameStep) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
          }
        }
      }
    }
  };
  window.addEventListener('keydown', listeners.keydown, true);

  // 2. Mouse Move Listener (Track video under cursor using elementsFromPoint)
  listeners.mousemove = (event: MouseEvent) => {
    try {
      const elements = document.elementsFromPoint(event.clientX, event.clientY);
      const video = elements.find(el => el && el.tagName === 'VIDEO') as HTMLVideoElement | undefined;
      if (video) {
        activeVideo = video;
      }
    } catch (e) {
      // elementsFromPoint might fail in edge cases
    }
  };
  document.addEventListener('mousemove', listeners.mousemove, { passive: true });

  // 3. Play/Pause event tracking
  listeners.play = (event: Event) => {
    if (event.target && (event.target as HTMLElement).tagName === 'VIDEO') {
      activeVideo = event.target as HTMLVideoElement;
      console.log(`[Theater Everywhere] Media event "play" detected on:`, event.target, `| paused:`, activeVideo.paused);
    }
  };
  document.addEventListener('play', listeners.play, true); // Use capture phase since 'play' does not bubble

  listeners.pause = (event: Event) => {
    if (event.target && (event.target as HTMLElement).tagName === 'VIDEO') {
      const video = event.target as HTMLVideoElement;
      console.log(`[Theater Everywhere] Media event "pause" detected on:`, video, `| paused:`, video.paused);
    }
  };
  document.addEventListener('pause', listeners.pause, true); // Use capture phase since 'pause' does not bubble

  // 4. Cross-iframe postMessage listener
  listeners.message = (event: MessageEvent) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'theater-everywhere-toggle') {
      // Toggle requested by parent
      toggleTheaterMode();
    } else if (data.type === 'theater-everywhere-enter') {
      // Child frame entered theater mode; find that iframe and expand it
      const iframes = document.querySelectorAll('iframe');
      for (const iframe of iframes) {
        if (iframe.contentWindow === event.source) {
          enterTheaterMode(iframe);
          break;
        }
      }
    } else if (data.type === 'theater-everywhere-exit') {
      // Child frame exited theater mode; restore that iframe
      const iframes = document.querySelectorAll('iframe');
      for (const iframe of iframes) {
        if (iframe.contentWindow === event.source) {
          exitTheaterMode();
          break;
        }
      }
    } else if (data.type === 'theater-everywhere-exit-down') {
      // Parent frame told us to exit theater mode
      exitTheaterMode();
    } else if (data.type === 'theater-everywhere-key') {
      if (theaterElement && theaterElement.tagName === 'VIDEO') {
        const video = theaterElement as HTMLVideoElement;
        handleVideoKey({
          key: data.key,
          code: data.code,
          ctrlKey: data.ctrlKey,
          altKey: data.altKey,
          shiftKey: data.shiftKey,
          metaKey: data.metaKey,
          preventDefault: () => {}
        } as KeyboardEvent, video);
      }
    }
  };
  window.addEventListener('message', listeners.message);

  isInitialized = true;
  console.log('[Theater Everywhere] Initialized on', window.location.hostname);
}

// Cleanup and remove listeners
function destroy(): void {
  if (!isInitialized) return;

  if (theaterElement) {
    exitTheaterMode();
  }

  if (listeners.keydown) window.removeEventListener('keydown', listeners.keydown, true);
  if (listeners.mousemove) document.removeEventListener('mousemove', listeners.mousemove);
  if (listeners.play) document.removeEventListener('play', listeners.play, true);
  if (listeners.pause) document.removeEventListener('pause', listeners.pause, true);
  if (listeners.message) window.removeEventListener('message', listeners.message);

  isInitialized = false;
  console.log('[Theater Everywhere] Deinitialized from', window.location.hostname);
}

// Smart video selection algorithm
function findBestVideo(): HTMLVideoElement | null {
  // If the currently tracked active video is still in the DOM and visible
  if (activeVideo && document.body.contains(activeVideo) && activeVideo.offsetWidth > 0) {
    return activeVideo;
  }

  const videos = Array.from(document.querySelectorAll('video'));
  if (videos.length === 0) return null;
  if (videos.length === 1) return videos[0];

  // 1. Try to find the playing video
  const playingVideos = videos.filter(v => !v.paused && !v.ended && v.readyState > 2);
  if (playingVideos.length > 0) {
    // Return largest playing video
    return playingVideos.reduce((largest, current) => {
      const areaL = largest.offsetWidth * largest.offsetHeight;
      const areaC = current.offsetWidth * current.offsetHeight;
      return areaC > areaL ? current : largest;
    }, playingVideos[0]);
  }

  // 2. Return the largest video in the DOM
  return videos.reduce((largest, current) => {
    const areaL = largest.offsetWidth * largest.offsetHeight;
    const areaC = current.offsetWidth * current.offsetHeight;
    return areaC > areaL ? current : largest;
  }, videos[0]);
}

// Toggle theater mode on or off
function toggleTheaterMode(): void {
  if (theaterElement) {
    exitTheaterMode();
  } else {
    const video = findBestVideo();
    if (video) {
      enterTheaterMode(video);
    } else {
      // No video found locally, ask child iframes to toggle
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        if (iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'theater-everywhere-toggle' }, '*');
        }
      });
    }
  }
}

// Enter theater mode
function enterTheaterMode(element: HTMLElement): void {
  if (theaterElement) return;

  theaterElement = element;
  theaterElement.classList.add('theater-everywhere-video-active');

  // Specific setup for HTML5 <video> elements
  if (theaterElement.tagName === 'VIDEO') {
    const video = theaterElement as HTMLVideoElement;
    // Save original controls attribute state
    const originalControls = video.hasAttribute('controls');
    video.dataset.originalControls = originalControls ? 'true' : 'false';
    
    // Hide browser native controls so we use our custom controls overlay instead
    video.removeAttribute('controls');

    // Force loading of paused/unloaded videos to display the initial frame instead of a gray/black screen
    if (video.readyState === 0) {
      console.log('[Theater Everywhere] Video has readyState = 0. Force setting preload="auto" and calling load().');
      video.preload = 'auto';
      video.load();
    }

    // Isolate pointer and mouse events to block double-toggles in custom players
    const eventTypes = ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup'];
    eventTypes.forEach(type => {
      video.addEventListener(type, preventDoubleToggle, true);
    });

    // Create and inject our unified bottom player controls
    createCustomControls(video);
  }

  // Traverse ancestors and apply override class
  ancestorsList = [];
  let parent = theaterElement.parentElement;
  while (parent && parent !== document.documentElement) {
    parent.classList.add('theater-everywhere-parent-active');
    ancestorsList.push(parent);
    parent = parent.parentElement;
  }

  // Lock scrollbars on body/html
  document.body.classList.add('theater-everywhere-body-active');
  document.documentElement.classList.add('theater-everywhere-html-active');

  // If we are in an iframe, notify the parent document to expand the iframe itself
  if (window !== window.top) {
    window.parent.postMessage({ type: 'theater-everywhere-enter' }, '*');
  }
}

// Exit theater mode
function exitTheaterMode(): void {
  if (!theaterElement) return;

  // Restore HTML5 video attributes
  if (theaterElement.tagName === 'VIDEO') {
    const video = theaterElement as HTMLVideoElement;
    const originalControls = video.dataset.originalControls;
    if (originalControls === 'true') {
      video.setAttribute('controls', 'true');
    } else {
      video.removeAttribute('controls');
    }
    delete video.dataset.originalControls;

    // Clean up event isolation blockers
    const eventTypes = ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup'];
    eventTypes.forEach(type => {
      video.removeEventListener(type, preventDoubleToggle, true);
    });

    // Clean up custom controls
    destroyCustomControls();
    video.classList.remove('controls-visible');
  }

  theaterElement.classList.remove('theater-everywhere-video-active');

  // Restore ancestors styling
  ancestorsList.forEach(parent => {
    if (parent && parent.classList) {
      parent.classList.remove('theater-everywhere-parent-active');
    }
  });
  ancestorsList = [];

  // Restore scrollbars
  document.body.classList.remove('theater-everywhere-body-active');
  document.documentElement.classList.remove('theater-everywhere-html-active');

  // If this was an iframe, propagate exit to child window inside it
  if (theaterElement.tagName === 'IFRAME') {
    const iframe = theaterElement as HTMLIFrameElement;
    try {
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'theater-everywhere-exit-down' }, '*');
      }
    } catch (e) {
      // Ignore cross-origin exceptions
    }
  }

  // If we are in an iframe, notify parent to restore iframe size
  if (window !== window.top) {
    window.parent.postMessage({ type: 'theater-everywhere-exit' }, '*');
  }

  theaterElement = null;
}

// Listen to state changes from the extension popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'statusChanged') {
    checkBlacklistAndInit();
    sendResponse({ success: true });
  }
});

// Run blacklist check and apply theme on load
checkBlacklistAndInit();
fetchAndApplyTheme();

interface ExtendedHTMLDivElement extends HTMLDivElement {
  _videoListenersCleanup?: () => void;
}

// Creates unified bottom player controls
function createCustomControls(video: HTMLVideoElement): void {
  destroyCustomControls();

  const wrapper = document.createElement('div') as ExtendedHTMLDivElement;
  wrapper.className = 'theater-controls-wrapper';

  // Create loading indicator
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'theater-loading-indicator';
  
  const loadingSpinner = document.createElement('div');
  loadingSpinner.className = 'theater-loading-spinner';
  
  loadingIndicator.appendChild(loadingSpinner);
  
  document.body.appendChild(loadingIndicator);

  // Prevent event propagation so clicking controls doesn't trigger parent actions or play/pause
  wrapper.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  wrapper.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    e.stopImmediatePropagation();
  });
  wrapper.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });

  // 1. Scrubber (Progress bar)
  const scrubberContainer = document.createElement('div');
  scrubberContainer.className = 'theater-scrubber-container';

  const scrubberTrack = document.createElement('div');
  scrubberTrack.className = 'theater-scrubber-track';

  const scrubberBuffer = document.createElement('div');
  scrubberBuffer.className = 'theater-scrubber-buffer';

  const scrubberFill = document.createElement('div');
  scrubberFill.className = 'theater-scrubber-fill';

  const scrubberHandle = document.createElement('div');
  scrubberHandle.className = 'theater-scrubber-handle';

  scrubberTrack.appendChild(scrubberBuffer);
  scrubberTrack.appendChild(scrubberFill);
  scrubberTrack.appendChild(scrubberHandle);
  scrubberContainer.appendChild(scrubberTrack);

  const tooltip = document.createElement('div');
  tooltip.className = 'theater-scrubber-tooltip';
  scrubberContainer.appendChild(tooltip);

  // 2. Control Row
  const controlsRow = document.createElement('div');
  controlsRow.className = 'theater-controls-row';

  // Left Controls Section
  const leftSec = document.createElement('div');
  leftSec.className = 'theater-controls-left';

  // Play/Pause Button
  const playPauseBtn = document.createElement('button');
  playPauseBtn.className = 'theater-control-btn play-pause-btn';
  playPauseBtn.title = 'Play / Pause';

  const playIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3"></polygon>
    </svg>
  `;
  const pauseIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" rx="1"></rect>
      <rect x="14" y="4" width="4" height="16" rx="1"></rect>
    </svg>
  `;

  playPauseBtn.innerHTML = video.paused ? playIcon : pauseIcon;
  playPauseBtn.addEventListener('click', () => {
    if (video.paused) {
      video.play().catch(console.error);
    } else {
      video.pause();
    }
  });

  // Volume Container
  const volumeContainer = document.createElement('div');
  volumeContainer.className = 'theater-volume-container';

  const volumeBtn = document.createElement('button');
  volumeBtn.className = 'theater-control-btn volume-btn';
  volumeBtn.title = 'Mute';

  const volumeSlider = document.createElement('input');
  volumeSlider.type = 'range';
  volumeSlider.className = 'theater-volume-slider';
  volumeSlider.min = '0';
  volumeSlider.max = '1';
  volumeSlider.step = '0.05';
  volumeSlider.value = video.muted ? '0' : String(video.volume);

  const volHighIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
    </svg>
  `;
  const volLowIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
    </svg>
  `;
  const volMutedIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
      <line x1="23" y1="9" x2="17" y2="15"></line>
      <line x1="17" y1="9" x2="23" y2="15"></line>
    </svg>
  `;

  const updateVolumeIcon = () => {
    if (video.muted || video.volume === 0) {
      volumeBtn.innerHTML = volMutedIcon;
      volumeBtn.title = 'Unmute';
    } else if (video.volume < 0.5) {
      volumeBtn.innerHTML = volLowIcon;
      volumeBtn.title = 'Mute';
    } else {
      volumeBtn.innerHTML = volHighIcon;
      volumeBtn.title = 'Mute';
    }
  };
  updateVolumeIcon();

  const updateVolumeSliderFill = () => {
    const val = video.muted ? 0 : video.volume;
    const pct = val * 100;
    const accentColor = 'var(--accent-color, #6366f1)';
    const grad = `linear-gradient(to right, ${accentColor} 0%, ${accentColor} ${pct}%, rgba(255, 255, 255, 0.2) ${pct}%, rgba(255, 255, 255, 0.2) 100%)`;
    volumeSlider.style.setProperty('background', grad, 'important');
  };
  updateVolumeSliderFill();

  const volumeTooltip = document.createElement('div');
  volumeTooltip.className = 'theater-volume-tooltip';
  volumeContainer.appendChild(volumeTooltip);

  const updateVolumeTooltip = () => {
    const val = video.muted ? 0 : video.volume;
    const pct = val * 100;
    volumeTooltip.textContent = `${Math.round(pct)}%`;
    volumeTooltip.style.left = `${36 + (pct / 100) * 60}px`;
  };

  const showVolumeTooltip = () => {
    volumeTooltip.classList.add('visible');
    updateVolumeTooltip();
  };
  const hideVolumeTooltip = () => {
    volumeTooltip.classList.remove('visible');
  };

  volumeContainer.addEventListener('mouseenter', showVolumeTooltip);
  volumeContainer.addEventListener('mouseleave', hideVolumeTooltip);
  volumeSlider.addEventListener('focus', showVolumeTooltip);
  volumeSlider.addEventListener('blur', hideVolumeTooltip);

  volumeBtn.addEventListener('click', () => {
    video.muted = !video.muted;
  });

  volumeSlider.addEventListener('input', (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    video.volume = val;
    if (val > 0 && video.muted) {
      video.muted = false;
    }
    updateVolumeSliderFill();
    updateVolumeTooltip();
  });

  volumeContainer.appendChild(volumeBtn);
  volumeContainer.appendChild(volumeSlider);

  // Time label display
  const timeDisplay = document.createElement('span');
  timeDisplay.className = 'theater-time-display';
  timeDisplay.style.cursor = 'pointer';
  timeDisplay.textContent = '0:00 / 0:00';

  const formatTime = (secs: number): string => {
    if (isNaN(secs) || !isFinite(secs)) return '0:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    const sStr = s < 10 ? '0' + s : String(s);
    if (h > 0) {
      const mStr = m < 10 ? '0' + m : String(m);
      return `${h}:${mStr}:${sStr}`;
    }
    return `${m}:${sStr}`;
  };

  let showRemainingTime = false;
  timeDisplay.addEventListener('click', (e) => {
    e.stopPropagation();
    showRemainingTime = !showRemainingTime;
    updateTimeDisplay();
  });

  const updateTimeDisplay = () => {
    const cur = video.currentTime || 0;
    const dur = video.duration || 0;
    if (showRemainingTime) {
      const remaining = Math.max(0, dur - cur);
      timeDisplay.textContent = `-${formatTime(remaining)} / ${formatTime(dur)}`;
    } else {
      timeDisplay.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
    }
  };
  updateTimeDisplay();

  leftSec.appendChild(playPauseBtn);
  leftSec.appendChild(volumeContainer);
  leftSec.appendChild(timeDisplay);

  // Right Controls Section
  const rightSec = document.createElement('div');
  rightSec.className = 'theater-controls-right';

  // Playback Speed Controls
  const speedContainer = document.createElement('div');
  speedContainer.className = 'theater-speed-container';

  const speedBtn = document.createElement('button');
  speedBtn.className = 'theater-control-btn speed-btn';
  speedBtn.title = 'Playback Speed';

  const speedLabel = document.createElement('span');
  speedLabel.className = 'speed-label';
  speedBtn.appendChild(speedLabel);

  const speedLevels = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
  const getSpeedIndex = (rate: number): number => {
    let closestIdx = 3; // default to 1.0
    let minDiff = Infinity;
    for (let i = 0; i < speedLevels.length; i++) {
      const diff = Math.abs(speedLevels[i] - rate);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }
    return closestIdx;
  };

  const updateSpeedLabelText = () => {
    speedLabel.textContent = video.playbackRate.toFixed(2).replace(/\.00$|\.0$/, '') + 'x';
  };
  updateSpeedLabelText();

  const speedSliderWrapper = document.createElement('div');
  speedSliderWrapper.className = 'theater-speed-slider-wrapper';

  const speedSlider = document.createElement('input');
  speedSlider.type = 'range';
  speedSlider.className = 'theater-speed-slider';
  speedSlider.min = '0';
  speedSlider.max = String(speedLevels.length - 1);
  speedSlider.step = '1';
  speedSlider.value = String(getSpeedIndex(video.playbackRate));

  const speedTick1x = document.createElement('div');
  speedTick1x.className = 'speed-tick-1x';
  speedTick1x.title = 'Normal speed (1x)';

  speedSliderWrapper.appendChild(speedSlider);
  speedSliderWrapper.appendChild(speedTick1x);

  const speedTooltip = document.createElement('div');
  speedTooltip.className = 'theater-speed-tooltip';

  speedContainer.appendChild(speedBtn);
  speedContainer.appendChild(speedSliderWrapper);
  speedContainer.appendChild(speedTooltip);

  let lastNonNormalSpeed = 1.5;

  const updateSpeedSliderFill = () => {
    const idx = getSpeedIndex(video.playbackRate);
    const pct = (idx / (speedLevels.length - 1)) * 100;
    const accentColor = 'var(--accent-color, #6366f1)';
    const grad = `linear-gradient(to right, ${accentColor} 0%, ${accentColor} ${pct}%, rgba(255, 255, 255, 0.2) ${pct}%, rgba(255, 255, 255, 0.2) 100%)`;
    speedSlider.style.setProperty('background', grad, 'important');
  };
  updateSpeedSliderFill();

  const updateSpeedTooltip = () => {
    speedTooltip.textContent = `${video.playbackRate.toFixed(2).replace(/\.00$|\.0$/, '')}x`;
    const idx = getSpeedIndex(video.playbackRate);
    const pct = (idx / (speedLevels.length - 1)) * 100;
    speedTooltip.style.left = `${36 + (pct / 100) * 60}px`;
  };

  speedBtn.addEventListener('click', () => {
    if (video.playbackRate !== 1.0) {
      lastNonNormalSpeed = video.playbackRate;
      video.playbackRate = 1.0;
    } else {
      video.playbackRate = lastNonNormalSpeed;
    }
  });

  speedSlider.addEventListener('input', (e) => {
    const idx = parseInt((e.target as HTMLInputElement).value, 10);
    const rate = speedLevels[idx];
    video.playbackRate = rate;
    if (rate !== 1.0) {
      lastNonNormalSpeed = rate;
    }
    updateSpeedSliderFill();
    updateSpeedTooltip();
  });

  const showSpeedTooltip = () => {
    speedTooltip.classList.add('visible');
    updateSpeedTooltip();
  };
  const hideSpeedTooltip = () => {
    speedTooltip.classList.remove('visible');
  };

  speedContainer.addEventListener('mouseenter', showSpeedTooltip);
  speedContainer.addEventListener('mouseleave', hideSpeedTooltip);
  speedSlider.addEventListener('focus', showSpeedTooltip);
  speedSlider.addEventListener('blur', hideSpeedTooltip);
  speedSlider.addEventListener('input', updateSpeedTooltip);

  // PiP Button
  const pipBtn = document.createElement('button');
  pipBtn.className = 'theater-control-btn pip-btn';
  pipBtn.title = 'Picture-in-Picture';
  pipBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
      <rect x="13" y="11" width="7" height="7" rx="1" ry="1"></rect>
    </svg>
  `;
  pipBtn.addEventListener('click', () => {
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(console.error);
    } else {
      video.requestPictureInPicture().catch(console.error);
    }
  });

  // Fullscreen Button
  const fullscreenBtn = document.createElement('button');
  fullscreenBtn.className = 'theater-control-btn fullscreen-btn';
  fullscreenBtn.title = 'Fullscreen';

  const enterFullscreenIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
    </svg>
  `;
  const exitFullscreenIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 14h6v6m10-6h-6v6M4 10h6V4m10 6h-6V4"></path>
    </svg>
  `;

  fullscreenBtn.innerHTML = document.fullscreenElement ? exitFullscreenIcon : enterFullscreenIcon;

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(console.error);
    } else {
      const target = video.parentElement || video;
      target.requestFullscreen().catch(() => {
        video.requestFullscreen().catch(console.error);
      });
    }
  };

  fullscreenBtn.addEventListener('click', () => {
    toggleFullscreen();
  });

  const onFullscreenChange = () => {
    fullscreenBtn.innerHTML = document.fullscreenElement ? exitFullscreenIcon : enterFullscreenIcon;
  };
  document.addEventListener('fullscreenchange', onFullscreenChange);

  // Close Button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'theater-control-btn close-btn';
  closeBtn.title = 'Exit Theater Mode';
  closeBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  `;
  closeBtn.addEventListener('click', () => {
    exitTheaterMode();
  });

  // Subtitles / CC Button
  const ccBtn = document.createElement('button');
  ccBtn.className = 'theater-control-btn cc-btn';
  ccBtn.title = 'Subtitles / Captions';
  ccBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2"></rect>
      <path d="M7 10a2 2 0 0 1 4 0v4a2 2 0 0 1-4 0M14 10a2 2 0 0 1 4 0v4a2 2 0 0 1-4 0"></path>
    </svg>
  `;

  const ccMenu = document.createElement('div');
  ccMenu.className = 'theater-cc-menu';
  wrapper.appendChild(ccMenu);

  const checkCCActive = () => {
    const tracks = video.textTracks;
    const hasTracks = tracks && tracks.length > 0;
    
    if (!hasTracks) {
      ccBtn.classList.add('disabled');
      ccBtn.style.opacity = '0.35';
      ccBtn.style.pointerEvents = 'none';
      ccBtn.title = 'No subtitles available';
    } else {
      ccBtn.classList.remove('disabled');
      ccBtn.style.opacity = '';
      ccBtn.style.pointerEvents = '';
      ccBtn.title = 'Subtitles / Captions';
    }

    let isAnyShowing = false;
    if (tracks) {
      for (let i = 0; i < tracks.length; i++) {
        if (tracks[i].mode === 'showing') {
          isAnyShowing = true;
          break;
        }
      }
    }
    if (isAnyShowing) {
      ccBtn.classList.add('active');
    } else {
      ccBtn.classList.remove('active');
    }
  };

  const handleTrackChange = () => {
    checkCCActive();
    updateCCMenu();
  };

  if (video.textTracks) {
    video.textTracks.addEventListener('change', checkCCActive);
    video.textTracks.addEventListener('addtrack', handleTrackChange);
    video.textTracks.addEventListener('removetrack', handleTrackChange);
  }
  checkCCActive();

  const updateCCMenu = () => {
    ccMenu.innerHTML = '';
    const tracks = video.textTracks;
    
    if (!tracks || tracks.length === 0) {
      const item = document.createElement('div');
      item.className = 'theater-cc-menu-item';
      item.textContent = 'No subtitles';
      item.style.opacity = '0.5';
      item.style.cursor = 'default';
      ccMenu.appendChild(item);
      return;
    }
    
    // Add "Off" option
    const offItem = document.createElement('button');
    offItem.className = 'theater-cc-menu-item';
    offItem.textContent = 'Off';
    
    let isAnyShowing = false;
    for (let i = 0; i < tracks.length; i++) {
      if (tracks[i].mode === 'showing') {
        isAnyShowing = true;
      }
    }
    
    if (!isAnyShowing) {
      offItem.classList.add('active');
      const checkIcon = document.createElement('span');
      checkIcon.innerHTML = '✓';
      checkIcon.style.marginLeft = '8px';
      offItem.appendChild(checkIcon);
    }
    
    offItem.addEventListener('click', () => {
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].mode = 'disabled';
      }
      updateCCMenu();
      checkCCActive();
      ccMenu.classList.remove('visible');
    });
    ccMenu.appendChild(offItem);
    
    // Add each track
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      const item = document.createElement('button');
      item.className = 'theater-cc-menu-item';
      
      const label = track.label || track.language || `Track ${i + 1}`;
      item.textContent = label;
      
      if (track.mode === 'showing') {
        item.classList.add('active');
        const checkIcon = document.createElement('span');
        checkIcon.innerHTML = '✓';
        checkIcon.style.marginLeft = '8px';
        item.appendChild(checkIcon);
      }
      
      item.addEventListener('click', () => {
        for (let j = 0; j < tracks.length; j++) {
          tracks[j].mode = j === i ? 'showing' : 'disabled';
        }
        updateCCMenu();
        checkCCActive();
        ccMenu.classList.remove('visible');
      });
      ccMenu.appendChild(item);
    }
  };

  ccBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!ccMenu.classList.contains('visible')) {
      updateCCMenu();
      ccMenu.classList.add('visible');
      
      // Position menu relative to the CC button
      const rect = ccBtn.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      ccMenu.style.right = `${wrapperRect.right - rect.right}px`;
      ccMenu.style.bottom = `${rect.height + 10}px`;
    } else {
      ccMenu.classList.remove('visible');
    }
  });

  const onDocumentClick = (e: MouseEvent) => {
    if (ccMenu.classList.contains('visible') && !ccMenu.contains(e.target as Node) && !ccBtn.contains(e.target as Node)) {
      ccMenu.classList.remove('visible');
    }
  };
  window.addEventListener('click', onDocumentClick, true);

  const onWindowBlur = () => {
    ccMenu.classList.remove('visible');
  };
  window.addEventListener('blur', onWindowBlur);

  rightSec.appendChild(ccBtn);
  rightSec.appendChild(speedContainer);
  rightSec.appendChild(pipBtn);
  rightSec.appendChild(fullscreenBtn);
  rightSec.appendChild(closeBtn);

  controlsRow.appendChild(leftSec);
  controlsRow.appendChild(scrubberContainer);
  controlsRow.appendChild(rightSec);

  wrapper.appendChild(controlsRow);

  document.body.appendChild(wrapper);

  // Scrubber updates
  let isDragging = false;
  let lastSeekTime = 0;
  let seekTimeout: number | null = null;
  let lastLoggedBufPct = -1;

  const throttledSeek = (time: number) => {
    const now = Date.now();
    if (now - lastSeekTime >= 100) {
      video.currentTime = time;
      lastSeekTime = now;
      if (seekTimeout) {
        clearTimeout(seekTimeout);
        seekTimeout = null;
      }
    } else {
      if (seekTimeout) clearTimeout(seekTimeout);
      seekTimeout = window.setTimeout(() => {
        video.currentTime = time;
        lastSeekTime = Date.now();
      }, 100 - (now - lastSeekTime));
    }
  };

  const updateScrubber = () => {
    const dur = video.duration || 0;
    const cur = video.currentTime || 0;
    
    let bufPct = 0;
    // Update buffering progress
    if (dur > 0 && video.buffered && video.buffered.length > 0) {
      let bufferedEnd = cur;
      for (let i = 0; i < video.buffered.length; i++) {
        const start = video.buffered.start(i);
        const end = video.buffered.end(i);
        if (cur >= start && cur <= end) {
          bufferedEnd = end;
          break;
        }
      }
      bufPct = (bufferedEnd / dur) * 100;
      scrubberBuffer.style.width = `${bufPct}%`;
    } else {
      scrubberBuffer.style.width = '0%';
    }

    const roundedBufPct = Math.round(bufPct);
    if (roundedBufPct !== lastLoggedBufPct) {
      lastLoggedBufPct = roundedBufPct;
      console.log(`[Theater Everywhere] Scrubber buffer updated: ${lastLoggedBufPct}%, currentTime: ${cur.toFixed(2)}s, duration: ${dur.toFixed(2)}s, readyState: ${video.readyState}, buffered ranges: ${video.buffered ? video.buffered.length : 0}`);
    }

    if (isDragging || video.seeking) return;
    const pct = dur > 0 ? (cur / dur) * 100 : 0;
    scrubberFill.style.width = `${pct}%`;
    scrubberHandle.style.left = `${pct}%`;
  };
  updateScrubber();

  const updateTooltip = (clientX: number) => {
    const rect = scrubberContainer.getBoundingClientRect();
    if (rect.width === 0) return;
    
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const duration = video.duration || 0;
    const time = pos * duration;
    
    tooltip.textContent = formatTime(time);
    const leftPx = pos * rect.width;
    tooltip.style.left = `${leftPx}px`;
    tooltip.classList.add('visible');
  };

  const onScrubberMouseMove = (e: MouseEvent) => {
    if (isDragging) return;
    updateTooltip(e.clientX);
  };

  const onScrubberMouseLeave = () => {
    if (!isDragging) {
      tooltip.classList.remove('visible');
    }
  };

  scrubberContainer.addEventListener('mousemove', onScrubberMouseMove);
  scrubberContainer.addEventListener('mouseleave', onScrubberMouseLeave);

  const handleSeekEvent = (clientX: number, seekMode: 'none' | 'immediate' | 'throttled' = 'none') => {
    const rect = scrubberContainer.getBoundingClientRect();
    if (rect.width === 0) return 0;
    
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const pct = pos * 100;
    scrubberFill.style.width = `${pct}%`;
    scrubberHandle.style.left = `${pct}%`;
    
    const duration = video.duration;
    if (isNaN(duration) || !isFinite(duration) || duration <= 0) {
      return 0;
    }
    
    const targetTime = pos * duration;
    if (showRemainingTime) {
      const remaining = Math.max(0, duration - targetTime);
      timeDisplay.textContent = `-${formatTime(remaining)} / ${formatTime(duration)}`;
    } else {
      timeDisplay.textContent = `${formatTime(targetTime)} / ${formatTime(duration)}`;
    }
    
    if (isDragging) {
      updateTooltip(clientX);
    }
    
    if (seekMode === 'immediate') {
      if (seekTimeout) {
        clearTimeout(seekTimeout);
        seekTimeout = null;
      }
      video.currentTime = targetTime;
      lastSeekTime = Date.now();
    } else if (seekMode === 'throttled') {
      throttledSeek(targetTime);
    }
    
    return targetTime;
  };

  const onScrubberMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    isDragging = true;
    scrubberContainer.classList.add('dragging');
    handleSeekEvent(e.clientX, 'immediate');
    
    const onMouseMove = (moveEvt: MouseEvent) => {
      handleSeekEvent(moveEvt.clientX, 'throttled');
    };

    const onMouseUp = (upEvt: MouseEvent) => {
      handleSeekEvent(upEvt.clientX, 'immediate');
      
      const onSeeked = () => {
        isDragging = false;
        scrubberContainer.classList.remove('dragging');
        video.removeEventListener('seeked', onSeeked);
        
        // Hide tooltip if cursor is not over the scrubber container
        const rect = scrubberContainer.getBoundingClientRect();
        if (
          upEvt.clientX < rect.left ||
          upEvt.clientX > rect.right ||
          upEvt.clientY < rect.top ||
          upEvt.clientY > rect.bottom
        ) {
          tooltip.classList.remove('visible');
        }
      };
      video.addEventListener('seeked', onSeeked);
      
      setTimeout(() => {
        isDragging = false;
        scrubberContainer.classList.remove('dragging');
        video.removeEventListener('seeked', onSeeked);
        
        // Hide tooltip if cursor is not over the scrubber container
        const rect = scrubberContainer.getBoundingClientRect();
        if (
          upEvt.clientX < rect.left ||
          upEvt.clientX > rect.right ||
          upEvt.clientY < rect.top ||
          upEvt.clientY > rect.bottom
        ) {
          tooltip.classList.remove('visible');
        }
      }, 150);

      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('mouseup', onMouseUp, true);
    };

    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('mouseup', onMouseUp, true);
  };

  scrubberContainer.addEventListener('mousedown', onScrubberMouseDown);

  const onScrubberTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    isDragging = true;
    scrubberContainer.classList.add('dragging');
    handleSeekEvent(e.touches[0].clientX, 'immediate');

    const onTouchMove = (moveEvt: TouchEvent) => {
      if (moveEvt.touches.length === 1) {
        handleSeekEvent(moveEvt.touches[0].clientX, 'throttled');
      }
    };

    const onTouchEnd = (endEvt: TouchEvent) => {
      if (endEvt.changedTouches.length === 1) {
        handleSeekEvent(endEvt.changedTouches[0].clientX, 'immediate');
      }
      const onSeeked = () => {
        isDragging = false;
        scrubberContainer.classList.remove('dragging');
        video.removeEventListener('seeked', onSeeked);
        tooltip.classList.remove('visible');
      };
      video.addEventListener('seeked', onSeeked);
      
      setTimeout(() => {
        isDragging = false;
        scrubberContainer.classList.remove('dragging');
        video.removeEventListener('seeked', onSeeked);
        tooltip.classList.remove('visible');
      }, 150);

      document.removeEventListener('touchmove', onTouchMove, true);
      document.removeEventListener('touchend', onTouchEnd, true);
    };

    document.addEventListener('touchmove', onTouchMove, { capture: true, passive: true });
    document.addEventListener('touchend', onTouchEnd, true);
  };
  scrubberContainer.addEventListener('touchstart', onScrubberTouchStart, { passive: true });

  // Buffering / Loading State Helper
  let bufferingTimeout: number | null = null;

  const setBuffering = (isBuffering: boolean) => {
    if (isBuffering) {
      if (bufferingTimeout || loadingIndicator.classList.contains('visible')) return;
      bufferingTimeout = window.setTimeout(() => {
        loadingIndicator.classList.add('visible');
        scrubberContainer.classList.add('buffering');
        bufferingTimeout = null;
      }, 1000);
    } else {
      if (bufferingTimeout) {
        clearTimeout(bufferingTimeout);
        bufferingTimeout = null;
      }
      loadingIndicator.classList.remove('visible');
      scrubberContainer.classList.remove('buffering');
    }
  };

  // Event hookups
  const onPlay = () => { 
    playPauseBtn.innerHTML = pauseIcon; 
    setBuffering(false);
  };
  const onPause = () => { playPauseBtn.innerHTML = playIcon; };
  const onTimeUpdate = () => { 
    updateScrubber(); 
    updateTimeDisplay(); 
    if (!video.paused && !video.seeking && video.readyState >= 3) {
      setBuffering(false);
    }
  };
  const onProgress = () => { updateScrubber(); };
  const onDurationChange = () => { updateScrubber(); updateTimeDisplay(); };
  const onVolumeChange = () => {
    volumeSlider.value = video.muted ? '0' : String(video.volume);
    updateVolumeIcon();
    updateVolumeSliderFill();
  };
  const onRateChange = () => {
    updateSpeedLabelText();
    speedSlider.value = String(getSpeedIndex(video.playbackRate));
    updateSpeedSliderFill();
  };
  
  const onWaiting = () => { setBuffering(true); };
  const onSeeking = () => { setBuffering(true); };
  const onSeeked = () => { 
    updateScrubber(); 
    updateTimeDisplay(); 
    setBuffering(false); 
  };
  const onCanPlay = () => { setBuffering(false); };
  const onPlaying = () => { setBuffering(false); };
  const onStalled = () => {
    if (!video.paused) {
      setBuffering(true);
    }
  };

  video.addEventListener('play', onPlay);
  video.addEventListener('pause', onPause);
  video.addEventListener('timeupdate', onTimeUpdate);
  video.addEventListener('progress', onProgress);
  video.addEventListener('seeked', onSeeked);
  video.addEventListener('durationchange', onDurationChange);
  video.addEventListener('volumechange', onVolumeChange);
  video.addEventListener('ratechange', onRateChange);
  video.addEventListener('waiting', onWaiting);
  video.addEventListener('seeking', onSeeking);
  video.addEventListener('canplay', onCanPlay);
  video.addEventListener('playing', onPlaying);
  video.addEventListener('stalled', onStalled);

  wrapper._videoListenersCleanup = () => {
    video.removeEventListener('play', onPlay);
    video.removeEventListener('pause', onPause);
    video.removeEventListener('timeupdate', onTimeUpdate);
    video.removeEventListener('progress', onProgress);
    video.removeEventListener('seeked', onSeeked);
    video.removeEventListener('durationchange', onDurationChange);
    video.removeEventListener('volumechange', onVolumeChange);
    video.removeEventListener('ratechange', onRateChange);
    video.removeEventListener('waiting', onWaiting);
    video.removeEventListener('seeking', onSeeking);
    video.removeEventListener('canplay', onCanPlay);
    video.removeEventListener('playing', onPlaying);
    video.removeEventListener('stalled', onStalled);
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    if (bufferingTimeout) {
      clearTimeout(bufferingTimeout);
      bufferingTimeout = null;
    }
    if (video.textTracks) {
      video.textTracks.removeEventListener('change', checkCCActive);
      video.textTracks.removeEventListener('addtrack', handleTrackChange);
      video.textTracks.removeEventListener('removetrack', handleTrackChange);
    }
    window.removeEventListener('click', onDocumentClick, true);
    window.removeEventListener('blur', onWindowBlur);
    loadingIndicator.remove();
  };

  // Setup mousemove listeners
  document.addEventListener('mousemove', showToolbar, { passive: true });
  showToolbar();
}

// Cleans up custom controls
function destroyCustomControls(): void {
  const wrapper = document.querySelector('.theater-controls-wrapper') as ExtendedHTMLDivElement | null;
  if (wrapper) {
    if (wrapper._videoListenersCleanup) {
      wrapper._videoListenersCleanup();
    }
    wrapper.remove();
  }
  
  document.removeEventListener('mousemove', showToolbar);
  if (toolbarTimer) clearTimeout(toolbarTimer);
  document.body.style.cursor = 'default';
}

// Triggers and animates the seek overlay indicator (YouTube-style)
function triggerSeekIndicator(direction: 'left' | 'right'): void {
  if (!theaterElement) return;

  // If an overlay already exists in that direction, remove it to reset the animation
  const existing = document.querySelector(`.theater-everywhere-seek-overlay.${direction}`) as HTMLElement | null;
  if (existing) {
    existing.remove();
  }

  const overlay = document.createElement('div');
  overlay.className = `theater-everywhere-seek-overlay ${direction} animate`;

  const iconWrapper = document.createElement('div');
  iconWrapper.className = 'seek-icon-wrapper';

  if (direction === 'left') {
    iconWrapper.innerHTML = `
      <div class="seek-arrow left left-3"></div>
      <div class="seek-arrow left left-2"></div>
      <div class="seek-arrow left left-1"></div>
    `;
    overlay.appendChild(iconWrapper);

    const textSpan = document.createElement('span');
    textSpan.textContent = '5 seconds';
    overlay.appendChild(textSpan);
  } else {
    iconWrapper.innerHTML = `
      <div class="seek-arrow right right-1"></div>
      <div class="seek-arrow right right-2"></div>
      <div class="seek-arrow right right-3"></div>
    `;
    overlay.appendChild(iconWrapper);

    const textSpan = document.createElement('span');
    textSpan.textContent = '5 seconds';
    overlay.appendChild(textSpan);
  }

  document.body.appendChild(overlay);

  // Automatically remove after animation completes
  setTimeout(() => {
    if (overlay && overlay.parentNode) {
      overlay.remove();
    }
  }, 650);
}

// Browser theme application functions (inlined to prevent ES module imports in classic content script context)
function fetchAndApplyTheme() {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
    applyFallbackTheme();
    return;
  }

  try {
    chrome.runtime.sendMessage({ action: 'getBrowserTheme' }, (response: any) => {
      if (chrome.runtime.lastError) {
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

  const bg = colors.popup || colors.toolbar || colors.frame || colors.accentcolor || colors.ntp_background;
  setVar('--bg-color', bg);

  const cardBg = colors.tab_selected || colors.toolbar_field || colors.toolbar || colors.popup;
  setVar('--card-bg', cardBg);

  const border = colors.popup_border || colors.toolbar_field_border || colors.sidebar_border;
  setVar('--border-color', border);

  const textPrimary = colors.popup_text || colors.toolbar_text || colors.textcolor || colors.toolbar_field_text || colors.ntp_text;
  setVar('--text-primary', textPrimary);

  if (textPrimary && bg) {
    root.style.setProperty('--text-secondary', `color-mix(in srgb, ${textPrimary} 70%, ${bg})`);
  }

  const accent = colors.tab_line || colors.popup_border || colors.sidebar_border;
  if (accent) {
    setVar('--accent-color', accent);
    root.style.setProperty('--accent-hover', `color-mix(in srgb, ${accent} 85%, black)`);
  } else {
    applyAccentFallback();
  }
}

function applyAccentFallback() {
  const root = document.documentElement;
  root.style.setProperty('--accent-color', 'var(--native-accent, AccentColor)');
  root.style.setProperty('--accent-text', 'var(--native-accent-text, AccentColorText)');
  root.style.setProperty('--accent-hover', 'color-mix(in srgb, var(--accent-color) 85%, black)');
}

function applyFallbackTheme() {
  applyAccentFallback();
}
