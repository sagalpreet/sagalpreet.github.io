/**
 * blog.js — Client-side Markdown blog engine
 *
 * URL:    blog.html?post=<slug>
 * Fetch:  /posts/<slug>/index.md
 *
 * CDN dependencies (loaded synchronously before this script):
 *   - marked.js v12     (window.marked)
 *   - highlight.js      (window.hljs)
 *   - katex             (window.katex + window.renderMathInElement)
 */

/* ═══════════════════════════════════════════════════════════════════════
   MARKED v12 RENDERER SETUP — called once at script load
   ---------------------------------------------------------------
   v12 renderer functions receive POSITIONAL STRING arguments:
     code(code, language, isEscaped)
     image(href, title, text)
     link(href, title, text)
   ═══════════════════════════════════════════════════════════════════════ */
marked.use({
  gfm: true,
  breaks: false,
  renderer: {
    // Fenced code blocks — add a language badge
    code(code, lang, _isEscaped) {
      const escaped = String(code || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      lang = lang || '';
      const cls   = lang ? ' class="language-' + lang + '"' : '';
      const badge = lang ? '<span class="lang-badge">' + lang + '</span>' : '';
      return '<div class="code-block-wrapper">' + badge +
             '<pre><code' + cls + '>' + escaped + '</code></pre></div>';
    },

    // Images → <figure> with optional <figcaption>
    image(href, title, alt) {
      href  = href  || '';
      title = title || '';
      alt   = alt   || '';
      var html = '<figure><img src="' + href + '"' +
        (alt   ? ' alt="'   + alt   + '"' : '') +
        (title ? ' title="' + title + '"' : '') +
        ' loading="lazy">';
      if (alt) html += '<figcaption>' + alt + '</figcaption>';
      html += '</figure>';
      return html;
    },

    // Links — open external URLs in a new tab
    link(href, title, text) {
      href  = href  || '#';
      title = title || '';
      text  = text  || href;
      var external = /^https?:/.test(href);
      return '<a href="' + href + '"' +
        (title ? ' title="' + title + '"' : '') +
        (external ? ' target="_blank" rel="noopener noreferrer"' : '') +
        '>' + text + '</a>';
    }
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   FRONT-MATTER PARSER
   ═══════════════════════════════════════════════════════════════════════ */
function parseFrontMatter(raw) {
  var match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) return { meta: {}, body: raw };

  var meta = {};
  match[1].split('\n').forEach(function(line) {
    var i = line.indexOf(':');
    if (i < 0) return;
    var key = line.slice(0, i).trim();
    var val = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (key) meta[key] = val;
  });
  return { meta: meta, body: raw.slice(match[0].length) };
}

/* ═══════════════════════════════════════════════════════════════════════
   ASSET-PATH REWRITER
   Rewrites relative paths in Markdown image/link syntax so assets
   co-located with index.md resolve correctly when rendered from blog.html.
   ═══════════════════════════════════════════════════════════════════════ */
function isAbsoluteUrl(url) {
  return /^(https?:|data:|mailto:|#|\/)/i.test(url);
}

function rewriteAssetPaths(markdown, basePath) {
  // Match ![alt](url) and [text](url)
  return markdown.replace(/(!?\[[^\]]*\])\(([^)]+)\)/g, function(full, label, urlPart) {
    var trimmed  = urlPart.trim();
    var spaceIdx = trimmed.search(/\s+["']/);
    var rawUrl   = spaceIdx >= 0 ? trimmed.slice(0, spaceIdx) : trimmed;
    var suffix   = spaceIdx >= 0 ? trimmed.slice(spaceIdx)   : '';
    if (isAbsoluteUrl(rawUrl)) return full;
    return label + '(' + basePath + rawUrl + suffix + ')';
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   MATH PROTECTION
   Stash $…$ and $$…$$ as opaque tokens before Markdown parsing,
   then restore in output HTML for KaTeX.
   ═══════════════════════════════════════════════════════════════════════ */
function protectMath(markdown) {
  var stash = [];

  // Display math $$…$$ (multi-line, greedy)
  var out = markdown.replace(/\$\$([\s\S]*?)\$\$/g, function(_, inner) {
    return 'MSTASH_D' + (stash.push('$$' + inner + '$$') - 1) + 'END';
  });

  // Inline math $…$ (single dollar, no whitespace at edges)
  out = out.replace(/(?<!\$)\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\$)/g, function(_, inner) {
    return 'MSTASH_I' + (stash.push('$' + inner + '$') - 1) + 'END';
  });

  return { safe: out, stash: stash };
}

function restoreMath(html, stash) {
  return html
    .replace(/MSTASH_D(\d+)END/g, function(_, i) { return stash[+i]; })
    .replace(/MSTASH_I(\d+)END/g,  function(_, i) { return stash[+i]; });
}

/* ═══════════════════════════════════════════════════════════════════════
   DOM HELPERS
   ═══════════════════════════════════════════════════════════════════════ */
function $id(id) { return document.getElementById(id); }

function showLoading() {
  $id('loading-indicator').style.display = 'flex';
  $id('error-container').style.display   = 'none';
  $id('content').style.display           = 'none';
}

function showContent() {
  $id('loading-indicator').style.display = 'none';
  $id('error-container').style.display   = 'none';
  $id('content').style.display           = 'block';
}

function showError(msg, code) {
  $id('loading-indicator').style.display = 'none';
  $id('content').style.display           = 'none';
  var el = $id('error-container');
  el.style.display = 'block';
  el.querySelector('.error-code').textContent = code || '404';
  $id('error-message').textContent = msg || 'Post not found.';
}

/* ═══════════════════════════════════════════════════════════════════════
   POST HEADER BUILDER
   ═══════════════════════════════════════════════════════════════════════ */
function formatSlug(slug) {
  return slug.replace(/^\d{4}-\d{2}-/, '').replace(/-/g, ' ')
             .replace(/\b\w/g, function(c) { return c.toUpperCase(); });
}

function formatDate(str) {
  try {
    var d = new Date(str + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch (_) { return str; }
}

function renderPostHeader(meta, slug) {
  var title = meta.title || formatSlug(slug);
  document.title = title + ' | Sagalpreet Singh';
  $id('nav-breadcrumb').textContent = title;
  var descEl = document.querySelector('meta[name="description"]');
  if (descEl && meta.description) descEl.setAttribute('content', meta.description);

  var date = meta.date ? formatDate(meta.date) : null;
  var rt   = meta.readtime || null;
  var tags = meta.tags ? meta.tags.split(',').map(function(t) { return t.trim(); }).filter(Boolean) : [];

  var metaHtml = '';
  if (date) metaHtml += '<span class="meta-item"><i class="far fa-calendar-alt"></i> ' + date + '</span>';
  if (rt)   metaHtml += '<span class="meta-item"><i class="far fa-clock"></i> ' + rt + '</span>';
  if (tags.length) {
    var spans = tags.map(function(t) {
      return '<span style="display:inline-block;font-size:.75rem;background:rgba(0,123,255,.08);' +
        'color:#003d83;border:1px solid rgba(0,123,255,.25);border-radius:3px;' +
        'padding:1px 7px;font-family:\'JetBrains Mono\',monospace">' + t + '</span>';
    }).join(' ');
    metaHtml += '<span class="meta-item">' + spans + '</span>';
  }

  $id('post-header').innerHTML = '<h1>' + title + '</h1>' +
    (metaHtml ? '<div class="post-meta">' + metaHtml + '</div>' : '');
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN RENDER PIPELINE
   ═══════════════════════════════════════════════════════════════════════ */
async function renderPost(slug) {
  showLoading();

  // 1. Fetch raw Markdown
  var raw;
  try {
    var res = await fetch('/posts/' + slug + '/index.md');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    raw = await res.text();
  } catch (err) {
    var is404 = /40[34]|not found/i.test(err.message);
    showError(
      is404 ? 'Post not found. Check the URL slug.' : 'Could not load post: ' + err.message,
      is404 ? '404' : '⚠'
    );
    return;
  }

  // 2. Parse front-matter
  var parsed = parseFrontMatter(raw);
  var meta = parsed.meta;
  var body = parsed.body;
  var basePath = '/posts/' + slug + '/';

  // 3. Protect math from Markdown parser
  var mathResult = protectMath(body);
  var safeMd = mathResult.safe;
  var stash  = mathResult.stash;

  // 4. Rewrite relative asset paths
  var rewritten = rewriteAssetPaths(safeMd, basePath);

  // 5. Parse Markdown → HTML
  var html;
  try {
    html = marked.parse(rewritten);
  } catch (err) {
    console.error('[blog.js] marked.parse error:', err);
    showError('Render error: ' + err.message, '⚠');
    return;
  }

  // 6. Restore math placeholders
  html = restoreMath(html, stash);

  // 7. Inject into DOM
  renderPostHeader(meta, slug);
  $id('post-body').innerHTML = html;

  // 8. Syntax highlight code blocks
  $id('post-body').querySelectorAll('pre code').forEach(function(block) {
    hljs.highlightElement(block);
  });

  // 9. Render math with KaTeX
  if (typeof renderMathInElement === 'function') {
    try {
      renderMathInElement($id('post-body'), {
        delimiters: [
          { left: '$$', right: '$$', display: true  },
          { left: '$',  right: '$',  display: false },
          { left: '\\[', right: '\\]', display: true  },
          { left: '\\(', right: '\\)', display: false }
        ],
        throwOnError: false
      });
    } catch (err) {
      console.warn('[blog.js] KaTeX rendering warning:', err);
    }
  } else {
    console.error('[blog.js] KaTeX auto-render not loaded — math will show as raw LaTeX');
  }

  // 10. Show with fade-in
  showContent();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

var POSTS = [
  {
    slug: 'hello-world',
    title: 'Hello World: Welcome to My Blog',
    date: '2026-06-26',
    description: 'An introduction to who I am, my journey into reinforcement learning, my perspective on the field, and the things that keep me busy outside of research.',
    tags: ['personal', 'reinforcement-learning', 'music', 'life'],
    readtime: '5 min read'
  }
];

/* ═══════════════════════════════════════════════════════════════════════
   INDEX PAGE (no ?post= param)
   ═══════════════════════════════════════════════════════════════════════ */
function renderIndexPage() {
  $id('loading-indicator').style.display = 'none';
  $id('error-container').style.display   = 'none';
  $id('content').style.display           = 'block';
  document.title = 'Blog | Sagalpreet Singh';
  $id('nav-breadcrumb').textContent = 'Blog';
  $id('post-header').innerHTML = '<h1>Blog</h1>';

  var html = '<div class="post-list" style="margin-top: 2rem;">';
  POSTS.forEach(function(post) {
    var tagsHtml = post.tags.map(function(t) {
      return '<span style="display:inline-block;font-size:.72rem;background:rgba(0,123,255,.06);' +
        'color:#003d83;border:1px solid rgba(0,123,255,.2);border-radius:3px;' +
        'padding:1px 6px;font-family:\'JetBrains Mono\',monospace;margin-right:0.4rem;">' + t + '</span>';
    }).join('');

    var postDate = formatDate(post.date);

    html += '<article class="post-item" style="margin-bottom: 3rem; padding-bottom: 2rem; border-bottom: 1px solid var(--color-border);">' +
      '<h2 style="font-family:var(--font-prose);font-size:1.6rem;font-weight:600;margin-bottom:0.6rem;">' +
        '<a href="blog.html?post=' + post.slug + '" style="color:var(--color-text-dark);text-decoration:none;transition:color 0.2s;">' + post.title + '</a>' +
      '</h2>' +
      '<div class="post-meta" style="margin-bottom: 1rem; font-size:0.82rem; color:var(--color-muted); display:flex; flex-wrap:wrap; gap:0.5rem 1rem; align-items:center;">' +
        '<span class="meta-item"><i class="far fa-calendar-alt"></i> ' + postDate + '</span>' +
        '<span class="meta-item"><i class="far fa-clock"></i> ' + post.readtime + '</span>' +
        '<span class="meta-item">' + tagsHtml + '</span>' +
      '</div>' +
      '<p style="color:#555;font-family:var(--font-prose);font-size:0.95rem;line-height:1.6;margin-bottom:1rem;">' + post.description + '</p>' +
      '<a href="blog.html?post=' + post.slug + '" style="font-weight:500;text-decoration:none;color:var(--color-link);transition:color 0.2s;font-size:0.95rem;">Read post →</a>' +
    '</article>';
  });
  html += '</div>';

  $id('post-body').innerHTML = html;

  // Add simple hover effect on post-item titles
  $id('post-body').querySelectorAll('.post-item h2 a').forEach(function(link) {
    link.addEventListener('mouseenter', function() { link.style.color = 'var(--color-link)'; });
    link.addEventListener('mouseleave', function() { link.style.color = 'var(--color-text-dark)'; });
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   ROUTER
   ═══════════════════════════════════════════════════════════════════════ */
(function router() {
  var slug = new URLSearchParams(window.location.search).get('post');
  if (!slug || !/^[\w.-]+$/.test(slug)) {
    renderIndexPage();
  } else {
    renderPost(slug);
  }
})();
