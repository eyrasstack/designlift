// DesignLift — Shared utilities for content scripts
// Attached to window.__DL namespace, injected first

var DL: any = ((window as any).__DL = (window as any).__DL || {});

// Parse rgb()/rgba() string from getComputedStyle into {r, g, b, a}
DL.parseColor = (str: string): { r: number; g: number; b: number; a: number } | null => {
  if (!str || str === 'transparent' || str === 'none') return null;

  const rgba = str.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)/);
  if (rgba) {
    return {
      r: parseInt(rgba[1]),
      g: parseInt(rgba[2]),
      b: parseInt(rgba[3]),
      a: rgba[4] !== undefined ? parseFloat(rgba[4]) : 1
    };
  }

  // Handle hex (rare from computed style, but possible from attributes)
  const hex = str.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
    };
  }

  return null;
};

DL.rgbToHex = (r: number, g: number, b: number): string => {
  return '#' + [r, g, b].map(v => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, '0')).join('');
};

DL.rgbToHsl = (r: number, g: number, b: number): { h: number; s: number; l: number } => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
};

// Euclidean distance in RGB space — good enough for grouping similar colors
DL.colorDistance = (c1: { r: number; g: number; b: number }, c2: { r: number; g: number; b: number }): number => {
  return Math.sqrt((c1.r - c2.r) ** 2 + (c1.g - c2.g) ** 2 + (c1.b - c2.b) ** 2);
};

// Generate a simplified CSS selector for an element (for sample display)
DL.getSelector = (el: Element): string => {
  if (el.id) return '#' + el.id;
  const tag = el.tagName.toLowerCase();
  const cls = el.className && typeof el.className === 'string'
    ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
    : '';
  return tag + cls;
};

// Check element visibility
DL.isVisible = (el: HTMLElement): boolean => {
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (parseFloat(style.opacity) === 0) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  return true;
};

// Parse CSS px value to number
DL.pxToNum = (val: string): number => parseFloat(val) || 0;

// Convert px to rem string
DL.pxToRem = (px: number, base: number = 16): string => {
  return (px / base).toFixed(3).replace(/\.?0+$/, '') + 'rem';
};

// Extract rgba() colors from a box-shadow string
DL.parseShadowColors = (shadow: string): string[] => {
  if (!shadow || shadow === 'none') return [];
  const colors: string[] = [];
  const regex = /rgba?\([^)]+\)/g;
  let match;
  while ((match = regex.exec(shadow)) !== null) colors.push(match[0]);
  return colors;
};

// Extract rgba() colors from gradient background-image
DL.parseGradientColors = (gradient: string): string[] => {
  if (!gradient || !gradient.includes('gradient')) return [];
  const colors: string[] = [];
  const regex = /rgba?\([^)]+\)/g;
  let match;
  while ((match = regex.exec(gradient)) !== null) colors.push(match[0]);
  return colors;
};

// Collect visible elements up to a limit (performance guard)
DL.getVisibleElements = (limit: number = 500): HTMLElement[] => {
  const all = document.querySelectorAll('body *');
  const visible: HTMLElement[] = [];
  for (let i = 0; i < all.length && visible.length < limit; i++) {
    const el = all[i] as HTMLElement;
    if (DL.isVisible(el)) visible.push(el);
  }
  return visible;
};
