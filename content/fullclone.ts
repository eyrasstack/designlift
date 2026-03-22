// DesignLift — Full 1:1 Clone Engine
// Captures every visible element with ALL computed inline styles.
// Output is a self-contained JSX file that renders identically.

var DL: any = (window as any).__DL;

// ─── CSS properties to capture (visually meaningful only) ────
const PROPS: string[] = [
  // Box model
  'width','height','minWidth','minHeight','maxWidth','maxHeight',
  'marginTop','marginRight','marginBottom','marginLeft',
  'paddingTop','paddingRight','paddingBottom','paddingLeft','boxSizing',
  // Layout
  'display','position','top','right','bottom','left','zIndex','float',
  // Flex
  'flexDirection','flexWrap','justifyContent','alignItems','alignContent',
  'alignSelf','flexGrow','flexShrink','flexBasis','order','gap','rowGap','columnGap',
  // Grid
  'gridTemplateColumns','gridTemplateRows','gridColumnStart','gridColumnEnd',
  'gridRowStart','gridRowEnd','gridAutoFlow','gridAutoColumns','gridAutoRows',
  // Typography
  'fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing',
  'textAlign','textTransform','textDecoration','textDecorationColor',
  'textDecorationStyle','whiteSpace','wordBreak','textOverflow','textIndent',
  // Color / background
  'color','backgroundColor','backgroundImage','backgroundSize',
  'backgroundPosition','backgroundRepeat','backgroundClip',
  // Border
  'borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth',
  'borderTopStyle','borderRightStyle','borderBottomStyle','borderLeftStyle',
  'borderTopColor','borderRightColor','borderBottomColor','borderLeftColor',
  'borderTopLeftRadius','borderTopRightRadius','borderBottomRightRadius','borderBottomLeftRadius',
  // Visual
  'opacity','overflow','overflowX','overflowY','boxShadow','outline','outlineOffset',
  'transform','transformOrigin','filter','backdropFilter','clipPath',
  // Other
  'objectFit','objectPosition','cursor','pointerEvents','userSelect',
  'visibility','listStyleType','verticalAlign',
  // SVG
  'fill','stroke','strokeWidth',
];

// Properties that inherit via CSS cascade (safe to omit if parent has same value)
const INHERITED = new Set([
  'color','fontFamily','fontSize','fontStyle','fontWeight','lineHeight',
  'letterSpacing','textAlign','textTransform','visibility','cursor',
  'listStyleType','whiteSpace','wordBreak','textIndent',
]);

// Tags to skip entirely
const SKIP = new Set(['SCRIPT','NOSCRIPT','STYLE','LINK','META','HEAD','BASE','TEMPLATE','IFRAME']);
const JUNK = /cookie|consent|gdpr|popup|modal|overlay|admin-bar|wp-admin|chat-widget|intercom|drift|crisp/i;

// JSX attribute name conversions
const ATTR_MAP: Record<string, string> = {
  'class': 'className', 'for': 'htmlFor', 'tabindex': 'tabIndex',
  'colspan': 'colSpan', 'rowspan': 'rowSpan', 'maxlength': 'maxLength',
  'readonly': 'readOnly', 'autocomplete': 'autoComplete',
};

// ─── Default style cache ─────────────────────────────────────
let defaultCache: Map<string, Record<string, string>> = new Map();

DL._buildDefaultCache = () => {
  defaultCache = new Map();
  // Create a hidden container for reference elements
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-99999px;top:-99999px;visibility:hidden;pointer-events:none;width:0;height:0;overflow:hidden';
  document.body.appendChild(container);

  // Collect all unique tag names on the page
  const tags = new Set<string>();
  document.querySelectorAll('body *').forEach(el => {
    if (!SKIP.has(el.tagName)) tags.add(el.tagName);
  });

  // Build reference for each tag
  tags.forEach(tag => {
    try {
      const ref = document.createElement(tag.toLowerCase());
      container.appendChild(ref);
      const cs = getComputedStyle(ref);
      const defaults: Record<string, string> = {};
      PROPS.forEach(p => {
        try { defaults[p] = cs.getPropertyValue(kebabCase(p)) || (cs as any)[p] || ''; } catch(e) {}
      });
      defaultCache.set(tag, defaults);
      container.removeChild(ref);
    } catch(e) {}
  });

  document.body.removeChild(container);
};

// ─── Helpers ─────────────────────────────────────────────────
function kebabCase(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

function escapeJSX(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;')
    .replace(/'/g, '&apos;')
    .replace(/"/g, '&quot;');
}

function shouldSkip(el: HTMLElement): boolean {
  if (SKIP.has(el.tagName)) return true;
  const s = getComputedStyle(el);
  if (s.display === 'none') return true;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0 && !el.children.length) return true;
  const cls = el.className?.toString?.() || '';
  const id = el.id || '';
  if (JUNK.test(cls) || JUNK.test(id)) return true;
  return false;
}

// ─── Style diff: get non-default styles for an element ───────
DL._getStyleDiff = (el: HTMLElement, parentStyles: Record<string, string> | null): Record<string, string> => {
  const tag = el.tagName;
  const cs = getComputedStyle(el);
  const defaults = defaultCache.get(tag) || {};
  const diff: Record<string, string> = {};
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rect = el.getBoundingClientRect();

  PROPS.forEach(prop => {
    let val: string;
    try { val = (cs as any)[prop] || ''; } catch(e) { return; }
    if (!val) return;

    const defVal = defaults[prop] || '';

    // Skip if same as default
    if (val === defVal) return;

    // Skip if inherited property matches parent (cascade will handle it)
    if (INHERITED.has(prop) && parentStyles && parentStyles[prop] === val) return;

    // Smart value substitutions
    if (prop === 'width') {
      if (rect.width >= vw * 0.98) { diff[prop] = '100%'; return; }
    }
    if (prop === 'height') {
      if (rect.height >= vh * 0.95 && val !== 'auto') { diff[prop] = '100vh'; return; }
    }

    // Skip vendor-prefixed duplicates we don't need
    if (prop === 'boxSizing' && val === 'border-box') return; // common reset

    diff[prop] = val;
  });

  return diff;
};

// ─── Format style object as JSX string ───────────────────────
function styleToJSX(styles: Record<string, string>): string {
  const entries = Object.entries(styles);
  if (entries.length === 0) return '';
  const pairs = entries.map(([k, v]) => {
    // Numeric values that don't need quotes
    if (/^-?\d+(\.\d+)?$/.test(v) && !['fontWeight','zIndex','order','flexGrow','flexShrink','opacity'].includes(k)) {
      return `${k}: "${v}"`;
    }
    // Escape quotes in value
    const escaped = v.replace(/"/g, '\\"');
    return `${k}: "${escaped}"`;
  });
  return `{{ ${pairs.join(', ')} }}`;
}

// ─── Capture pseudo-elements (::before, ::after) ─────────────
function capturePseudo(el: HTMLElement, pseudo: '::before' | '::after'): string {
  try {
    const ps = getComputedStyle(el, pseudo);
    const content = ps.content;
    if (!content || content === 'none' || content === 'normal' || content === '""' || content === "''") return '';

    const styles: Record<string, string> = {};
    PROPS.forEach(prop => {
      try {
        const val = (ps as any)[prop] || '';
        if (val && val !== 'auto' && val !== 'none' && val !== 'normal' && val !== '0px' && val !== 'rgba(0, 0, 0, 0)') {
          styles[prop] = val;
        }
      } catch(e) {}
    });

    // Extract text content
    let textContent = '';
    if (content.startsWith('"') || content.startsWith("'")) {
      textContent = content.slice(1, -1);
    }

    const styleStr = styleToJSX(styles);
    return `<span data-pseudo="${pseudo}" style=${styleStr}>${escapeJSX(textContent)}</span>\n`;
  } catch(e) {
    return '';
  }
}

// ─── Capture SVG as sanitized HTML ───────────────────────────
function captureSVG(el: Element): string {
  try {
    let html = el.outerHTML;
    // Sanitize: remove scripts, event handlers
    html = html.replace(/<script[^>]*>.*?<\/script>/gi, '');
    html = html.replace(/\s+on\w+="[^"]*"/gi, '');
    // Get dimensions
    const rect = el.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    return `<div style={{ width: "${w}px", height: "${h}px", display: "inline-block" }} dangerouslySetInnerHTML={{ __html: \`${html.replace(/`/g, '\\`')}\` }} />\n`;
  } catch(e) {
    return '';
  }
}

// ─── Collect font resources from the page ────────────────────
DL._collectFonts = (): string => {
  const urls: string[] = [];
  // Google Fonts links
  document.querySelectorAll('link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]').forEach(link => {
    const href = (link as HTMLLinkElement).href;
    if (href && !urls.includes(href)) urls.push(href);
  });
  // @import in stylesheets
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule instanceof CSSImportRule && rule.href) {
          if (rule.href.includes('fonts') && !urls.includes(rule.href)) urls.push(rule.href);
        }
      }
    } catch(e) {}
  }
  // @font-face rules
  const fontFaces: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule instanceof CSSFontFaceRule) {
          fontFaces.push(rule.cssText);
        }
      }
    } catch(e) {}
  }

  let css = '';
  urls.forEach(u => { css += `@import url("${u}");\n`; });
  fontFaces.forEach(ff => { css += ff + '\n'; });
  return css;
};

// ─── Main recursive walker ───────────────────────────────────
DL._walkElement = (el: HTMLElement, depth: number, parentStyles: Record<string, string> | null): string => {
  if (depth > 30) return '';
  if (shouldSkip(el)) return '';

  const indent = '  '.repeat(depth);
  let tag = el.tagName.toLowerCase();

  // SVG — capture as raw HTML
  if (tag === 'svg') {
    return indent + captureSVG(el);
  }

  // Get style diff
  const styles = DL._getStyleDiff(el, parentStyles);
  const styleStr = Object.keys(styles).length > 0 ? ` style=${styleToJSX(styles)}` : '';

  // ─── Special elements ───

  // IMG
  if (tag === 'img') {
    const src = (el as HTMLImageElement).currentSrc || el.getAttribute('src') || el.getAttribute('data-src') || '';
    const alt = el.getAttribute('alt') || '';
    return `${indent}<img${styleStr} src="${src}" alt="${escapeJSX(alt)}" />\n`;
  }

  // VIDEO
  if (tag === 'video') {
    const sources = el.querySelectorAll('source');
    let srcTags = '';
    sources.forEach(s => {
      srcTags += `${indent}  <source src="${s.getAttribute('src') || ''}" type="${s.getAttribute('type') || 'video/mp4'}" />\n`;
    });
    if (!srcTags) {
      const src = el.getAttribute('src') || '';
      if (src) srcTags = `${indent}  <source src="${src}" type="video/mp4" />\n`;
    }
    const attrs = ['muted','autoPlay','loop','playsInline'].filter(a => (el as any)[a.toLowerCase()] || el.hasAttribute(a.toLowerCase())).join(' ');
    return `${indent}<video${styleStr} ${attrs} preload="metadata">\n${srcTags}${indent}</video>\n`;
  }

  // INPUT
  if (tag === 'input') {
    const type = el.getAttribute('type') || 'text';
    const ph = el.getAttribute('placeholder') || '';
    const name = el.getAttribute('name') || '';
    const val = el.getAttribute('value') || '';
    return `${indent}<input${styleStr} type="${type}" placeholder="${escapeJSX(ph)}" name="${name}" defaultValue="${escapeJSX(val)}" />\n`;
  }

  // SELECT
  if (tag === 'select') {
    const name = el.getAttribute('name') || '';
    let opts = '';
    el.querySelectorAll('option').forEach(opt => {
      const v = opt.getAttribute('value') || '';
      const t = opt.textContent?.trim() || '';
      opts += `${indent}  <option value="${escapeJSX(v)}">${escapeJSX(t)}</option>\n`;
    });
    return `${indent}<select${styleStr} name="${name}">\n${opts}${indent}</select>\n`;
  }

  // TEXTAREA
  if (tag === 'textarea') {
    const ph = el.getAttribute('placeholder') || '';
    return `${indent}<textarea${styleStr} placeholder="${escapeJSX(ph)}" />\n`;
  }

  // BR / HR
  if (tag === 'br') return `${indent}<br />\n`;
  if (tag === 'hr') return `${indent}<hr${styleStr} />\n`;

  // ─── Build attributes ───
  let attrs = styleStr;

  if (tag === 'a') {
    let href = el.getAttribute('href') || '#';
    try {
      const url = new URL(href, window.location.origin);
      href = url.href; // absolute URL
    } catch(e) {}
    attrs += ` href="${href}"`;
    if (el.getAttribute('target')) attrs += ` target="${el.getAttribute('target')}"`;
  }

  if (tag === 'button') {
    attrs += ` type="${el.getAttribute('type') || 'button'}"`;
  }

  if (tag === 'form') {
    attrs += ` action="${el.getAttribute('action') || '#'}"`;
    if (el.getAttribute('method')) attrs += ` method="${el.getAttribute('method')}"`;
  }

  // ─── Build children ───
  let children = '';

  // Pseudo ::before
  children += capturePseudo(el, '::before');

  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 3) { // Text
      const text = child.textContent || '';
      if (text.trim()) {
        children += indent + '  ' + escapeJSX(text.trim()) + '\n';
      }
    } else if (child.nodeType === 1) { // Element
      children += DL._walkElement(child as HTMLElement, depth + 1, styles);
    }
  }

  // Pseudo ::after
  children += capturePseudo(el, '::after');

  // Self-closing if no children
  if (!children.trim()) {
    return `${indent}<${tag}${attrs} />\n`;
  }

  return `${indent}<${tag}${attrs}>\n${children}${indent}</${tag}>\n`;
};

// ─── Main entry point ────────────────────────────────────────
DL.fullClone = (): any => {
  const sendProgress = (p: number, msg: string) => {
    try { chrome.runtime.sendMessage({ action: 'scanProgress', progress: p, status: msg }); } catch(e) {}
  };

  sendProgress(0.05, 'Building style reference cache...');
  DL._buildDefaultCache();

  sendProgress(0.1, 'Collecting font resources...');
  const fontCSS = DL._collectFonts();

  sendProgress(0.15, 'Walking DOM tree...');

  // Get all top-level children of body
  const topLevel = Array.from(document.body.children).filter(el => {
    if (SKIP.has(el.tagName)) return false;
    try { return !shouldSkip(el as HTMLElement); } catch { return false; }
  });

  // Walk the tree
  let bodyContent = '';
  const total = topLevel.length;
  topLevel.forEach((el, i) => {
    sendProgress(0.15 + (i / total) * 0.75, `Cloning element ${i + 1}/${total}...`);
    bodyContent += DL._walkElement(el as HTMLElement, 3, null);
  });

  // Get body styles
  const bodyStyles = DL._getStyleDiff(document.body, null);
  const bodyStyleStr = styleToJSX(bodyStyles);

  sendProgress(0.95, 'Generating output...');

  const viewport = `${window.innerWidth}x${window.innerHeight}`;
  let jsx = '';
  jsx += `// 1:1 Full Clone by DesignLift\n`;
  jsx += `// Source: ${window.location.href}\n`;
  jsx += `// Date: ${new Date().toISOString().split('T')[0]}\n`;
  jsx += `// Viewport: ${viewport}\n`;
  jsx += `// Styles are inline — accurate at the captured viewport width.\n`;
  jsx += `// No hover/focus states, no media queries, no CSS animations.\n\n`;
  jsx += `export default function ClonedPage() {\n`;
  jsx += `  return (\n`;
  jsx += `    <>\n`;
  if (fontCSS) {
    jsx += `      <style dangerouslySetInnerHTML={{ __html: \`${fontCSS.replace(/`/g, '\\`')}\` }} />\n`;
  }
  jsx += `      <div style=${bodyStyleStr || '{{ }}'}>\n`;
  jsx += bodyContent;
  jsx += `      </div>\n`;
  jsx += `    </>\n`;
  jsx += `  );\n`;
  jsx += `}\n`;

  sendProgress(1.0, 'Complete!');

  return {
    jsx,
    sourceUrl: window.location.href,
    timestamp: new Date().toISOString(),
    viewport,
  };
};
