/**
 * Content Script Orchestrator for StorySaver - Instagram Story Downloader
 * Connects UI, Observer, Parser, and Downloader utilities.
 */

(() => {
  console.log('[StorySaver] Content script loaded.');

  // Inject main-world inject.js for performance fallback
  injectMainWorldScript();

  // Reference elements
  let downloadBtnWrapper = null;
  let downloadBtn = null;
  let btnTextEl = null;
  let btnIconContainer = null;
  let isExtracting = false;

  // SVG Icons
  const ICONS = {
    DOWNLOAD: `<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`,
    CHECK: `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`,
    ERROR: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`
  };

  /**
   * Inject inject.js into the main execution context
   */
  function injectMainWorldScript() {
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('inject.js');
      script.onload = () => script.remove();
      (document.head || document.documentElement).appendChild(script);
    } catch (e) {
      console.warn('[StorySaver] Could not inject main world script:', e);
    }
  }

  /**
   * Constructs the floating Download button DOM element
   */
  function createDownloadButton() {
    const wrapper = document.createElement('div');
    wrapper.className = 'ig-story-download-wrapper';

    const btn = document.createElement('button');
    btn.className = 'ig-story-download-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'StorySaver - Save Story');

    const iconSpan = document.createElement('span');
    iconSpan.className = 'ig-story-btn-icon';
    iconSpan.innerHTML = ICONS.DOWNLOAD;

    const labelSpan = document.createElement('span');
    labelSpan.className = 'ig-story-btn-label';
    labelSpan.textContent = 'Save';

    btn.appendChild(iconSpan);
    btn.appendChild(labelSpan);
    wrapper.appendChild(btn);

    btnIconContainer = iconSpan;
    btnTextEl = labelSpan;
    downloadBtn = btn;
    downloadBtnWrapper = wrapper;

    btn.addEventListener('click', handleDownloadClick);

    return wrapper;
  }

  /**
   * Main download click handler
   */
  async function handleDownloadClick(e) {
    e.preventDefault();
    e.stopPropagation();

    if (isExtracting) return;
    isExtracting = true;

    setButtonState('EXTRACTING', 'Saving...', ICONS.DOWNLOAD);

    const storyKey = window.location.pathname;

    try {
      // Step 1: Extract story media URL & metadata using 4-tier parser
      const mediaInfo = await window.storyParser.extractStoryMedia(storyKey);
      
      if (!mediaInfo || !mediaInfo.url) {
        throw new Error('Media URL could not be found for this story.');
      }

      setButtonState('DOWNLOADING', 'Saving...', ICONS.DOWNLOAD);

      // Step 2: Trigger download via chrome.downloads API in background service worker
      await window.storyDownloader.triggerDownload(mediaInfo);

      // Step 3: Success state
      setButtonState('SUCCESS', 'Saved!', ICONS.CHECK);
      showToast('success', `Saved story ${mediaInfo.username ? '@' + mediaInfo.username : ''}!`);

      setTimeout(() => {
        resetButtonState();
      }, 2500);

    } catch (err) {
      console.error('[StorySaver] Download workflow failed:', err);
      setButtonState('ERROR', 'Failed', ICONS.ERROR);
      showToast('error', err.message || 'Failed to save story.');

      setTimeout(() => {
        resetButtonState();
      }, 3500);
    } finally {
      isExtracting = false;
    }
  }

  /**
   * Updates button UI state, label, and icon
   */
  function setButtonState(state, text, iconHtml) {
    if (!downloadBtn) return;

    downloadBtn.className = 'ig-story-download-btn';
    
    if (state === 'EXTRACTING' || state === 'DOWNLOADING') {
      downloadBtn.classList.add('status-extracting');
      downloadBtn.disabled = true;
      btnIconContainer.innerHTML = `<span class="ig-story-spinner"></span>`;
    } else if (state === 'SUCCESS') {
      downloadBtn.classList.add('status-success');
      downloadBtn.disabled = true;
      btnIconContainer.innerHTML = iconHtml || ICONS.CHECK;
    } else if (state === 'ERROR') {
      downloadBtn.classList.add('status-error');
      downloadBtn.disabled = false;
      btnIconContainer.innerHTML = iconHtml || ICONS.ERROR;
    } else {
      downloadBtn.disabled = false;
      btnIconContainer.innerHTML = ICONS.DOWNLOAD;
    }

    if (btnTextEl) {
      btnTextEl.textContent = text;
    }
  }

  /**
   * Resets button back to default IDLE state
   */
  function resetButtonState() {
    if (!downloadBtn) return;
    downloadBtn.className = 'ig-story-download-btn';
    downloadBtn.disabled = false;
    btnIconContainer.innerHTML = ICONS.DOWNLOAD;
    btnTextEl.textContent = 'Save';
  }

  /**
   * Injects or re-attaches the download button into the Instagram Story UI
   */
  function ensureButtonInDOM() {
    if (!window.storyObserver.isStoryPage()) {
      if (downloadBtnWrapper && downloadBtnWrapper.parentNode) {
        downloadBtnWrapper.remove();
      }
      return;
    }

    if (!downloadBtnWrapper) {
      createDownloadButton();
    }

    // Check if button is already in DOM
    if (document.body.contains(downloadBtnWrapper)) {
      return;
    }

    // Target mounting containers in Instagram Story viewer UI
    const targetContainer = findTargetMountPoint();
    if (targetContainer) {
      downloadBtnWrapper.classList.remove('fixed-overlay');
      targetContainer.appendChild(downloadBtnWrapper);
      console.log('[StorySaver] Download button mounted into Story UI.');
    } else {
      // Guaranteed fixed overlay fallback on top-right of screen
      downloadBtnWrapper.classList.add('fixed-overlay');
      document.body.appendChild(downloadBtnWrapper);
      console.log('[StorySaver] Download button mounted via fixed overlay fallback.');
    }
  }

  /**
   * Locates best parent node to insert download button (e.g. story header controls bar)
   */
  function findTargetMountPoint() {
    // 1. Semantic SVG aria-label search (Pause, Play, Mute, Unmute, Options)
    const semanticIcon = document.querySelector(
      'svg[aria-label="Pause"], svg[aria-label="Play"], svg[aria-label="Mute"], svg[aria-label="Unmute"], svg[aria-label="Options"], svg[aria-label="More options"]'
    );
    if (semanticIcon) {
      const btnParent = semanticIcon.closest('button')?.parentElement;
      if (btnParent) return btnParent;
    }

    // 2. Look for story header controls (mute, pause, options buttons container)
    const headerControls = 
      document.querySelector('header section') ||
      document.querySelector('div[role="dialog"] header') ||
      document.querySelector('header div:last-child') ||
      document.querySelector('div._aca8') || // Story header container
      document.querySelector('div._ab6-');

    if (headerControls) return headerControls;

    // 3. Look for story top bar dialog element
    const dialogHeader = document.querySelector('div[role="dialog"] header');
    if (dialogHeader) return dialogHeader;

    return null;
  }

  /**
   * Displays toast notification feedback
   */
  function showToast(type, message) {
    let toastContainer = document.querySelector('.ig-story-toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'ig-story-toast-container';
      document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `ig-story-toast toast-${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('ig-story-toast-exit');
      setTimeout(() => {
        toast.remove();
        if (toastContainer.children.length === 0) {
          toastContainer.remove();
        }
      }, 300);
    }, 3000);
  }

  // Bind observer callbacks
  window.storyObserver.onStoryChange(({ newUrl, isStory }) => {
    if (isStory) {
      resetButtonState();
      ensureButtonInDOM();
    } else {
      if (downloadBtnWrapper && downloadBtnWrapper.parentNode) {
        downloadBtnWrapper.remove();
      }
    }
  });

  window.storyObserver.onDOMUpdate(({ isStory }) => {
    if (isStory) {
      ensureButtonInDOM();
    }
  });

  // Initial check on content script injection
  if (window.storyObserver.isStoryPage()) {
    ensureButtonInDOM();
  }
})();
