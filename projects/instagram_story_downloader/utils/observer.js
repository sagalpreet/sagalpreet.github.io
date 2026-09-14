/**
 * React SPA Navigation & DOM Mutation Observer for StorySaver - Instagram Story Downloader
 * Detects URL transitions, slide changes, and React DOM mutations without page reloads.
 */

class StoryObserver {
  constructor() {
    this.currentUrl = window.location.href;
    this.urlCheckInterval = null;
    this.mutationObserver = null;
    this.listeners = {
      onStoryChange: [],
      onDOMUpdate: []
    };
    this.isStoryActive = false;

    this.initHistoryInterception();
    this.initMutationObserver();
    this.initIntervalFallback();
  }

  /**
   * Registers callback for story URL / navigation changes
   * @param {Function} callback
   */
  onStoryChange(callback) {
    if (typeof callback === 'function') {
      this.listeners.onStoryChange.push(callback);
    }
  }

  /**
   * Registers callback for React DOM re-renders or updates
   * @param {Function} callback
   */
  onDOMUpdate(callback) {
    if (typeof callback === 'function') {
      this.listeners.onDOMUpdate.push(callback);
    }
  }

  /**
   * Intercepts History API (pushState, replaceState) and popstate events
   */
  initHistoryInterception() {
    const self = this;

    const originalPushState = history.pushState;
    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      self.handleUrlCheck();
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      self.handleUrlCheck();
    };

    window.addEventListener('popstate', () => {
      self.handleUrlCheck();
    });
  }

  /**
   * Initializes MutationObserver to monitor React DOM changes and story overlay mounting
   */
  initMutationObserver() {
    let debounceTimer = null;

    this.mutationObserver = new MutationObserver((mutations) => {
      // Check if URL changed during DOM mutation
      this.handleUrlCheck();

      // Debounce DOM update notifications for button persistence
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.notifyDOMUpdate();
      }, 150);
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false
    });
  }

  /**
   * Backup interval to ensure 100% reliable detection during fast key presses
   */
  initIntervalFallback() {
    this.urlCheckInterval = setInterval(() => {
      this.handleUrlCheck();
    }, 500);
  }

  /**
   * Evaluates if current URL is an Instagram Story page
   */
  isStoryPage() {
    return window.location.pathname.startsWith('/stories/');
  }

  /**
   * Compares current URL against cached URL and triggers listeners if changed
   */
  handleUrlCheck() {
    const newUrl = window.location.href;
    const isNowStory = this.isStoryPage();

    if (newUrl !== this.currentUrl || isNowStory !== this.isStoryActive) {
      const oldUrl = this.currentUrl;
      this.currentUrl = newUrl;
      this.isStoryActive = isNowStory;

      console.log('[StorySaver] Story navigation detected:', {
        url: newUrl,
        isStory: isNowStory
      });

      this.notifyStoryChange(newUrl, oldUrl, isNowStory);
    }
  }

  /**
   * Notifies registered story change listeners
   */
  notifyStoryChange(newUrl, oldUrl, isStory) {
    for (const fn of this.listeners.onStoryChange) {
      try {
        fn({ newUrl, oldUrl, isStory });
      } catch (err) {
        console.error('[StorySaver] Error in onStoryChange listener:', err);
      }
    }
  }

  /**
   * Notifies registered DOM update listeners
   */
  notifyDOMUpdate() {
    for (const fn of this.listeners.onDOMUpdate) {
      try {
        fn({ isStory: this.isStoryPage() });
      } catch (err) {
        console.error('[StorySaver] Error in onDOMUpdate listener:', err);
      }
    }
  }

  /**
   * Clean up observers and intervals
   */
  destroy() {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
    if (this.urlCheckInterval) {
      clearInterval(this.urlCheckInterval);
    }
  }
}

// Instantiate global observer on window
window.storyObserver = new StoryObserver();
