/**
 * Layered Media Extraction Engine for StorySaver - Instagram Story Downloader
 * Modular & Robust implementation supporting Manifest V3
 */

class StoryParser {
  constructor() {
    // Cache for extracted media to prevent redundant parsing
    this.cache = new Map();
    // Storage for performance entry fallback data received from inject.js
    this.performanceEntries = [];
    
    // Listen for performance entry messages from inject.js if present
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'IG_STORY_PERFORMANCE_DATA') {
        this.performanceEntries = event.data.entries || [];
      }
    });
  }

  /**
   * Main entry point to extract story media
   * @param {string} storyKey - Unique key for current story (e.g., URL path or story ID)
   * @returns {Promise<{ url: string, type: 'video' | 'image', filename: string }>}
   */
  async extractStoryMedia(storyKey) {
    if (storyKey && this.cache.has(storyKey)) {
      console.log('[StorySaver] Serving media from cache:', storyKey);
      return this.cache.get(storyKey);
    }

    console.log('[StorySaver] Initiating media extraction for key:', storyKey);

    let result = null;

    // Strategy 1: Embedded Story JSON (Preferred)
    try {
      result = await this.extractFromEmbeddedJSON();
      if (result) {
        console.log('[StorySaver] Strategy 1 (Embedded JSON) succeeded.');
      }
    } catch (err) {
      console.warn('[StorySaver] Strategy 1 failed:', err);
    }

    // Strategy 2: Escaped DASH Manifest Regex (Discovery Script Fallback)
    if (!result) {
      try {
        result = await this.extractFromDASHRegex();
        if (result) {
          console.log('[StorySaver] Strategy 2 (DASH Regex) succeeded.');
        }
      } catch (err) {
        console.warn('[StorySaver] Strategy 2 failed:', err);
      }
    }

    // Strategy 3: Performance API Entries Fallback
    if (!result) {
      try {
        result = await this.extractFromPerformanceEntries();
        if (result) {
          console.log('[StorySaver] Strategy 3 (Performance API) succeeded.');
        }
      } catch (err) {
        console.warn('[StorySaver] Strategy 3 failed:', err);
      }
    }

    // Strategy 4: DOM Inspection Fallback
    if (!result) {
      try {
        result = await this.extractFromDOM();
        if (result) {
          console.log('[StorySaver] Strategy 4 (DOM Inspection) succeeded.');
        }
      } catch (err) {
        console.warn('[StorySaver] Strategy 4 failed:', err);
      }
    }

    if (!result) {
      throw new Error('Unable to extract story media using any strategy.');
    }

    // Cache result if key provided
    if (storyKey) {
      this.cache.set(storyKey, result);
    }

    return result;
  }

  /**
   * Strategy 1: Parse embedded JSON structures in document scripts
   */
  async extractFromEmbeddedJSON() {
    const scripts = document.querySelectorAll('script');
    const storyItems = [];

    for (const script of scripts) {
      const content = script.textContent;
      if (!content) continue;

      // Quick preliminary check before heavy JSON parsing
      if (
        content.includes('video_versions') ||
        content.includes('video_dash_manifest') ||
        content.includes('image_versions2') ||
        content.includes('display_resources')
      ) {
        // Attempt to extract JSON blocks or objects
        const foundItems = this.findStoryItemsInScript(content);
        if (foundItems && foundItems.length > 0) {
          storyItems.push(...foundItems);
        }
      }
    }

    if (storyItems.length === 0) {
      return null;
    }

    // Identify current story item based on active story URL or latest active item
    const activeItem = this.findMatchingStoryItem(storyItems);
    if (!activeItem) return null;

    return this.processStoryItem(activeItem);
  }

  /**
   * Recursively locate story media item objects within parsed script objects
   */
  findStoryItemsInScript(scriptText) {
    const items = [];
    
    // Check if script is a direct JSON string in application/json
    try {
      const parsed = JSON.parse(scriptText);
      this.traverseObjectForItems(parsed, items);
      if (items.length > 0) return items;
    } catch (_) {
      // Script is executable JS with embedded JSON
    }

    // Match JSON objects inside script text
    const jsonMatches = scriptText.match(/\{"items":\s*\[.*?\]/g) || 
                        scriptText.match(/\{"video_versions":.*?\}/g) ||
                        scriptText.match(/\{"image_versions2":.*?\}/g);

    if (jsonMatches) {
      for (const jsonStr of jsonMatches) {
        try {
          const parsed = JSON.parse(jsonStr);
          this.traverseObjectForItems(parsed, items);
        } catch (_) {}
      }
    }

    return items;
  }

  /**
   * Helper to traverse object hierarchy to find Instagram story items
   */
  traverseObjectForItems(obj, itemsFound, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 15) return;

    if (
      (obj.video_versions || obj.video_dash_manifest || obj.image_versions2 || obj.display_resources) &&
      (obj.id || obj.pk || obj.code || obj.user)
    ) {
      itemsFound.push(obj);
      return;
    }

    if (Array.isArray(obj)) {
      for (const elem of obj) {
        this.traverseObjectForItems(elem, itemsFound, depth + 1);
      }
    } else {
      for (const key of Object.keys(obj)) {
        this.traverseObjectForItems(obj[key], itemsFound, depth + 1);
      }
    }
  }

  /**
   * Match current active story item from extracted items list
   */
  findMatchingStoryItem(items) {
    const currentPath = window.location.pathname;
    
    // If URL contains story ID e.g. /stories/username/123456789/
    const pathParts = currentPath.split('/').filter(Boolean);
    const storyIdFromUrl = pathParts.length >= 3 ? pathParts[2] : null;

    if (storyIdFromUrl) {
      const exactMatch = items.find(item => 
        String(item.id).includes(storyIdFromUrl) || 
        String(item.pk).includes(storyIdFromUrl)
      );
      if (exactMatch) return exactMatch;
    }

    // Fallback: return the first item or item matching username
    return items[0];
  }

  /**
   * Processes an Instagram story metadata object to get the highest quality URL
   */
  processStoryItem(item) {
    const username = item.user?.username || item.owner?.username || this.getStoryUsernameFromUrl();
    const isVideo = Boolean(item.is_video || item.video_versions?.length || item.video_dash_manifest);

    // Rule: Handle image stories with music converted to MP4
    // If original still image candidate exists in metadata, prefer original image over video
    const imageCandidate = this.getHighestResImage(item.image_versions2 || item.display_resources || item.image_candidates);

    if (isVideo) {
      // Check if original still image exists and story is an image with audio overlay
      if (imageCandidate && item.story_is_saved_to_archive === false && !item.video_versions?.length) {
        return {
          url: imageCandidate.url,
          type: 'image',
          username: username,
          id: item.id || item.pk
        };
      }

      // Process video representations
      let bestVideoUrl = null;

      if (item.video_versions && item.video_versions.length > 0) {
        // Sort by area (width * height) descending
        const sortedVideos = [...item.video_versions].sort((a, b) => {
          const areaA = (a.width || 0) * (a.height || 0);
          const areaB = (b.width || 0) * (b.height || 0);
          return areaB - areaA;
        });
        bestVideoUrl = sortedVideos[0].url;
      }

      // Check DASH manifest if video_versions absent or for higher 1080p stream
      if (!bestVideoUrl && item.video_dash_manifest) {
        bestVideoUrl = this.parseDASHManifestXML(item.video_dash_manifest);
      }

      if (bestVideoUrl) {
        return {
          url: bestVideoUrl,
          type: 'video',
          username: username,
          id: item.id || item.pk
        };
      }
    }

    // Handle Image Stories
    if (imageCandidate) {
      return {
        url: imageCandidate.url,
        type: 'image',
        username: username,
        id: item.id || item.pk
      };
    }

    return null;
  }

  /**
   * Finds highest resolution image from candidates/resources array
   */
  getHighestResImage(imageData) {
    if (!imageData) return null;
    const candidates = imageData.candidates || imageData.display_resources || (Array.isArray(imageData) ? imageData : null);
    if (!candidates || candidates.length === 0) return null;

    const sorted = [...candidates].sort((a, b) => {
      const areaA = (a.width || a.config_width || 0) * (a.height || a.config_height || 0);
      const areaB = (b.width || b.config_width || 0) * (b.height || b.config_height || 0);
      return areaB - areaA;
    });

    const best = sorted[0];
    return {
      url: best.url || best.src,
      width: best.width || best.config_width,
      height: best.height || best.config_height
    };
  }

  /**
   * Extract video URL from DASH manifest XML string
   */
  parseDASHManifestXML(xmlString) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
      const baseUrls = Array.from(xmlDoc.querySelectorAll('BaseURL')).map(node => node.textContent);
      
      if (baseUrls.length > 0) {
        // Usually the last representation in Instagram DASH manifest is the highest quality
        return baseUrls[baseUrls.length - 1];
      }
    } catch (_) {}
    return null;
  }

  /**
   * Strategy 2: Regex extraction over unescaped HTML/DASH manifest string
   */
  async extractFromDASHRegex() {
    const html = document.documentElement.outerHTML;

    // Match all escaped MP4 URLs
    const matches = [...html.matchAll(/https:\\\/\\\/[^"]+?\.mp4[^"]*/g)];
    if (!matches || matches.length === 0) return null;

    const urls = [...new Set(
      matches.map(m =>
        m[0]
          .replace(/\\\//g, "/")
          .replace(/&amp;/g, "&")
          .replace(/\\u0025/g, "%")
          .replace(/\\u0026/g, "&")
          .replace(/\\u003D/g, "=")
          .replace(/\\u003F/g, "?")
      )
    )];

    if (urls.length === 0) return null;

    // The highest quality MP4 stream is typically listed last in DASH manifests
    const bestUrl = urls[urls.length - 1];
    const username = this.getStoryUsernameFromUrl();

    return {
      url: bestUrl,
      type: 'video',
      username: username
    };
  }

  /**
   * Strategy 3: Inspect Performance API resource entries
   */
  async extractFromPerformanceEntries() {
    const entries = performance.getEntriesByType('resource') || this.performanceEntries;
    if (!entries || entries.length === 0) return null;

    // Filter media URLs from fbcdn / instagram CDN
    const mediaEntries = entries.filter(e => 
      e.name && 
      (e.name.includes('.mp4') || e.name.includes('.jpg') || e.name.includes('.webp')) &&
      (e.name.includes('fbcdn.net') || e.name.includes('cdninstagram.com'))
    );

    if (mediaEntries.length === 0) return null;

    // Filter for recent entries
    const latestVideo = mediaEntries.filter(e => e.name.includes('.mp4')).pop();
    const latestImage = mediaEntries.filter(e => e.name.includes('.jpg') || e.name.includes('.webp')).pop();

    const username = this.getStoryUsernameFromUrl();

    if (latestVideo) {
      return {
        url: latestVideo.name,
        type: 'video',
        username: username
      };
    }

    if (latestImage) {
      return {
        url: latestImage.name,
        type: 'image',
        username: username
      };
    }

    return null;
  }

  /**
   * Strategy 4: Fallback DOM Inspection for currently visible story element
   */
  async extractFromDOM() {
    const storyContainer = this.findStoryDOMContainer();
    if (!storyContainer) return null;

    const username = this.getStoryUsernameFromUrl();

    // Check for video element
    const videoEl = storyContainer.querySelector('video');
    if (videoEl) {
      const videoSrc = videoEl.currentSrc || videoEl.src || videoEl.querySelector('source')?.src;
      if (videoSrc && !videoSrc.startsWith('blob:')) {
        return {
          url: videoSrc,
          type: 'video',
          username: username
        };
      }
    }

    // Check for image element
    const imgEl = storyContainer.querySelector('img[srcset], img[src]');
    if (imgEl) {
      let bestImgUrl = imgEl.src;
      
      // Parse srcset for highest resolution candidate
      if (imgEl.srcset) {
        const srcsetItems = imgEl.srcset.split(',').map(item => {
          const parts = item.trim().split(/\s+/);
          return {
            url: parts[0],
            width: parseInt(parts[1], 10) || 0
          };
        });

        srcsetItems.sort((a, b) => b.width - a.width);
        if (srcsetItems[0]?.url) {
          bestImgUrl = srcsetItems[0].url;
        }
      }

      if (bestImgUrl && !bestImgUrl.startsWith('data:')) {
        return {
          url: bestImgUrl,
          type: 'image',
          username: username
        };
      }
    }

    return null;
  }

  /**
   * Helper to locate active story DOM container element
   */
  findStoryDOMContainer() {
    // Search standard Instagram story containers (role="dialog", section, or main dialog wrapper)
    return (
      document.querySelector('div[role="dialog"]') ||
      document.querySelector('section._a99v') ||
      document.querySelector('section') ||
      document.body
    );
  }

  /**
   * Helper to extract story username from location URL path
   */
  getStoryUsernameFromUrl() {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts[0] === 'stories' && pathParts[1]) {
      return pathParts[1];
    }
    return 'instagram_user';
  }

  /**
   * Clear cache for a specific key or all entries
   */
  clearCache(key = null) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}

// Instantiate global parser on window
window.storyParser = new StoryParser();
