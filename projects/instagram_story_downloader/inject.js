/**
 * Main World Injected Script for Instagram Story Media Downloader
 * Runs in the context of instagram.com to query main-world APIs if necessary.
 */

(() => {
  if (window.__igStoryDownloaderInjected) return;
  window.__igStoryDownloaderInjected = true;

  /**
   * Periodically reports recent media resource entries to content script
   */
  function sendPerformanceEntries() {
    try {
      if (!window.performance || !window.performance.getEntriesByType) return;

      const entries = window.performance.getEntriesByType('resource') || [];
      const mediaEntries = entries
        .filter(e => 
          e.name && 
          (e.name.includes('.mp4') || e.name.includes('.jpg') || e.name.includes('.webp')) &&
          (e.name.includes('fbcdn.net') || e.name.includes('cdninstagram.com'))
        )
        .map(e => ({ name: e.name, initiatorType: e.initiatorType, startTime: e.startTime }));

      window.postMessage({
        type: 'IG_STORY_PERFORMANCE_DATA',
        entries: mediaEntries
      }, '*');
    } catch (_) {}
  }

  // Report performance entries periodically
  setInterval(sendPerformanceEntries, 1000);
})();
