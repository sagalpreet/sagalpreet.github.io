/**
 * Background Service Worker for StorySaver - Instagram Story Downloader
 * Manifest V3
 */

// Listen for download requests from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'DOWNLOAD_MEDIA') {
    handleDownload(message.payload)
      .then((downloadId) => {
        sendResponse({ success: true, downloadId });
      })
      .catch((error) => {
        console.error('[StorySaver] Download failed:', error);
        sendResponse({ success: false, error: error.message || 'Download failed' });
      });
    
    // Return true to indicate asynchronous response
    return true;
  }
  
  if (message.action === 'PING') {
    sendResponse({ status: 'PONG' });
    return false;
  }
});

/**
 * Executes file download using chrome.downloads API
 * @param {Object} payload - { url, filename }
 * @returns {Promise<number>} Download ID
 */
async function handleDownload(payload) {
  const { url, filename } = payload;
  
  if (!url) {
    throw new Error('No media URL provided for download');
  }

  // Clean and sanitize filename
  const sanitizedFilename = sanitizeFilename(filename || 'storysaver_story.mp4');

  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      {
        url: url,
        filename: sanitizedFilename,
        saveAs: false,
        conflictAction: 'uniquify'
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (downloadId === undefined) {
          reject(new Error('Failed to initiate download'));
        } else {
          resolve(downloadId);
        }
      }
    );
  });
}

/**
 * Sanitizes filename to prevent invalid filesystem characters
 * @param {string} filename
 * @returns {string}
 */
function sanitizeFilename(filename) {
  // Replace invalid path characters with underscores
  return filename
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '');
}

console.log('[StorySaver] Background service worker initialized.');
