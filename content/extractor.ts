// DesignLift — Design token extraction engine
// Depends on utils.ts (window.__DL)

var DL: any = (window as any).__DL;

// ─── COLOR EXTRACTION ───────────────────────────────────────────────

DL.extractColors = (elements: HTMLElement[]): any[] => {
  const colorMap = new Map<string, {
    hex: string; r: number; g: number; b: number; a: number;
    count: number; categories: Set<string>; samples: string[];
  }>();

  const addColor = (colorStr: string, category: string, el: Element) => {
    const parsed = DL.parseColor(colorStr);
    if (!parsed || parsed.a < 0.05) return;
    // Skip pure transparent black
    if (parsed.r === 0 && parsed.g === 0 && parsed.b === 0 && parsed.a === 0) return;

    const hex = DL.rgbToHex(parsed.r, parsed.g, parsed.b);

    if (colorMap.has(hex)) {
      const existing = colorMap.get(hex)!;
      existing.count++;
      existing.categories.add(category);
      if (existing.samples.length < 3) existing.samples.push(DL.getSelector(el));
    } else {
      colorMap.set(hex, {
        hex, r: parsed.r, g: parsed.g, b: parsed.b, a: parsed.a,
        count: 1, categories: new Set([category]), samples: [DL.getSelector(el)]
      });
    }
  };

  for (const el of elements) {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();

    // Text color
    addColor(style.color, 'text', el);

    // Background color (skip fully transparent)
    if (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
      const isLarge = rect.width > window.innerWidth * 0.5 || rect.height > 200;
      addColor(style.backgroundColor, isLarge ? 'background' : 'surface', el);
    }

    // Border color
    if (style.borderColor && DL.pxToNum(style.borderTopWidth) > 0) {
      // borderColor may list 4 sides — take the first
      const bc = style.borderColor.split(/\s(?=rgb)|\s(?=#)/)[0];
      addColor(bc, 'border', el);
    }

    // Box shadow colors
    DL.parseShadowColors(style.boxShadow).forEach((c: string) => addColor(c, 'shadow', el));

    // Gradient colors
    DL.parseGradientColors(style.backgroundImage).forEach((c: string) => addColor(c, 'surface', el));

    // SVG fill/stroke
    if (el instanceof SVGElement) {
      if (style.fill && style.fill !== 'none') addColor(style.fill, 'accent', el);
      if (style.stroke && style.stroke !== 'none') addColor(style.stroke, 'accent', el);
    }
  }

  // Merge similar colors (RGB distance < 15)
  const colors = Array.from(colorMap.values());
  const merged: typeof colors = [];
  const used = new Set<number>();

  for (let i = 0; i < colors.length; i++) {
    if (used.has(i)) continue;
    const group = colors[i];
    for (let j = i + 1; j < colors.length; j++) {
      if (used.has(j)) continue;
      if (DL.colorDistance(group, colors[j]) < 15) {
        group.count += colors[j].count;
        colors[j].categories.forEach((c: string) => group.categories.add(c));
        used.add(j);
      }
    }
    merged.push(group);
  }

  // Assign primary category per color
  const categorized = merged.map(c => {
    const hsl = DL.rgbToHsl(c.r, c.g, c.b);
    // Pick the most meaningful category from the set
    let category: string;
    if (c.categories.has('background')) category = 'background';
    else if (c.categories.has('surface')) category = 'surface';
    else if (c.categories.has('text')) category = 'text-primary';
    else if (c.categories.has('border')) category = 'border';
    else if (c.categories.has('shadow')) category = 'shadow';
    else category = 'accent';

    // Override: saturated non-text colors → accent
    if (hsl.s > 40 && category === 'surface' && hsl.l > 15 && hsl.l < 85) {
      category = 'accent';
    }

    return {
      hex: c.hex,
      rgb: { r: c.r, g: c.g, b: c.b },
      hsl: { h: hsl.h, s: hsl.s, l: hsl.l },
      opacity: c.a,
      category,
      frequency: c.count,
      sampleElements: c.samples
    };
  });

  // Sort text colors by frequency, assign hierarchy
  const textColors = categorized
    .filter(c => c.category === 'text-primary')
    .sort((a, b) => b.frequency - a.frequency);
  if (textColors.length > 0) textColors[0].category = 'text-primary';
  if (textColors.length > 1) textColors[1].category = 'text-secondary';
  for (let i = 2; i < textColors.length; i++) textColors[i].category = 'text-muted';

  // Sort all by frequency, limit 5 per category
  categorized.sort((a, b) => b.frequency - a.frequency);
  const result: any[] = [];
  const categoryCount: Record<string, number> = {};
  for (const c of categorized) {
    categoryCount[c.category] = (categoryCount[c.category] || 0) + 1;
    if (categoryCount[c.category] <= 5) result.push(c);
  }

  return result;
};

// ─── TYPOGRAPHY EXTRACTION ──────────────────────────────────────────

DL.extractTypography = (elements: HTMLElement[]): { tokens: any[]; fontStack: any } => {
  const styleMap = new Map<string, {
    fontSize: number; fontFamily: string; fontWeight: number;
    lineHeight: number; letterSpacing: string; textTransform: string;
    count: number; sampleText: string; tag: string;
  }>();
  const fontFrequency = new Map<string, number>();

  for (const el of elements) {
    const text = el.textContent?.trim();
    if (!text) continue;
    // Only consider elements with their own direct text content
    const hasDirectText = Array.from(el.childNodes).some(
      n => n.nodeType === 3 && (n.textContent?.trim().length || 0) > 0
    );
    if (!hasDirectText && el.children.length > 0) continue;

    const style = getComputedStyle(el);
    const fontSize = DL.pxToNum(style.fontSize);
    if (fontSize === 0) continue;

    const fontFamily = style.fontFamily;
    const fontWeight = parseInt(style.fontWeight) || 400;
    const lh = style.lineHeight === 'normal' ? 1.5 : DL.pxToNum(style.lineHeight) / fontSize;
    const ls = style.letterSpacing === 'normal'
      ? '0em'
      : (DL.pxToNum(style.letterSpacing) / fontSize).toFixed(3) + 'em';
    const tt = style.textTransform || 'none';
    const key = `${fontSize}-${fontWeight}-${fontFamily}`;

    fontFrequency.set(fontFamily, (fontFrequency.get(fontFamily) || 0) + 1);

    if (styleMap.has(key)) {
      styleMap.get(key)!.count++;
    } else {
      styleMap.set(key, {
        fontSize, fontFamily, fontWeight,
        lineHeight: Math.round(lh * 100) / 100,
        letterSpacing: ls, textTransform: tt,
        count: 1, sampleText: text.slice(0, 50),
        tag: el.tagName.toLowerCase()
      });
    }
  }

  // Sort by font size descending
  const styles = Array.from(styleMap.values()).sort((a, b) => b.fontSize - a.fontSize);

  // Assign semantic roles
  const tokens: any[] = [];
  const usedRoles = new Set<string>();
  const tagRoleMap: Record<string, string> = { h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4' };

  for (const s of styles) {
    let role = tagRoleMap[s.tag] || '';

    if (!role) {
      if (!usedRoles.has('hero') && s.fontSize >= 40) role = 'hero';
      else if (!usedRoles.has('h1') && s.fontSize >= 32) role = 'h1';
      else if (!usedRoles.has('h2') && s.fontSize >= 24) role = 'h2';
      else if (!usedRoles.has('h3') && s.fontSize >= 18) role = 'h3';
      else if (s.fontSize <= 12 && s.textTransform === 'uppercase') role = 'label';
      else if (s.fontSize < 14) role = 'small';
      else continue;
    }

    if (usedRoles.has(role)) continue;
    usedRoles.add(role);

    tokens.push({
      role, fontFamily: s.fontFamily,
      fontSize: DL.pxToRem(s.fontSize), fontSizePx: s.fontSize,
      fontWeight: s.fontWeight, lineHeight: s.lineHeight,
      letterSpacing: s.letterSpacing, textTransform: s.textTransform,
      sampleText: s.sampleText
    });
  }

  // Add body if not detected — use most common font size
  if (!usedRoles.has('body') && styles.length > 0) {
    const bodyStyle = styles.reduce((a, b) => a.count > b.count ? a : b);
    tokens.push({
      role: 'body', fontFamily: bodyStyle.fontFamily,
      fontSize: DL.pxToRem(bodyStyle.fontSize), fontSizePx: bodyStyle.fontSize,
      fontWeight: bodyStyle.fontWeight, lineHeight: bodyStyle.lineHeight,
      letterSpacing: bodyStyle.letterSpacing, textTransform: bodyStyle.textTransform,
      sampleText: bodyStyle.sampleText
    });
  }

  // Sort by semantic hierarchy
  const order = ['hero', 'h1', 'h2', 'h3', 'h4', 'body', 'small', 'label'];
  tokens.sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role));

  // Build font stack
  const families = Array.from(fontFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([f]) => f);

  // Detect Google Fonts URL
  let googleFontsUrl: string | undefined;
  document.querySelectorAll('link[href*="fonts.googleapis.com"]').forEach(link => {
    if (!googleFontsUrl) googleFontsUrl = (link as HTMLLinkElement).href;
  });
  if (!googleFontsUrl) {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          if (rule instanceof CSSImportRule && rule.href?.includes('fonts.googleapis.com')) {
            googleFontsUrl = rule.href;
          }
        }
      } catch (e) { /* CORS */ }
    }
  }

  const systemFonts = ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif', 'serif', 'monospace'];
  const localFonts = families.filter(f => systemFonts.some(sf => f.toLowerCase().includes(sf.toLowerCase())));

  return {
    tokens,
    fontStack: { families, googleFontsUrl, localFonts }
  };
};

// ─── SPACING EXTRACTION ─────────────────────────────────────────────

DL.extractSpacing = (elements: HTMLElement[]): { tokens: any[]; layout: any } => {
  const spacingValues = new Map<number, { count: number; usedAs: Set<string> }>();

  const addSpacing = (val: string, type: string) => {
    const px = Math.round(DL.pxToNum(val));
    if (px <= 0 || px > 500) return;
    if (spacingValues.has(px)) {
      spacingValues.get(px)!.count++;
      spacingValues.get(px)!.usedAs.add(type);
    } else {
      spacingValues.set(px, { count: 1, usedAs: new Set([type]) });
    }
  };

  let containerMaxWidth = '1280px';
  const sectionPaddings: number[] = [];
  const sectionPaddingsX: number[] = [];
  const gaps: number[] = [];
  const cardPaddings: number[] = [];

  for (const el of elements) {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();

    // Padding & margin
    for (const prop of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']) {
      addSpacing((style as any)[prop], 'padding');
    }
    for (const prop of ['marginTop', 'marginRight', 'marginBottom', 'marginLeft']) {
      addSpacing((style as any)[prop], 'margin');
    }

    // Gap
    if (style.gap && style.gap !== 'normal' && style.gap !== '0px') {
      const gapVal = style.gap.split(' ')[0]; // row gap
      addSpacing(gapVal, 'gap');
      gaps.push(DL.pxToNum(gapVal));
    }

    // Container detection (margin:auto + max-width)
    if (style.marginLeft === 'auto' && style.marginRight === 'auto' && style.maxWidth !== 'none') {
      const mw = DL.pxToNum(style.maxWidth);
      if (mw > 800 && mw < 2000) containerMaxWidth = Math.round(mw) + 'px';
    }

    // Section padding
    const tag = el.tagName.toLowerCase();
    if (tag === 'section' || (tag === 'div' && el.parentElement?.tagName === 'MAIN')) {
      const py = DL.pxToNum(style.paddingTop);
      const px_val = DL.pxToNum(style.paddingLeft);
      if (py > 20) sectionPaddings.push(py);
      if (px_val > 8) sectionPaddingsX.push(px_val);
    }

    // Card padding
    if (rect.width > 100 && rect.width < 600 && rect.height > 50 && rect.height < 500) {
      if (style.boxShadow !== 'none' || DL.pxToNum(style.borderTopWidth) > 0 || style.borderRadius !== '0px') {
        const cp = DL.pxToNum(style.paddingTop);
        if (cp > 0) cardPaddings.push(cp);
      }
    }
  }

  // Mode (most frequent) helper
  const mode = (arr: number[]): number => {
    if (!arr.length) return 0;
    const freq = new Map<number, number>();
    arr.forEach(v => freq.set(Math.round(v), (freq.get(Math.round(v)) || 0) + 1));
    return Array.from(freq.entries()).sort((a, b) => b[1] - a[1])[0][0];
  };

  // Tailwind scale mapping
  const twScale: Record<number, string> = {
    0: '0', 1: 'px', 2: '0.5', 4: '1', 6: '1.5', 8: '2', 10: '2.5',
    12: '3', 14: '3.5', 16: '4', 20: '5', 24: '6', 28: '7', 32: '8',
    36: '9', 40: '10', 44: '11', 48: '12', 56: '14', 64: '16',
    80: '20', 96: '24', 112: '28', 128: '32', 160: '40', 192: '48',
    224: '56', 256: '64', 288: '72', 320: '80', 384: '96'
  };
  const findTw = (px: number): string => {
    let closest = '0', minD = Infinity;
    for (const [k, v] of Object.entries(twScale)) {
      const d = Math.abs(parseInt(k) - px);
      if (d < minD) { minD = d; closest = v; }
    }
    return closest;
  };

  const tokens = Array.from(spacingValues.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(0, 20)
    .map(([px, data]) => ({
      value: px + 'px',
      tailwindClass: findTw(px),
      frequency: data.count,
      usedAs: Array.from(data.usedAs)
    }));

  return {
    tokens,
    layout: {
      containerMaxWidth,
      sectionPaddingY: (mode(sectionPaddings) || 80) + 'px',
      sectionPaddingX: (mode(sectionPaddingsX) || 24) + 'px',
      gridGap: (mode(gaps) || 24) + 'px',
      cardPadding: (mode(cardPaddings) || 24) + 'px'
    }
  };
};

// ─── BORDERS EXTRACTION ─────────────────────────────────────────────

DL.extractBorders = (elements: HTMLElement[]): any => {
  const radii = new Map<string, number>();
  const widths = new Map<string, number>();

  for (const el of elements) {
    const style = getComputedStyle(el);
    const br = style.borderRadius;
    if (br && br !== '0px') radii.set(br, (radii.get(br) || 0) + 1);

    const bw = style.borderTopWidth;
    if (bw && bw !== '0px') widths.set(bw, (widths.get(bw) || 0) + 1);
  }

  const sortedRadii = Array.from(radii.entries()).sort((a, b) => b[1] - a[1]);
  const sortedWidths = Array.from(widths.entries()).sort((a, b) => b[1] - a[1]);
  const hasPill = sortedRadii.some(([r]) => DL.pxToNum(r) > 100 || r.includes('50%'));

  return {
    radius: sortedRadii.map(([r]) => r),
    widths: sortedWidths.map(([w]) => w),
    defaultRadius: sortedRadii[0]?.[0] || '0px',
    pillRadius: hasPill ? '9999px' : undefined
  };
};

// ─── SHADOWS EXTRACTION ─────────────────────────────────────────────

DL.extractShadows = (elements: HTMLElement[]): any[] => {
  const shadowMap = new Map<string, number>();

  for (const el of elements) {
    const s = getComputedStyle(el).boxShadow;
    if (s && s !== 'none') shadowMap.set(s, (shadowMap.get(s) || 0) + 1);
  }

  const categorize = (shadow: string): string => {
    const nums = shadow.match(/(\d+)px/g);
    if (!nums) return 'md';
    const values = nums.map(n => parseInt(n));
    const blur = values[2] || values[1] || 0;
    if (shadow.includes('inset')) return 'inner';
    if (values[0] === 0 && values[1] === 0 && blur > 0) return 'glow';
    if (blur <= 3) return 'sm';
    if (blur <= 12) return 'md';
    if (blur <= 30) return 'lg';
    return 'xl';
  };

  return Array.from(shadowMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([raw, freq]) => ({ raw, category: categorize(raw), frequency: freq }));
};

// ─── ANIMATIONS EXTRACTION ──────────────────────────────────────────

DL.extractAnimations = (elements: HTMLElement[]): any[] => {
  const transMap = new Map<string, number>();

  for (const el of elements) {
    const t = getComputedStyle(el).transition;
    if (t && t !== 'all 0s ease 0s' && t !== 'none') {
      transMap.set(t, (transMap.get(t) || 0) + 1);
    }
  }

  return Array.from(transMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([raw, freq]) => {
      const first = raw.split(',')[0].trim();
      const match = first.match(/([\w-]+)\s+([\d.]+m?s)\s+(.+?)(?:\s+[\d.]+m?s)?$/);
      return match
        ? { property: match[1], duration: match[2], easing: match[3], frequency: freq }
        : { property: 'all', duration: '150ms', easing: 'ease', frequency: freq };
    });
};

// ─── BREAKPOINTS EXTRACTION ─────────────────────────────────────────

DL.extractBreakpoints = (): any => {
  const breakpoints = new Set<string>();

  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule instanceof CSSMediaRule) {
          const matches = rule.conditionText.match(/(?:min|max)-width:\s*(\d+)px/g);
          if (matches) {
            matches.forEach(m => {
              const bp = m.match(/(\d+)px/);
              if (bp) breakpoints.add(bp[1] + 'px');
            });
          }
        }
      }
    } catch (e) { /* CORS blocked */ }
  }

  return {
    breakpoints: Array.from(breakpoints).sort((a, b) => parseInt(a) - parseInt(b))
  };
};
