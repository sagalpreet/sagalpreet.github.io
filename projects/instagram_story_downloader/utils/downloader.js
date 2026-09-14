/**
 * Download Orchestrator for StorySaver - Instagram Story Downloader
 * Communicates with Background Service Worker via Chrome Messaging
 */

class StoryDownloader {
  constructor() {
    this.state = 'IDLE'; // 'IDLE' | 'EXTRACTING' | 'DOWNLOADING' | 'SUCCESS' | 'ERROR'
  }

  /**
   * Triggers download of story media
   * @param {Object} mediaInfo - { url, type, username, id }
   * @returns {Promise<void>}
   */
  async triggerDownload(mediaInfo) {
    if (!mediaInfo || !mediaInfo.url) {
      throw new Error('Invalid media information for download');
    }

    this.state = 'DOWNLOADING';
    const filename = this.generateFilename(mediaInfo);

    console.log('[StorySaver] Requesting background download:', {
      filename,
      type: mediaInfo.type,
      url: mediaInfo.url.substring(0, 80) + '...'
    });

    try {
      const response = await this.sendMessageToBackground({
        action: 'DOWNLOAD_MEDIA',
        payload: {
          url: mediaInfo.url,
          filename: filename
        }
      });

      if (response && response.success) {
        this.state = 'SUCCESS';
        console.log('[StorySaver] Download initiated successfully. ID:', response.downloadId);
        return response;
      } else {
        this.state = 'ERROR';
        throw new Error(response?.error || 'Download failed to start');
      }
    } catch (err) {
      this.state = 'ERROR';
      console.error('[StorySaver] Download execution error:', err);
      throw err;
    }
  }

  /**
   * Generates formatted filename according to project specifications:
   * storysaver_username_YYYY-MM-DD.mp4 or storysaver_username_YYYY-MM-DD.jpg
   * @param {Object} mediaInfo
   * @returns {string}
   */
  generateFilename(mediaInfo) {
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const username = (mediaInfo.username || this.extractUsernameFromUrl() || '').trim().toLowerCase();
    const extension = mediaInfo.type === 'image' ? 'jpg' : 'mp4';

    if (username && username !== 'instagram_user') {
      return `storysaver_${username}_${dateStr}.${extension}`;
    }

    return `storysaver_story_${dateStr}.${extension}`;
  }

  /**
   * Helper to parse username from current URL path
   * @returns {string|null}
   */
  extractUsernameFromUrl() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts[0] === 'stories' && parts[1]) {
      return parts[1];
    }
    return null;
  }

  /**
   * Promise wrapper for chrome.runtime.sendMessage
   */
  sendMessageToBackground(message) {
    return new Promise((resolve, reject) => {
      if (!chrome.runtime || !chrome.runtime.sendMessage) {
        reject(new Error('Extension runtime context unavailable'));
        return;
      }

      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }
}

// Instantiate global downloader on window
window.storyDownloader = new StoryDownloader();
