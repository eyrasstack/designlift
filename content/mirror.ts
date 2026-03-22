// DesignLift v3.1 — True 1:1 Mirror Engine (with interactions)
// Captures EVERYTHING: DOM + CSS + fonts + images + interaction scripts.
// Selectively keeps visual JS (Webflow, jQuery, GSAP, Lottie) while
// stripping only tracking/analytics/consent scripts.

var DL: any = (window as any).__DL;

// Scripts to KEEP — these power visual interactions
const KEEP_SCRIPTS = [
  'jquery',
  'webflow',
  'gsap',
  'scrolltrigger',
  'lottie',
  'webfont',
  'swiper',
  'splide',
  'locomotive',
  'barba',
  'animejs',
  'anime.min',
  'motion',
  'framer-motion',
  'three.js',
  'three.min',
  'd3.min',
  'd3.v',
];

// Scripts to STRIP — tracking, analytics, consent, chat
const STRIP_SCRIPTS = [
  'google-analytics',
  'googletagmanager',
  'gtag/js',
  'facebook.net',
  'fbevents',
  'doubleclick',
  'hotjar',
  'segment.io',
  'segment.com/analytics',
  'mixpanel',
  'amplitude',
  'clarity.ms',
  'sentry',
  'cookie-consent',
  'fs-cc',
  'cookieyes',
  'onetrust',
  'recaptcha',
  'intercom',
  'drift',
  'crisp',
  'tawk.to',
  'zendesk',
  'freshdesk',
  'hubspot',
  'monsterinsights',
];

// Junk elements to remove by class/id
const MIRROR_JUNK = /cookie|consent|gdpr|admin-bar|wp-admin|chat-widget|intercom-|drift-|crisp-|cookieyes|fs-cc/i;
const MIRROR_TRACKING_IMG = /google-analytics|googletagmanager|facebook\.net|doubleclick|hotjar|segment\.io|mixpanel|amplitude|clarity\.ms|sentry/i;

// ─── Should this script be kept? ─────────────────────────────
function shouldKeepScript(el: HTMLScriptElement): boolean {
  const src = (el.getAttribute('src') || '').toLowerCase();
  const content = (el.textContent || '').toLowerCase().slice(0, 500);

  // If it has a src, check against keep/strip lists
  if (src) {
    // Check strip list first
    for (const pattern of STRIP_SCRIPTS) {
      if (src.includes(pattern)) return false;
    }
    // Check keep list
    for (const pattern of KEEP_SCRIPTS) {
      if (src.includes(pattern)) return true;
    }
    // If from same domain as the page or a known CDN, keep it
    const pageDomain = window.location.hostname;
    try {
      const scriptDomain = new URL(src).hostname;
      if (scriptDomain === pageDomain) return true;
      if (scriptDomain.includes('website-files.com')) return true; // Webflow CDN
      if (scriptDomain.includes('cloudfront.net')) return true; // AWS CDN (often jQuery)
      if (scriptDomain.includes('cdnjs.cloudflare.com')) return true;
      if (scriptDomain.includes('unpkg.com')) return true;
      if (scriptDomain.includes('jsdelivr.net') && !src.includes('cookie')) return true;
    } catch (e) {}
    // Unknown external script — strip to be safe
    return false;
  }

  // Inline script — check content
  if (content.includes('gtag(') || content.includes('google') || content.includes('analytics') ||
      content.includes('fbq(') || content.includes('dataLayer') || content.includes('monsterinsights') ||
      content.includes('_gaq') || content.includes('ga(')) {
    return false;
  }

  // Inline scripts for Webflow interactions, animations, etc. — keep
  if (content.includes('webflow') || content.includes('wf.') ||
      content.includes('gsap') || content.includes('scrolltrigger') ||
      content.includes('lottie') || content.includes('marquee') ||
      content.includes('swiper')) {
    return true;
  }

  // Short inline scripts (< 200 chars) that aren't analytics — keep
  if (content.length < 200 && !content.includes('analytics')) return true;

  // Default: keep it (better to have extra JS than missing interactions)
  return true;
}

// ─── Collect all external stylesheet URLs ────────────────────
DL._collectStylesheetUrls = (): string[] => {
  const urls: string[] = [];
  document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
    const href = (link as HTMLLinkElement).href;
    if (href && !href.startsWith('data:')) urls.push(href);
  });
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule instanceof CSSImportRule && rule.href) urls.push(rule.href);
      }
    } catch (e) {}
  }
  return [...new Set(urls)];
};

// ─── Resolve relative url() in CSS ──────────────────────────
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
        return `url(${quote}${new URL(trimmed, baseUrl).href}${quote})`;
      } catch { return match; }
    }
  );
};

// ─── Fix lazy-loaded images ──────────────────────────────────
DL._fixLazyImages = (root: HTMLElement): void => {
  root.querySelectorAll('img').forEach(img => {
    const dataSrc = img.getAttribute('data-src') || img.getAttribute('data-lazy') || img.getAttribute('data-original');
    if (dataSrc && (!img.getAttribute('src') || img.getAttribute('src') === '')) {
      img.setAttribute('src', dataSrc);
    }
    // Try to use currentSrc from the live page
    const liveImg = document.querySelector(`img[alt="${img.getAttribute('alt')}"]`) as HTMLImageElement;
    if (liveImg?.currentSrc) img.setAttribute('src', liveImg.currentSrc);
    img.removeAttribute('loading');
  });
};

// ─── Capture canvas elements ─────────────────────────────────
DL._captureCanvases = (root: HTMLElement): void => {
  const liveCanvases = document.querySelectorAll('canvas');
  const cloneCanvases = root.querySelectorAll('canvas');
  liveCanvases.forEach((lc, i) => {
    if (i < cloneCanvases.length) {
      try {
        const dataUrl = lc.toDataURL('image/png');
        const img = document.createElement('img');
        img.src = dataUrl;
        img.setAttribute('width', String(lc.width));
        img.setAttribute('height', String(lc.height));
        cloneCanvases[i].replaceWith(img);
      } catch (e) {}
    }
  });
};

// ─── Clean cloned DOM (selective — keeps interaction scripts) ─
DL._cleanClone = (root: HTMLElement): void => {
  const toRemove: Element[] = [];

  root.querySelectorAll('*').forEach(el => {
    // Handle scripts selectively
    if (el.tagName === 'SCRIPT') {
      if (!shouldKeepScript(el as HTMLScriptElement)) {
        toRemove.push(el);
      }
      return;
    }

    // Remove noscript
    if (el.tagName === 'NOSCRIPT') { toRemove.push(el); return; }

    // Remove tracking iframes
    if (el.tagName === 'IFRAME') {
      const src = el.getAttribute('src') || '';
      if (MIRROR_TRACKING_IMG.test(src) || el.getAttribute('width') === '0' || el.getAttribute('height') === '0') {
        toRemove.push(el);
        return;
      }
    }

    // Remove junk elements (cookie banners, chat widgets — NOT modals/popups that are part of the site)
    const cls = el.className?.toString?.() || '';
    const id = el.id || '';
    if (MIRROR_JUNK.test(cls) || MIRROR_JUNK.test(id)) {
      toRemove.push(el);
      return;
    }

    // Remove tracking pixels
    if (el.tagName === 'IMG') {
      const w = (el as HTMLImageElement).width || parseInt(el.getAttribute('width') || '999');
      const h = (el as HTMLImageElement).height || parseInt(el.getAttribute('height') || '999');
      const src = el.getAttribute('src') || '';
      if ((w <= 2 && h <= 2) || MIRROR_TRACKING_IMG.test(src)) {
        toRemove.push(el);
        return;
      }
    }

    // Remove event handler attributes (onclick, etc.) — keep data-* for Webflow
    const attrs = Array.from(el.attributes);
    for (const attr of attrs) {
      if (attr.name.startsWith('on') && attr.name !== 'onload') {
        el.removeAttribute(attr.name);
      }
    }

    // DO NOT strip data-* attributes — Webflow interactions use data-w-id, data-animation, etc.
  });

  toRemove.forEach(el => el.remove());

  // Remove stylesheet links (CSS is being inlined)
  root.querySelectorAll('link[rel="stylesheet"]').forEach(el => el.remove());

  // Remove CSP that would block inlined stuff
  root.querySelectorAll('meta[http-equiv="Content-Security-Policy"]').forEach(el => el.remove());

  // Remove preload/prefetch (we're serving locally)
  root.querySelectorAll('link[rel="preload"], link[rel="prefetch"], link[rel="dns-prefetch"]').forEach(el => el.remove());

  // Keep preconnect for font CDNs
};

// ─── Collect script URLs that need fetching ──────────────────
DL._collectScriptUrls = (): string[] => {
  const urls: string[] = [];
  document.querySelectorAll('script[src]').forEach(el => {
    const script = el as HTMLScriptElement;
    if (shouldKeepScript(script) && script.src) {
      urls.push(script.src);
    }
  });
  return urls;
};

// ─── Main mirror function ────────────────────────────────────
DL.mirrorPage = (externalCSS: Record<string, string>, externalJS: Record<string, string>): string => {
  // Deep clone the entire document
  const clone = document.documentElement.cloneNode(true) as HTMLElement;

  // Fix lazy images
  DL._fixLazyImages(clone);

  // Capture canvases
  DL._captureCanvases(clone);

  // Clean (selective — keeps interaction scripts)
  DL._cleanClone(clone);

  const head = clone.querySelector('head');
  if (!head) return '';

  // Add meta
  const meta = document.createElement('meta');
  meta.setAttribute('name', 'generator');
  meta.setAttribute('content', 'DesignLift Mirror v3.1');
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
    const resolved = DL._resolveUrlsInCSS(cssText, url);
    const style = document.createElement('style');
    style.textContent = `/* Source: ${url} */\n${resolved}`;
    head.appendChild(style);
  }

  // ── Resolve url() in existing inline styles ──
  clone.querySelectorAll('style').forEach(styleEl => {
    const css = styleEl.textContent || '';
    if (css.includes('url(') && !css.includes('data:application/x-font')) {
      styleEl.textContent = DL._resolveUrlsInCSS(css, window.location.href);
    }
  });

  // ── Re-add Google Fonts links ──
  document.querySelectorAll('link[href*="fonts.googleapis.com"]').forEach(link => {
    const href = (link as HTMLLinkElement).href;
    if (href) {
      const newLink = document.createElement('link');
      newLink.rel = 'stylesheet';
      newLink.href = href;
      head.appendChild(newLink);
    }
  });

  // ── Inline external JS that we want to keep ──
  // Replace <script src="..."> with <script>inlinedCode</script>
  clone.querySelectorAll('script[src]').forEach(scriptEl => {
    const src = scriptEl.getAttribute('src') || '';
    // Find the fetched content
    let jsContent = '';
    for (const [url, content] of Object.entries(externalJS)) {
      if (src.includes(url) || url.includes(src) || new URL(src, window.location.origin).href === url) {
        jsContent = content;
        break;
      }
    }
    if (jsContent) {
      // Replace external reference with inline code
      const newScript = document.createElement('script');
      newScript.textContent = `/* Source: ${src} */\n${jsContent}`;
      // Copy attributes except src
      for (const attr of Array.from(scriptEl.attributes)) {
        if (attr.name !== 'src') newScript.setAttribute(attr.name, attr.value);
      }
      scriptEl.replaceWith(newScript);
    }
    // If not fetched, keep the external src reference (it'll load from CDN)
  });

  // ── Add base tag for relative URLs ──
  let base = clone.querySelector('base');
  if (!base) {
    base = document.createElement('base');
    base.href = window.location.origin + '/';
    head.insertBefore(base, head.firstChild);
  }

  // Build final HTML
  const comment = `<!-- Mirrored from ${window.location.href} on ${new Date().toISOString()} by DesignLift v3.1 -->\n`;
  comment + `<!-- Includes: DOM + CSS + interaction JS (Webflow, jQuery, GSAP) -->\n`;
  return comment + '<!DOCTYPE html>\n' + clone.outerHTML;
};
