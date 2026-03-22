// DesignLift v3.0 — True 1:1 Mirror Engine
// Captures the FULL rendered page: DOM + all CSS + fonts + images.
// Output is a single self-contained HTML file that renders identically.
// Preserves: animations, hover states, media queries, @keyframes, @font-face.

var DL: any = (window as any).__DL;

const MIRROR_REMOVE_TAGS = new Set(['SCRIPT', 'NOSCRIPT']);
const MIRROR_JUNK = /cookie|consent|gdpr|popup|modal|overlay|admin-bar|wp-admin|chat-widget|intercom|drift|crisp|cookieyes/i;
const MIRROR_TRACKING = /google-analytics|googletagmanager|facebook\.net|doubleclick|hotjar|segment\.io|mixpanel|amplitude|clarity\.ms|sentry/i;

// ─── Collect all external stylesheet URLs ────────────────────
DL._collectStylesheetUrls = (): string[] => {
  const urls: string[] = [];

  // <link rel="stylesheet">
  document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
    const href = (link as HTMLLinkElement).href;
    if (href && !href.startsWith('data:')) urls.push(href);
  });

  // @import rules inside accessible stylesheets
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule instanceof CSSImportRule && rule.href) {
          urls.push(rule.href);
        }
      }
    } catch (e) { /* CORS — will fetch via service worker */ }
  }

  return [...new Set(urls)];
};

// ─── Resolve relative url() references in CSS to absolute ────
DL._resolveUrlsInCSS = (cssText: string, baseUrl: string): string => {
  return cssText.replace(
    /url\(\s*(['"]?)(.+?)\1\s*\)/g,
    (match: string, quote: string, rawUrl: string) => {
      const trimmed = rawUrl.trim();
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://') ||
          trimmed.startsWith('data:') || trimmed.startsWith('blob:') ||
          trimmed.startsWith('//') || trimmed.startsWith('#')) {
        return match;
      }
      try {
        const resolved = new URL(trimmed, baseUrl).href;
        return `url(${quote}${resolved}${quote})`;
      } catch {
        return match;
      }
    }
  );
};

// ─── Detect tracking pixels ──────────────────────────────────
DL._isTrackingPixel = (img: HTMLImageElement): boolean => {
  const w = img.width || img.naturalWidth || parseInt(img.getAttribute('width') || '999');
  const h = img.height || img.naturalHeight || parseInt(img.getAttribute('height') || '999');
  if (w <= 2 && h <= 2) return true;
  const src = img.src || '';
  if (MIRROR_TRACKING.test(src)) return true;
  const style = getComputedStyle(img);
  if (style.display === 'none' && MIRROR_TRACKING.test(src)) return true;
  return false;
};

// ─── Fix lazy-loaded images ──────────────────────────────────
DL._fixLazyImages = (root: HTMLElement): void => {
  root.querySelectorAll('img').forEach(img => {
    // If img has no src but has data-src, swap it
    const dataSrc = img.getAttribute('data-src') || img.getAttribute('data-lazy') || img.getAttribute('data-original');
    if (dataSrc && (!img.getAttribute('src') || img.getAttribute('src') === '')) {
      img.setAttribute('src', dataSrc);
    }
    // Use currentSrc if available (handles srcset resolution)
    const origImg = document.querySelector(`img[src="${img.getAttribute('src')}"]`) as HTMLImageElement;
    if (origImg?.currentSrc && origImg.currentSrc !== img.getAttribute('src')) {
      img.setAttribute('src', origImg.currentSrc);
    }
    // Remove lazy loading attributes
    img.removeAttribute('loading');
    img.removeAttribute('data-src');
    img.removeAttribute('data-lazy');
    img.removeAttribute('data-original');
  });
};

// ─── Capture canvas elements as static images ────────────────
DL._captureCanvases = (root: HTMLElement): void => {
  // Find canvases in the LIVE document and convert to data URLs
  const liveCanvases = document.querySelectorAll('canvas');
  const cloneCanvases = root.querySelectorAll('canvas');

  liveCanvases.forEach((liveCanvas, i) => {
    if (i < cloneCanvases.length) {
      try {
        const dataUrl = liveCanvas.toDataURL('image/png');
        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.cssText = getComputedStyle(liveCanvas).cssText;
        img.setAttribute('width', String(liveCanvas.width));
        img.setAttribute('height', String(liveCanvas.height));
        cloneCanvases[i].replaceWith(img);
      } catch (e) { /* tainted canvas */ }
    }
  });
};

// ─── Clean the cloned DOM ────────────────────────────────────
DL._cleanClone = (root: HTMLElement): void => {
  const toRemove: Element[] = [];

  root.querySelectorAll('*').forEach(el => {
    // Remove scripts, noscript
    if (MIRROR_REMOVE_TAGS.has(el.tagName)) { toRemove.push(el); return; }

    // Remove tracking iframes
    if (el.tagName === 'IFRAME') {
      const src = el.getAttribute('src') || '';
      if (MIRROR_TRACKING.test(src) || el.getAttribute('width') === '0' || el.getAttribute('height') === '0') {
        toRemove.push(el); return;
      }
    }

    // Remove junk by class/id
    const cls = el.className?.toString?.() || '';
    const id = el.id || '';
    if (MIRROR_JUNK.test(cls) || MIRROR_JUNK.test(id)) { toRemove.push(el); return; }

    // Remove tracking pixels
    if (el.tagName === 'IMG' && DL._isTrackingPixel(el as HTMLImageElement)) {
      toRemove.push(el); return;
    }

    // Remove event handler attributes
    const attrs = Array.from(el.attributes);
    for (const attr of attrs) {
      if (attr.name.startsWith('on')) el.removeAttribute(attr.name);
    }

    // Remove non-essential data-* attributes (keep data-src for lazy images)
    for (const attr of attrs) {
      if (attr.name.startsWith('data-') &&
          !['data-src', 'data-id', 'data-tab', 'data-index'].includes(attr.name)) {
        el.removeAttribute(attr.name);
      }
    }
  });

  toRemove.forEach(el => el.remove());

  // Remove <link rel="stylesheet"> (CSS is being inlined)
  root.querySelectorAll('link[rel="stylesheet"]').forEach(el => el.remove());

  // Remove CSP meta tags that would block inlined resources
  root.querySelectorAll('meta[http-equiv="Content-Security-Policy"]').forEach(el => el.remove());

  // Remove preload/prefetch links
  root.querySelectorAll('link[rel="preload"], link[rel="prefetch"], link[rel="dns-prefetch"], link[rel="preconnect"]').forEach(el => el.remove());
};

// ─── Main mirror function ────────────────────────────────────
DL.mirrorPage = (externalCSS: Record<string, string>): string => {
  // Deep clone the entire document
  const clone = document.documentElement.cloneNode(true) as HTMLElement;

  // Fix lazy images before cleaning (needs access to data-src)
  DL._fixLazyImages(clone);

  // Capture canvases
  DL._captureCanvases(clone);

  // Clean the clone (strip scripts, tracking, junk)
  DL._cleanClone(clone);

  // Get <head>
  const head = clone.querySelector('head');
  if (!head) return '';

  // Add meta generator
  const meta = document.createElement('meta');
  meta.setAttribute('name', 'generator');
  meta.setAttribute('content', 'DesignLift Mirror v3.0');
  head.insertBefore(meta, head.firstChild);

  // Ensure charset
  if (!head.querySelector('meta[charset]')) {
    const mc = document.createElement('meta');
    mc.setAttribute('charset', 'UTF-8');
    head.insertBefore(mc, head.firstChild);
  }

  // Ensure viewport
  if (!head.querySelector('meta[name="viewport"]')) {
    const mv = document.createElement('meta');
    mv.setAttribute('name', 'viewport');
    mv.setAttribute('content', 'width=device-width, initial-scale=1');
    head.appendChild(mv);
  }

  // ── Inline external CSS ──
  for (const [url, cssText] of Object.entries(externalCSS)) {
    if (!cssText || cssText.length < 10) continue;
    // Resolve relative url() references
    const resolved = DL._resolveUrlsInCSS(cssText, url);
    const style = document.createElement('style');
    style.textContent = `/* Source: ${url} */\n${resolved}`;
    head.appendChild(style);
  }

  // ── Resolve url() in existing inline <style> blocks ──
  clone.querySelectorAll('style').forEach(styleEl => {
    const css = styleEl.textContent || '';
    if (css.includes('url(') && !css.includes('data:application')) {
      styleEl.textContent = DL._resolveUrlsInCSS(css, window.location.href);
    }
  });

  // ── Re-add Google Fonts <link> tags (they load fine cross-origin) ──
  document.querySelectorAll('link[href*="fonts.googleapis.com"]').forEach(link => {
    const href = (link as HTMLLinkElement).href;
    if (href) {
      const newLink = document.createElement('link');
      newLink.rel = 'stylesheet';
      newLink.href = href;
      head.appendChild(newLink);
    }
  });

  // ── Add a base tag so relative URLs resolve correctly ──
  if (!clone.querySelector('base')) {
    const base = document.createElement('base');
    base.href = window.location.origin + '/';
    head.insertBefore(base, head.firstChild);
  }

  // Build final HTML
  const comment = `<!-- Mirrored from ${window.location.href} on ${new Date().toISOString()} by DesignLift v3.0 -->\n`;
  return comment + '<!DOCTYPE html>\n' + clone.outerHTML;
};
