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

  // Synchronous custom event listener to retain user gesture token
  window.addEventListener('theater-everywhere-boost-event', () => {
    const video = findActiveVideo(document);
    if (!video) return;

    const multiplier = parseFloat(video.dataset.theaterBoost || '1.0');

    const boostedVideo = video as any;
    let audioCtx = boostedVideo._theaterAudioCtx;
    let gainNode = boostedVideo._theaterGainNode;

    if (!gainNode) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;

        audioCtx = new AudioContextClass();
        const sourceNode = audioCtx.createMediaElementSource(video);
        gainNode = audioCtx.createGain();

        sourceNode.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        boostedVideo._theaterAudioCtx = audioCtx;
        boostedVideo._theaterGainNode = gainNode;
      } catch (err) {
        console.error('[Theater Everywhere Main World] Web Audio setup failed:', err);
        return;
      }
    }

    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(console.error);
    }
    gainNode.gain.value = multiplier;
  });

  // Fallback global event listeners to resume context on any user interaction
  const resumeAll = () => {
    const video = findActiveVideo(document);
    if (video && (video as any)._theaterAudioCtx) {
      const ctx = (video as any)._theaterAudioCtx;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(console.error);
      }
    }
  };
  window.addEventListener('click', resumeAll, { capture: true, passive: true });
  window.addEventListener('keydown', resumeAll, { capture: true, passive: true });
})();
