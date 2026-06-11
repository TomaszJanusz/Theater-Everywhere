import './content.css';

let activeVideo: HTMLVideoElement | null = null;
let theaterElement: HTMLElement | null = null;
let ancestorsList: HTMLElement[] = [];
let isInitialized = false;
let toolbarTimer: ReturnType<typeof setTimeout> | null = null;

// Show/hide floating quick actions toolbar based on mouse activity
function showToolbar(): void {
  const toolbar = document.querySelector('.theater-everywhere-toolbar') as HTMLElement | null;
  if (!toolbar) return;
  
  toolbar.classList.add('visible');
  
  if (toolbarTimer) clearTimeout(toolbarTimer);
  toolbarTimer = setTimeout(() => {
    if (toolbar && !toolbar.matches(':hover')) {
      toolbar.classList.remove('visible');
    }
  }, 2500);
}

// Prevent custom player containers from double-toggling play/pause and handle clicks/pointers
function preventDoubleToggle(e: Event): void {
  if (!theaterElement) return;

  const rect = theaterElement.getBoundingClientRect();
  const mouseEvent = e as MouseEvent;
  const clickY = mouseEvent.clientY - rect.top;

  // Block double clicks completely to avoid site-level fullscreen conflicts
  if (e.type === 'dblclick') {
    console.log(`[Theater Everywhere] Intercepted double-click event. Blocking propagation...`);
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return;
  }
  
  console.log(`[Theater Everywhere] Intercepted pointer/mouse event: "${e.type}" | Y-coord: ${clickY}px (height: ${rect.height}px)`);

  // If event is in the top portion (main video surface), isolate completely
  if (clickY < rect.height - 60) {
    console.log(`[Theater Everywhere] Blocking propagation of event "${e.type}" on video surface...`);
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
  } else {
    // Event is on the controls bar. Let native controls process it, block bubbling only
    console.log(`[Theater Everywhere] Passing event "${e.type}" to native controls bar and blocking bubble-up...`);
    e.stopPropagation();
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
    const data = await chrome.storage.sync.get({ blacklist: [] });
    const blacklist = (data.blacklist || []) as string[];
    
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

// Setup event listeners
function initialize(): void {
  if (isInitialized) return;

  // 1. Keyboard Listener (T and Escape)
  listeners.keydown = (event: KeyboardEvent) => {
    // Ignore key presses in inputs/textareas/editable elements
    const activeEl = document.activeElement as HTMLElement | null;
    const isEditable = activeEl && (
      activeEl.tagName === 'INPUT' ||
      activeEl.tagName === 'TEXTAREA' ||
      activeEl.isContentEditable ||
      activeEl.getAttribute('role') === 'textbox'
    );
    if (isEditable) return;

    if (event.key.toLowerCase() === 't') {
      event.preventDefault();
      toggleTheaterMode();
    } else if (event.key === 'Escape') {
      if (theaterElement) {
        event.preventDefault();
        exitTheaterMode();
      }
    } else if (theaterElement && theaterElement.tagName === 'VIDEO') {
      const video = theaterElement as HTMLVideoElement;
      // Seek keys (ArrowLeft / ArrowRight) in theater mode
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 5);
        triggerSeekIndicator('left');
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        video.currentTime = Math.min(video.duration, video.currentTime + 5);
        triggerSeekIndicator('right');
      }
    }
  };
  document.addEventListener('keydown', listeners.keydown, true);

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

  if (listeners.keydown) document.removeEventListener('keydown', listeners.keydown, true);
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
    
    // Enable browser native controls so the video remains controllable in theater mode
    if (!originalControls) {
      video.setAttribute('controls', 'true');
    }

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

    // Create and inject the floating overlay toolbar for quick actions (PiP, Speed, Close)
    createQuickActionsToolbar(video);
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
    if (originalControls === 'false') {
      video.removeAttribute('controls');
    }
    delete video.dataset.originalControls;

    // Clean up event isolation blockers
    const eventTypes = ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup'];
    eventTypes.forEach(type => {
      video.removeEventListener(type, preventDoubleToggle, true);
    });

    // Clean up toolbar
    destroyQuickActionsToolbar();
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

// Run blacklist check on load
checkBlacklistAndInit();

interface ExtendedHTMLButtonElement extends HTMLButtonElement {
  _rateChangeHandler?: () => void;
}

// Creates floating overlay toolbar
function createQuickActionsToolbar(video: HTMLVideoElement): void {
  // If it already exists, remove it
  destroyQuickActionsToolbar();

  const toolbar = document.createElement('div');
  toolbar.className = 'theater-everywhere-toolbar';

  // Playback speed cycle list
  const speeds = [1.0, 1.25, 1.5, 1.75, 2.0, 0.5];
  
  // 1. Speed button
  const speedBtn = document.createElement('button') as ExtendedHTMLButtonElement;
  speedBtn.className = 'theater-btn speed-btn';
  speedBtn.title = 'Cycle Playback Speed';
  
  const speedLabel = document.createElement('span');
  speedLabel.className = 'speed-label';
  // Set initial text
  const updateSpeedLabelText = () => {
    speedLabel.textContent = video.playbackRate.toFixed(2).replace(/\.00$|\.0$/, '') + 'x';
  };
  updateSpeedLabelText();
  speedBtn.appendChild(speedLabel);

  // Speed click handler
  speedBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    let currentIdx = speeds.indexOf(video.playbackRate);
    if (currentIdx === -1) currentIdx = 0;
    const nextIdx = (currentIdx + 1) % speeds.length;
    video.playbackRate = speeds[nextIdx];
  });

  // Track rate change events (in case changed from other controls/menus)
  video.addEventListener('ratechange', updateSpeedLabelText);
  // Save ratechange reference for cleanup
  speedBtn._rateChangeHandler = updateSpeedLabelText;

  // 2. Picture-in-Picture Button
  const pipBtn = document.createElement('button');
  pipBtn.className = 'theater-btn pip-btn';
  pipBtn.title = 'Picture-in-Picture';
  pipBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
      <rect x="13" y="11" width="7" height="7" rx="1" ry="1"></rect>
    </svg>
  `;
  
  pipBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(console.error);
    } else {
      video.requestPictureInPicture().catch(console.error);
    }
  });

  // 3. Exit button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'theater-btn close-btn';
  closeBtn.title = 'Exit Theater Mode';
  closeBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  `;
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    exitTheaterMode();
  });

  toolbar.appendChild(speedBtn);
  toolbar.appendChild(pipBtn);
  toolbar.appendChild(closeBtn);
  
  if (video.parentElement) {
    video.parentElement.appendChild(toolbar);
  }

  // Bind mousemove to show toolbar
  document.addEventListener('mousemove', showToolbar, { passive: true });
  
  // Show immediately
  showToolbar();
}

// Cleans up the toolbar
function destroyQuickActionsToolbar(): void {
  const toolbar = document.querySelector('.theater-everywhere-toolbar') as HTMLElement | null;
  if (toolbar) {
    const speedBtn = toolbar.querySelector('.speed-btn') as ExtendedHTMLButtonElement | null;
    if (speedBtn && speedBtn._rateChangeHandler && theaterElement) {
      theaterElement.removeEventListener('ratechange', speedBtn._rateChangeHandler);
    }
    toolbar.remove();
  }
  
  document.removeEventListener('mousemove', showToolbar);
  if (toolbarTimer) clearTimeout(toolbarTimer);
}

// Triggers and animates the seek overlay indicator (YouTube-style)
function triggerSeekIndicator(direction: 'left' | 'right'): void {
  if (!theaterElement || !theaterElement.parentElement) return;

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

  theaterElement.parentElement.appendChild(overlay);

  // Automatically remove after animation completes
  setTimeout(() => {
    if (overlay && overlay.parentNode) {
      overlay.remove();
    }
  }, 650);
}
