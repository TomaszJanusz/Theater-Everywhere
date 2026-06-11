/* Content script for Theater Everywhere extension */

let activeVideo = null;
let theaterElement = null;
let ancestorsList = [];
let isInitialized = false;

// Prevent custom player containers from double-toggling play/pause and handle clicks/pointers
function preventDoubleToggle(e) {
  if (!theaterElement) return;

  const rect = theaterElement.getBoundingClientRect();
  const clickY = e.clientY - rect.top;

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
      console.log(`[Theater Everywhere] Click completed. Toggling playback state manually...`);
      if (theaterElement.paused) {
        theaterElement.play().catch(err => {
          console.error('[Theater Everywhere] Programmatic play failed:', err);
        });
      } else {
        theaterElement.pause();
      }
    }
  } else {
    // Event is on the controls bar. Let native controls process it, block bubbling only
    console.log(`[Theater Everywhere] Passing event "${e.type}" to native controls bar and blocking bubble-up...`);
    e.stopPropagation();
  }
}

// Event listener references for clean removal
const listeners = {
  keydown: null,
  mousemove: null,
  play: null,
  pause: null,
  message: null
};

// Check blacklist and initialize or destroy listeners
async function checkBlacklistAndInit() {
  const currentHostname = window.location.hostname;
  
  try {
    const data = await chrome.storage.sync.get({ blacklist: [] });
    const blacklist = data.blacklist || [];
    
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
function initialize() {
  if (isInitialized) return;

  // 1. Keyboard Listener (T and Escape)
  listeners.keydown = (event) => {
    // Ignore key presses in inputs/textareas/editable elements
    const activeEl = document.activeElement;
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
    }
  };
  document.addEventListener('keydown', listeners.keydown, true);

  // 2. Mouse Move Listener (Track video under cursor using elementsFromPoint)
  listeners.mousemove = (event) => {
    try {
      const elements = document.elementsFromPoint(event.clientX, event.clientY);
      const video = elements.find(el => el && el.tagName === 'VIDEO');
      if (video) {
        activeVideo = video;
      }
    } catch (e) {
      // elementsFromPoint might fail in edge cases
    }
  };
  document.addEventListener('mousemove', listeners.mousemove, { passive: true });

  // 3. Play/Pause event tracking
  listeners.play = (event) => {
    if (event.target && event.target.tagName === 'VIDEO') {
      activeVideo = event.target;
      console.log(`[Theater Everywhere] Media event "play" detected on:`, event.target, `| paused:`, event.target.paused);
    }
  };
  document.addEventListener('play', listeners.play, true); // Use capture phase since 'play' does not bubble

  listeners.pause = (event) => {
    if (event.target && event.target.tagName === 'VIDEO') {
      console.log(`[Theater Everywhere] Media event "pause" detected on:`, event.target, `| paused:`, event.target.paused);
    }
  };
  document.addEventListener('pause', listeners.pause, true); // Use capture phase since 'pause' does not bubble

  // 4. Cross-iframe postMessage listener
  listeners.message = (event) => {
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
function destroy() {
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
function findBestVideo() {
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
function toggleTheaterMode() {
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
        iframe.contentWindow.postMessage({ type: 'theater-everywhere-toggle' }, '*');
      });
    }
  }
}

// Enter theater mode
function enterTheaterMode(element) {
  if (theaterElement) return;

  theaterElement = element;
  theaterElement.classList.add('theater-everywhere-video-active');

  // Specific setup for HTML5 <video> elements
  if (theaterElement.tagName === 'VIDEO') {
    // Save original controls attribute state
    const originalControls = theaterElement.hasAttribute('controls');
    theaterElement.dataset.originalControls = originalControls ? 'true' : 'false';
    
    // Enable browser native controls so the video remains controllable in theater mode
    if (!originalControls) {
      theaterElement.setAttribute('controls', 'true');
    }

    // Isolate pointer and mouse events to block double-toggles in custom players
    const eventTypes = ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup'];
    eventTypes.forEach(type => {
      theaterElement.addEventListener(type, preventDoubleToggle, true);
    });
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
function exitTheaterMode() {
  if (!theaterElement) return;

  // Restore HTML5 video attributes
  if (theaterElement.tagName === 'VIDEO') {
    const originalControls = theaterElement.dataset.originalControls;
    if (originalControls === 'false') {
      theaterElement.removeAttribute('controls');
    }
    delete theaterElement.dataset.originalControls;

    // Clean up event isolation blockers
    const eventTypes = ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup'];
    eventTypes.forEach(type => {
      theaterElement.removeEventListener(type, preventDoubleToggle, true);
    });
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
    try {
      theaterElement.contentWindow.postMessage({ type: 'theater-everywhere-exit-down' }, '*');
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
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'statusChanged') {
    checkBlacklistAndInit();
    sendResponse({ success: true });
  }
});

// Run blacklist check on load
checkBlacklistAndInit();
