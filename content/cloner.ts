// DesignLift — Page structure cloner
// Depends on utils.ts (window.__DL)

var DL: any = (window as any).__DL;

const SKIP_TAGS = new Set(['SCRIPT', 'NOSCRIPT', 'STYLE', 'IFRAME', 'LINK', 'META', 'HEAD', 'BASE', 'TEMPLATE']);
const SEMANTIC_TAGS = new Set(['HEADER', 'NAV', 'MAIN', 'SECTION', 'ARTICLE', 'ASIDE', 'FOOTER', 'FIGURE', 'FIGCAPTION', 'FORM', 'DETAILS', 'SUMMARY', 'DIALOG']);
const INLINE_TAGS = new Set(['A', 'SPAN', 'STRONG', 'EM', 'B', 'I', 'SMALL', 'LABEL', 'ABBR', 'CODE', 'TIME', 'SUB', 'SUP']);
const SELF_CLOSING = new Set(['BR', 'HR', 'INPUT', 'IMG']);

// Patterns for elements to strip (cookie banners, popups, etc.)
const JUNK_PATTERN = /cookie|consent|gdpr|popup|modal|overlay|admin-bar|wp-admin|shopify-section-announcement|chat-widget|intercom|drift|crisp/i;

DL.shouldSkipElement = (el: HTMLElement): boolean => {
  if (SKIP_TAGS.has(el.tagName)) return true;

  try {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return true;
    if (parseFloat(style.opacity) === 0) return true;
  } catch (e) { return true; }

  const rect = el.getBoundingClientRect();
  if (rect.width < 2 && rect.height < 2) return true;

  const cls = el.className?.toString?.() || '';
  const id = el.id || '';
  if (JUNK_PATTERN.test(cls) || JUNK_PATTERN.test(id)) return true;

  return false;
};

DL.hasRepeatedChildren = (el: HTMLElement, min: number): boolean => {
  const children = Array.from(el.children).filter(c => {
    try { return !DL.shouldSkipElement(c as HTMLElement); } catch { return false; }
  });
  if (children.length < min) return false;
  const firstTag = children[0]?.tagName;
  return children.filter(c => c.tagName === firstTag).length >= min;
};

DL.classifySection = (el: HTMLElement): string => {
  const rect = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  const hasHeading = !!el.querySelector('h1, h2, h3');
  const hasButton = !!el.querySelector('a[href], button');
  const hasImage = !!el.querySelector('img, video, picture');
  const hasForm = !!el.querySelector('form, input, textarea');
  const linkCount = el.querySelectorAll('a').length;
  const isFullWidth = rect.width > window.innerWidth * 0.9;
  const isTall = rect.height > window.innerHeight * 0.5;

  // Nav
  if (el.tagName === 'NAV' || (linkCount > 3 && rect.top < 150 && rect.height < 200)) return 'nav';

  // Footer
  if (el.tagName === 'FOOTER' || (rect.top > document.body.scrollHeight - 500 && linkCount > 3)) return 'footer';

  // Hero: first tall section with h1
  if (isTall && hasHeading && hasButton && !!el.querySelector('h1')) return 'hero';

  // FAQ
  if (el.querySelectorAll('details, summary').length > 2) return 'faq';

  // Form section
  if (hasForm) return 'form-section';

  // Product/card grid
  if (DL.hasRepeatedChildren(el, 3) && hasImage) return 'product-grid';

  // Carousel
  if (style.overflowX === 'scroll' || style.overflowX === 'auto') return 'carousel';

  // CTA Banner
  if (isFullWidth && hasHeading && hasButton && el.children.length < 8) return 'cta-banner';

  // Stats
  const numbers = el.textContent?.match(/\d{2,}/g);
  if (numbers && numbers.length >= 3 && DL.hasRepeatedChildren(el, 3)) return 'stats';

  // Feature grid
  if (hasHeading && DL.hasRepeatedChildren(el, 3)) return 'feature-grid';

  // Trust badges
  if (DL.hasRepeatedChildren(el, 3) && !hasImage) {
    const kids = Array.from(el.children);
    const avgH = kids.reduce((s, c) => s + c.getBoundingClientRect().height, 0) / kids.length;
    if (avgH < 100) return 'trust-badges';
  }

  return 'section';
};

// Recursively clean and convert a DOM subtree to HTML
DL.cleanDOM = (el: HTMLElement, depth: number = 0): string => {
  if (depth > 15) return '';
  if (DL.shouldSkipElement(el)) return '';

  let tag = el.tagName.toLowerCase();

  // Handle images — capture src URL alongside placeholder
  if (tag === 'img') {
    const alt = el.getAttribute('alt') || 'image';
    const src = el.getAttribute('src') || el.getAttribute('data-src') || el.getAttribute('data-lazy') || '';
    const srcset = el.getAttribute('srcset') || '';
    // Pick the best available URL
    let imageUrl = src;
    if (!imageUrl && srcset) {
      // Take the first URL from srcset
      const firstSrc = srcset.split(',')[0]?.trim().split(/\s+/)[0];
      if (firstSrc) imageUrl = firstSrc;
    }
    const urlComment = imageUrl ? ` src="${imageUrl}"` : '';
    return `${'  '.repeat(depth)}<img class="dl-image" alt="${alt}"${urlComment} />\n`;
  }

  // Handle picture element — extract best source
  if (tag === 'picture') {
    const img = el.querySelector('img');
    const alt = img?.getAttribute('alt') || 'image';
    const src = img?.getAttribute('src') || '';
    const urlComment = src ? ` src="${src}"` : '';
    return `${'  '.repeat(depth)}<img class="dl-image" alt="${alt}"${urlComment} />\n`;
  }

  // Handle video → placeholder
  if (tag === 'video') {
    const poster = el.getAttribute('poster') || '';
    const src = el.getAttribute('src') || (el.querySelector('source') as HTMLSourceElement)?.src || '';
    return `${'  '.repeat(depth)}<div class="dl-media">{/* Video: ${src || poster || 'media'} */}</div>\n`;
  }

  // Handle SVG → inline icon placeholder with dimensions
  if (tag === 'svg') {
    const w = el.getAttribute('width') || '';
    const h = el.getAttribute('height') || '';
    const dims = w && h ? ` ${w}x${h}` : '';
    return `${'  '.repeat(depth)}<span class="dl-icon">{/* SVG icon${dims} */}</span>\n`;
  }

  // Self-closing: input, br, hr
  if (tag === 'input') {
    const type = el.getAttribute('type') || 'text';
    const ph = el.getAttribute('placeholder') || '';
    const name = el.getAttribute('name') || '';
    return `${'  '.repeat(depth)}<input type="${type}" placeholder="${ph}" name="${name}" />\n`;
  }
  if (tag === 'br') return `${'  '.repeat(depth)}<br />\n`;
  if (tag === 'hr') return `${'  '.repeat(depth)}<hr />\n`;

  // Convert div to semantic when role is present
  const role = el.getAttribute('role');
  if (tag === 'div') {
    if (role === 'navigation') tag = 'nav';
    else if (role === 'banner') tag = 'header';
    else if (role === 'contentinfo') tag = 'footer';
    else if (role === 'main') tag = 'main';
  }

  // Build class name
  let className = '';
  if (depth <= 2 && (tag === 'section' || tag === 'div' || SEMANTIC_TAGS.has(el.tagName))) {
    const sType = DL.classifySection(el);
    if (sType !== 'section') className = `dl-${sType}`;
  }

  // Detect flex/grid layout
  if (!className) {
    const style = getComputedStyle(el);
    if (style.display === 'flex' || style.display === 'inline-flex') className = 'dl-flex';
    else if (style.display === 'grid') className = 'dl-grid';
  }

  // Build children HTML
  let childrenHTML = '';
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 3) {
      const text = child.textContent?.trim();
      if (text) childrenHTML += '  '.repeat(depth + 1) + text + '\n';
    } else if (child.nodeType === 1) {
      childrenHTML += DL.cleanDOM(child as HTMLElement, depth + 1);
    }
  }

  // Skip empty non-semantic containers
  if (!childrenHTML.trim() && !SEMANTIC_TAGS.has(el.tagName) && !['a', 'button'].includes(tag)) {
    return '';
  }

  // Flatten redundant wrapper divs (div with single div child and no class)
  const visibleChildren = Array.from(el.children).filter(c => {
    try { return !DL.shouldSkipElement(c as HTMLElement); } catch { return false; }
  });
  if (tag === 'div' && !className && visibleChildren.length === 1 && visibleChildren[0].tagName === 'DIV') {
    return childrenHTML;
  }

  // Build attributes string
  let attrs = '';
  if (className) attrs += ` class="${className}"`;

  if (tag === 'a') {
    let href = el.getAttribute('href') || '#';
    try {
      const url = new URL(href, window.location.origin);
      if (url.hostname === window.location.hostname) href = url.pathname;
    } catch (e) {}
    attrs += ` href="${href}"`;
  }

  if (tag === 'button') attrs += ` type="${el.getAttribute('type') || 'button'}"`;
  if (tag === 'form') attrs += ` action="${el.getAttribute('action') || '#'}"`;

  const indent = '  '.repeat(depth);
  const isInline = INLINE_TAGS.has(el.tagName);

  // Inline elements or leaf text elements on one line
  if (isInline && childrenHTML.trim().split('\n').length === 1) {
    return `${indent}<${tag}${attrs}>${childrenHTML.trim()}</${tag}>\n`;
  }

  return `${indent}<${tag}${attrs}>\n${childrenHTML}${indent}</${tag}>\n`;
};

// ─── STYLED CLONE — outputs JSX with Tailwind classes ────────
// This is the 1:1 clone mode that captures computed styles per element

DL.cleanDOMStyled = (el: HTMLElement, depth: number = 0): string => {
  if (depth > 15) return '';
  if (DL.shouldSkipElement(el)) return '';

  let tag = el.tagName.toLowerCase();
  const indent = '  '.repeat(depth);

  // Get Tailwind classes from computed styles
  const tw = DL.getElementTailwind ? DL.getElementTailwind(el) : '';
  const fontVar = DL.getFontVar ? DL.getFontVar(el) : '';
  const allClasses = [tw, fontVar].filter(Boolean).join(' ');

  // Images — keep src + add styling
  if (tag === 'img') {
    const alt = el.getAttribute('alt') || '';
    const src = el.getAttribute('src') || el.getAttribute('data-src') || '';
    const ar = DL.getAspectRatio ? DL.getAspectRatio(el) : '';
    const cls = [allClasses, ar].filter(Boolean).join(' ');
    return `${indent}<img className="${cls}" alt="${alt}" src="${src}" />\n`;
  }

  if (tag === 'picture') {
    const img = el.querySelector('img');
    const alt = img?.getAttribute('alt') || '';
    const src = img?.getAttribute('src') || '';
    return `${indent}<img className="${allClasses} w-full" alt="${alt}" src="${src}" />\n`;
  }

  if (tag === 'video') {
    const src = (el as HTMLVideoElement).querySelector('source')?.getAttribute('src') || '';
    return `${indent}<video className="${allClasses}" muted autoPlay loop playsInline>\n${indent}  <source src="${src}" type="video/mp4" />\n${indent}</video>\n`;
  }

  if (tag === 'svg') {
    const w = el.getAttribute('width') || '';
    const h = el.getAttribute('height') || '';
    return `${indent}<div className="${allClasses}" style={{width:'${w}px',height:'${h}px'}}>{/* SVG */}</div>\n`;
  }

  // Self-closing
  if (tag === 'br') return `${indent}<br />\n`;
  if (tag === 'hr') return `${indent}<hr className="${allClasses}" />\n`;
  if (tag === 'input') {
    const type = el.getAttribute('type') || 'text';
    const ph = el.getAttribute('placeholder') || '';
    const name = el.getAttribute('name') || '';
    return `${indent}<input className="${allClasses}" type="${type}" placeholder="${ph}" name="${name}" />\n`;
  }

  // Select — capture options
  if (tag === 'select') {
    const name = el.getAttribute('name') || '';
    let optionsHtml = '';
    el.querySelectorAll('option').forEach(opt => {
      const val = opt.getAttribute('value') || '';
      const text = opt.textContent?.trim() || '';
      optionsHtml += `${indent}  <option value="${val}">${text}</option>\n`;
    });
    return `${indent}<select className="${allClasses}" name="${name}">\n${optionsHtml}${indent}</select>\n`;
  }

  // Textarea
  if (tag === 'textarea') {
    const ph = el.getAttribute('placeholder') || '';
    return `${indent}<textarea className="${allClasses}" placeholder="${ph}" />\n`;
  }

  // Convert div roles to semantic tags
  const role = el.getAttribute('role');
  if (tag === 'div') {
    if (role === 'navigation') tag = 'nav';
    else if (role === 'banner') tag = 'header';
    else if (role === 'contentinfo') tag = 'footer';
    else if (role === 'main') tag = 'main';
  }

  // Build children
  let childrenHTML = '';
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 3) {
      const text = child.textContent?.trim();
      if (text) {
        // Escape JSX special chars
        const escaped = text.replace(/'/g, "&apos;").replace(/"/g, "&quot;");
        childrenHTML += indent + '  ' + escaped + '\n';
      }
    } else if (child.nodeType === 1) {
      childrenHTML += DL.cleanDOMStyled(child as HTMLElement, depth + 1);
    }
  }

  // Skip empty non-semantic containers
  if (!childrenHTML.trim() && !SEMANTIC_TAGS.has(el.tagName) && !['a', 'button', 'form'].includes(tag)) {
    return '';
  }

  // Build element
  let attrs = '';
  if (allClasses) attrs += ` className="${allClasses}"`;

  if (tag === 'a') {
    let href = el.getAttribute('href') || '#';
    try {
      const url = new URL(href, window.location.origin);
      if (url.hostname === window.location.hostname) href = url.pathname;
    } catch (e) {}
    attrs += ` href="${href}"`;
  }

  if (tag === 'button') attrs += ` type="${el.getAttribute('type') || 'button'}"`;
  if (tag === 'form') {
    attrs += ` action="${el.getAttribute('action') || '#'}"`;
    if (el.getAttribute('method')) attrs += ` method="${el.getAttribute('method')}"`;
  }

  const isInline = INLINE_TAGS.has(el.tagName);
  if (isInline && childrenHTML.trim().split('\n').length === 1) {
    return `${indent}<${tag}${attrs}>${childrenHTML.trim()}</${tag}>\n`;
  }
  return `${indent}<${tag}${attrs}>\n${childrenHTML}${indent}</${tag}>\n`;
};

// ─── Main: styled clone ──────────────────────────────────────
DL.cloneStyled = (): any => {
  const topLevel = Array.from(document.body.children).filter(el => {
    if (SKIP_TAGS.has(el.tagName)) return false;
    try { return !DL.shouldSkipElement(el as HTMLElement); } catch { return false; }
  });

  const sections = topLevel.map(el => ({
    type: DL.classifySection(el as HTMLElement),
    tag: el.tagName.toLowerCase(),
    heading: el.querySelector('h1, h2, h3')?.textContent?.trim().slice(0, 80) || null
  }));

  // Get page-level styles for the wrapper
  const bodyTw = DL.getElementTailwind ? DL.getElementTailwind(document.body) : '';

  let jsx = `// 1:1 Clone by DesignLift from ${window.location.href}\n`;
  jsx += `// ${new Date().toISOString().split('T')[0]}\n`;
  jsx += `// Sections: ${sections.map(s => s.type).join(', ')}\n\n`;
  jsx += `export default function ClonedPage() {\n  return (\n    <div className="${bodyTw}">\n`;

  for (const el of topLevel) {
    jsx += DL.cleanDOMStyled(el as HTMLElement, 3);
  }

  jsx += `    </div>\n  );\n}\n`;

  return {
    jsx,
    sections,
    sourceUrl: window.location.href,
    timestamp: new Date().toISOString()
  };
};

// Main entry: clone the full page structure (original unstyled version)
DL.cloneStructure = (): any => {
  const topLevel = Array.from(document.body.children).filter(el => {
    if (SKIP_TAGS.has(el.tagName)) return false;
    try { return !DL.shouldSkipElement(el as HTMLElement); } catch { return false; }
  });

  // Identify sections
  const sections = topLevel.map(el => ({
    type: DL.classifySection(el as HTMLElement),
    tag: el.tagName.toLowerCase(),
    heading: el.querySelector('h1, h2, h3')?.textContent?.trim().slice(0, 80) || null
  }));

  // Generate clean HTML
  let html = `<!-- DesignLift: Cloned from ${window.location.href} on ${new Date().toISOString().split('T')[0]} -->\n`;
  html += `<!-- Sections: ${sections.map(s => s.type).join(', ')} -->\n\n`;

  for (const el of topLevel) {
    html += DL.cleanDOM(el as HTMLElement, 0);
  }

  return {
    html,
    sections,
    sourceUrl: window.location.href,
    timestamp: new Date().toISOString()
  };
};
