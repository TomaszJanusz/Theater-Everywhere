(function() {
  function findActiveVideo(root: Document | ShadowRoot): HTMLVideoElement | null {
    if (!root) return null;
    const video = root.querySelector('.theater-everywhere-video-active');
    if (video && video.tagName === 'VIDEO') return video as HTMLVideoElement;

    const hosts = root.querySelectorAll('*');
    for (const host of hosts) {
      if (host instanceof HTMLElement && host.shadowRoot) {
        const v = findActiveVideo(host.shadowRoot);
        if (v) return v;
      }
    }
    return null;
  }

  // Track video that needs AudioContext setup (deferred until real user gesture)
  let pendingVideo: HTMLVideoElement | null = null;
  let pendingMultiplier: number = 1.0;
  // Videos where Web Audio setup failed — don't retry
  const failedVideos = new WeakSet<HTMLVideoElement>();

  function setupAudioGraph(video: HTMLVideoElement): boolean {
    const boosted = video as any;
    if (boosted._theaterGainNode) return true; // Already initialized
    if (failedVideos.has(video)) return false; // Previously failed

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return false;

      const ctx = new AudioCtx();
      // crossOrigin is set preemptively in enterTheaterMode (content script),
      // so this should work without CORS issues.
      const source = ctx.createMediaElementSource(video);
      const gain = ctx.createGain();

      source.connect(gain);
      gain.connect(ctx.destination);

      boosted._theaterAudioCtx = ctx;
      boosted._theaterGainNode = gain;

      // Apply pending multiplier
      if (pendingVideo === video) {
        gain.gain.value = pendingMultiplier;
        pendingVideo = null;
      }

      if (ctx.state === 'suspended') {
        ctx.resume().catch(console.error);
      }

      return true;
    } catch (err) {
      console.error('[Theater Everywhere Main World] Web Audio setup failed:', err);
      failedVideos.add(video);
      return false;
    }
  }

  function applyPendingBoost(): void {
    if (!pendingVideo) return;
    setupAudioGraph(pendingVideo);
  }

  function resumeIfSuspended(): void {
    const video = findActiveVideo(document);
    if (!video) return;

    const ctx = (video as any)._theaterAudioCtx;
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(console.error);
    }
  }

  // Create/resume AudioContext on REAL user gestures (these carry user activation tokens).
  const onUserGesture = () => {
    applyPendingBoost();
    resumeIfSuspended();
  };

  window.addEventListener('click', onUserGesture, { capture: true, passive: true });
  window.addEventListener('keydown', onUserGesture, { capture: true, passive: true });
  window.addEventListener('pointerdown', onUserGesture, { capture: true, passive: true });

  // Also listen to 'input' events — slider drag fires these as real user gestures.
  window.addEventListener('input', (e) => {
    const target = e.target as HTMLElement | null;
    if (target && target.classList?.contains('theater-volume-slider')) {
      applyPendingBoost();
      resumeIfSuspended();
    }
  }, { capture: true, passive: true });

  // CustomEvent listener — adjusts gain.value if AudioContext already exists,
  // otherwise marks the video as pending for setup on next real user gesture.
  window.addEventListener('theater-everywhere-boost-event', () => {
    const video = findActiveVideo(document);
    if (!video) return;

    const multiplier = parseFloat(video.dataset.theaterBoost || '1.0');
    const boosted = video as any;

    if (boosted._theaterGainNode) {
      // AudioContext already running — just adjust gain
      boosted._theaterGainNode.gain.value = multiplier;

      if (boosted._theaterAudioCtx && boosted._theaterAudioCtx.state === 'suspended') {
        boosted._theaterAudioCtx.resume().catch(() => {});
      }
    } else if (multiplier > 1.0 && !failedVideos.has(video)) {
      // Boost requested but AudioContext not yet created.
      pendingVideo = video;
      pendingMultiplier = multiplier;
    }
  });
})();
