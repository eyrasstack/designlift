// DesignLift v1.3 — Computed style → Tailwind class mapper
// Captures ALL layout-critical properties for 1:1 cloning

var DL: any = (window as any).__DL;

// ─── Spacing px → Tailwind class ─────────────────────────────
const SP: Record<number, string> = {
  0:'0',1:'px',2:'0.5',4:'1',6:'1.5',8:'2',10:'2.5',12:'3',14:'3.5',
  16:'4',20:'5',24:'6',28:'7',32:'8',36:'9',40:'10',44:'11',48:'12',
  56:'14',64:'16',80:'20',96:'24',112:'28',128:'32',160:'40',192:'48',
  224:'56',256:'64',288:'72',320:'80',384:'96',
};
function sp(px: number): string {
  if (px === 0) return '0';
  const r = Math.round(px);
  return SP[r] !== undefined ? SP[r] : `[${r}px]`;
}

function txtSize(px: number): string {
  const map: Record<number, string> = {
    10:'[0.625rem]',11:'[0.6875rem]',12:'xs',13:'[0.8125rem]',14:'sm',
    16:'base',18:'lg',20:'xl',24:'2xl',30:'3xl',36:'4xl',48:'5xl',
    60:'6xl',72:'7xl',96:'8xl',128:'9xl',
  };
  const r = Math.round(px);
  if (map[r]) return map[r];
  return `[${(px / 16).toFixed(3).replace(/\.?0+$/, '')}rem]`;
}

function fwClass(w: number): string {
  const m: Record<number, string> = {
    100:'thin',200:'extralight',300:'light',400:'normal',
    500:'medium',600:'semibold',700:'bold',800:'extrabold',900:'black',
  };
  return m[w] || `[${w}]`;
}

// ─── Main extractor ──────────────────────────────────────────
DL.getElementTailwind = (el: HTMLElement): string => {
  const s = getComputedStyle(el);
  const c: string[] = [];
  const rect = el.getBoundingClientRect();
  const parentRect = el.parentElement?.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // ── Display & Flex ──
  if (s.display === 'flex' || s.display === 'inline-flex') {
    c.push(s.display === 'inline-flex' ? 'inline-flex' : 'flex');
    if (s.flexDirection === 'column') c.push('flex-col');
    if (s.flexDirection === 'column-reverse') c.push('flex-col-reverse');
    if (s.flexDirection === 'row-reverse') c.push('flex-row-reverse');
    if (s.flexWrap === 'wrap') c.push('flex-wrap');
    const ai = s.alignItems;
    if (ai === 'center') c.push('items-center');
    else if (ai === 'flex-start' || ai === 'start') c.push('items-start');
    else if (ai === 'flex-end' || ai === 'end') c.push('items-end');
    else if (ai === 'baseline') c.push('items-baseline');
    const jc = s.justifyContent;
    if (jc === 'center') c.push('justify-center');
    else if (jc === 'flex-end' || jc === 'end') c.push('justify-end');
    else if (jc === 'space-between') c.push('justify-between');
    else if (jc === 'space-around') c.push('justify-around');
    else if (jc === 'space-evenly') c.push('justify-evenly');
    // Flex grow/shrink on the element itself
    if (s.flexGrow === '1') c.push('flex-1');
    if (s.flexShrink === '0') c.push('shrink-0');
    if (s.alignSelf === 'center') c.push('self-center');
    else if (s.alignSelf === 'flex-end' || s.alignSelf === 'end') c.push('self-end');
    else if (s.alignSelf === 'flex-start' || s.alignSelf === 'start') c.push('self-start');
  } else if (s.display === 'grid') {
    c.push('grid');
    // Grid template columns — capture the ACTUAL computed value
    const gtc = s.gridTemplateColumns;
    if (gtc && gtc !== 'none') {
      const parts = gtc.split(/\s+/);
      const colCount = parts.length;
      // Check if all columns are equal (fr units resolve to equal px)
      const allEqual = parts.every(p => p === parts[0]);
      if (allEqual && colCount <= 12) {
        c.push(`grid-cols-${colCount}`);
      } else {
        // Capture the actual column template
        // Convert px values to fr where possible
        const total = parts.reduce((sum, p) => sum + parseFloat(p), 0);
        if (total > 0) {
          const frCols = parts.map(p => {
            const px = parseFloat(p);
            const fr = Math.round((px / total) * colCount * 10) / 10;
            return fr;
          });
          // If it maps cleanly to integer frs
          const cleanFr = frCols.every(f => Math.abs(f - Math.round(f)) < 0.15);
          if (cleanFr) {
            c.push(`grid-cols-[${frCols.map(f => Math.round(f) + 'fr').join('_')}]`);
          } else {
            c.push(`grid-cols-${colCount}`);
          }
        } else {
          c.push(`grid-cols-${colCount}`);
        }
      }
    }
    // Grid template rows
    const gtr = s.gridTemplateRows;
    if (gtr && gtr !== 'none') {
      const rowCount = gtr.split(/\s+/).length;
      if (rowCount > 1 && rowCount <= 6) c.push(`grid-rows-${rowCount}`);
    }
  } else if (s.display === 'inline') {
    c.push('inline');
  } else if (s.display === 'inline-block') {
    c.push('inline-block');
  } else if (s.display === 'none') {
    c.push('hidden');
  }

  // Flex child properties (even if parent is flex, child might have these)
  if (el.parentElement) {
    const ps = getComputedStyle(el.parentElement);
    if (ps.display === 'flex' || ps.display === 'inline-flex') {
      if (s.flexGrow === '1') c.push('grow');
      if (s.flexShrink === '0') c.push('shrink-0');
    }
    // Grid child — column/row span
    if (ps.display === 'grid') {
      const gc = s.gridColumnStart;
      const gce = s.gridColumnEnd;
      if (gc && gce && gc !== 'auto' && gce !== 'auto') {
        const start = parseInt(gc);
        const end = parseInt(gce);
        if (start > 0 && end > start) {
          const span = end - start;
          if (span > 1) c.push(`col-span-${span}`);
        }
      }
      const gr = s.gridRowStart;
      const gre = s.gridRowEnd;
      if (gr && gre && gr !== 'auto' && gre !== 'auto') {
        const start = parseInt(gr);
        const end = parseInt(gre);
        if (start > 0 && end > start) {
          const span = end - start;
          if (span > 1) c.push(`row-span-${span}`);
        }
      }
    }
  }

  // ── Gap ──
  const rowGap = DL.pxToNum(s.rowGap);
  const colGap = DL.pxToNum(s.columnGap);
  if (rowGap > 0 && colGap > 0 && rowGap === colGap) {
    c.push(`gap-${sp(rowGap)}`);
  } else {
    if (rowGap > 0) c.push(`gap-y-${sp(rowGap)}`);
    if (colGap > 0) c.push(`gap-x-${sp(colGap)}`);
  }

  // ── Width ──
  const w = DL.pxToNum(s.width);
  const maxW = DL.pxToNum(s.maxWidth);
  const minW = DL.pxToNum(s.minWidth);
  const isGridChild = el.parentElement && getComputedStyle(el.parentElement).display === 'grid';

  // Full width check
  if (rect.width >= vw * 0.98) {
    c.push('w-full');
  } else if (parentRect && rect.width >= parentRect.width * 0.98 && rect.width > 100) {
    c.push('w-full');
  } else if (!isGridChild && w > 0 && s.width !== 'auto') {
    // Only add percentage widths on NON-grid children (grid uses col-span)
    if (parentRect && parentRect.width > 0) {
      const pct = (rect.width / parentRect.width) * 100;
      if (Math.abs(pct - 50) < 2) c.push('w-1/2');
      else if (Math.abs(pct - 33.33) < 2) c.push('w-1/3');
      else if (Math.abs(pct - 66.67) < 2) c.push('w-2/3');
      else if (Math.abs(pct - 25) < 2) c.push('w-1/4');
      else if (Math.abs(pct - 75) < 2) c.push('w-3/4');
    }
  }

  // Max-width — ALWAYS capture if set. Also check raw style attribute.
  let rawMaxW = maxW;
  // Also check inline/CSS max-width that computed style might resolve to px
  const rawStyle = el.getAttribute('style') || '';
  const classAttr = el.getAttribute('class') || '';
  // Webflow uses specific container classes
  if (classAttr.includes('container') || classAttr.includes('w-container')) {
    if (rawMaxW === 0 || rawMaxW >= 9999) rawMaxW = 1280; // default Webflow container
  }

  if (rawMaxW > 0 && rawMaxW < 9999 && s.maxWidth !== 'none') {
    if (rawMaxW === 1280) c.push('max-w-7xl');
    else if (rawMaxW === 1200) c.push('max-w-[1200px]');
    else if (rawMaxW === 1024) c.push('max-w-6xl');
    else if (rawMaxW === 768) c.push('max-w-4xl');
    else if (rawMaxW === 640) c.push('max-w-2xl');
    else if (rawMaxW === 448) c.push('max-w-md');
    else if (rawMaxW === 320) c.push('max-w-xs');
    else c.push(`max-w-[${Math.round(rawMaxW)}px]`);
  }

  // If element has margin:auto and a width smaller than parent, it's likely a container
  if (s.marginLeft === 'auto' && s.marginRight === 'auto' && rect.width < vw * 0.95 && rect.width > 400) {
    if (!c.some(cl => cl.startsWith('max-w'))) {
      c.push(`max-w-[${Math.round(rect.width)}px]`);
    }
  }

  // Min-width
  if (minW > 0 && s.minWidth !== '0px') c.push(`min-w-[${Math.round(minW)}px]`);

  // ── Height ──
  const h = DL.pxToNum(s.height);
  const maxH = DL.pxToNum(s.maxHeight);
  const minH = DL.pxToNum(s.minHeight);

  // Only add h-screen on top-level sections, not nested elements
  const depth = DL._getDepth ? DL._getDepth(el) : 99;
  if (rect.height >= vh * 0.95 && s.height !== 'auto' && depth <= 3) {
    c.push('h-screen');
  } else if (s.height !== 'auto' && s.height !== '0px' && h > 0 && !isGridChild) {
    if (parentRect && Math.abs(rect.height - parentRect.height) < 2 && rect.height > 50) c.push('h-full');
  }

  if (minH > 0 && s.minHeight !== '0px' && s.minHeight !== 'auto') {
    if (minH >= vh * 0.9) c.push('min-h-screen');
    else c.push(`min-h-[${Math.round(minH)}px]`);
  }
  if (maxH > 0 && maxH < 9999 && s.maxHeight !== 'none') {
    c.push(`max-h-[${Math.round(maxH)}px]`);
  }

  // ── Padding ──
  const pt = DL.pxToNum(s.paddingTop), pr = DL.pxToNum(s.paddingRight);
  const pb = DL.pxToNum(s.paddingBottom), pl = DL.pxToNum(s.paddingLeft);
  if (pt > 0 || pr > 0 || pb > 0 || pl > 0) {
    if (pt === pb && pl === pr && pt === pl) {
      c.push(`p-${sp(pt)}`);
    } else {
      if (pt === pb && pt > 0) c.push(`py-${sp(pt)}`);
      else { if (pt > 0) c.push(`pt-${sp(pt)}`); if (pb > 0) c.push(`pb-${sp(pb)}`); }
      if (pl === pr && pl > 0) c.push(`px-${sp(pl)}`);
      else { if (pl > 0) c.push(`pl-${sp(pl)}`); if (pr > 0) c.push(`pr-${sp(pr)}`); }
    }
  }

  // ── Margin ──
  const mt = DL.pxToNum(s.marginTop), mr = DL.pxToNum(s.marginRight);
  const mb = DL.pxToNum(s.marginBottom), ml = DL.pxToNum(s.marginLeft);
  if (s.marginLeft === 'auto' && s.marginRight === 'auto') {
    c.push('mx-auto');
  } else {
    if (mt !== 0) c.push(`mt-${sp(mt)}`);
    if (mb !== 0) c.push(`mb-${sp(mb)}`);
    if (ml !== 0 && s.marginLeft !== 'auto') c.push(`ml-${sp(ml)}`);
    if (mr !== 0 && s.marginRight !== 'auto') c.push(`mr-${sp(mr)}`);
  }

  // ── Typography ──
  const fontSize = DL.pxToNum(s.fontSize);
  if (fontSize && fontSize !== 16) c.push(`text-${txtSize(fontSize)}`);

  const fw = parseInt(s.fontWeight) || 400;
  if (fw !== 400) c.push(`font-${fwClass(fw)}`);

  const lh = s.lineHeight === 'normal' ? 0 : DL.pxToNum(s.lineHeight);
  if (lh > 0 && fontSize > 0) {
    const ratio = lh / fontSize;
    if (ratio <= 1) c.push('leading-none');
    else if (ratio <= 1.15) c.push('leading-tight');
    else if (ratio <= 1.375) c.push('leading-snug');
    else if (ratio <= 1.625) c.push('leading-normal');
    else if (ratio <= 1.75) c.push('leading-relaxed');
    else c.push('leading-loose');
  }

  const ls = DL.pxToNum(s.letterSpacing);
  if (ls < -0.5) c.push('tracking-tighter');
  else if (ls < -0.1) c.push('tracking-tight');
  else if (ls > 2) c.push('tracking-widest');
  else if (ls > 0.8) c.push('tracking-wide');
  else if (ls > 0.3) c.push('tracking-wider');

  if (s.textTransform === 'uppercase') c.push('uppercase');
  else if (s.textTransform === 'lowercase') c.push('lowercase');
  if (s.textAlign === 'center') c.push('text-center');
  else if (s.textAlign === 'right') c.push('text-right');
  if (s.whiteSpace === 'nowrap') c.push('whitespace-nowrap');
  if (s.wordBreak === 'break-all') c.push('break-all');

  // ── Color ──
  const color = DL.parseColor(s.color);
  if (color) {
    const hex = DL.rgbToHex(color.r, color.g, color.b);
    if (hex !== '#000000') c.push(`text-[${hex}]`);
  }

  // ── Background ──
  const bg = DL.parseColor(s.backgroundColor);
  if (bg && bg.a > 0.05) {
    const hex = DL.rgbToHex(bg.r, bg.g, bg.b);
    if (!(hex === '#ffffff' || (hex === '#f1f0ee' && el.tagName === 'BODY'))) {
      c.push(`bg-[${hex}]`);
    }
  }

  // ── Border radius ──
  const brTL = DL.pxToNum(s.borderTopLeftRadius);
  const brTR = DL.pxToNum(s.borderTopRightRadius);
  const brBL = DL.pxToNum(s.borderBottomLeftRadius);
  const brBR = DL.pxToNum(s.borderBottomRightRadius);
  if (brTL > 0 || brTR > 0 || brBL > 0 || brBR > 0) {
    if (brTL === brTR && brTR === brBL && brBL === brBR) {
      if (brTL >= 500) c.push('rounded-full');
      else c.push(`rounded-[${Math.round(brTL)}px]`);
    } else {
      // Asymmetric radius
      c.push(`rounded-[${Math.round(brTL)}px_${Math.round(brTR)}px_${Math.round(brBR)}px_${Math.round(brBL)}px]`);
    }
  }

  // ── Border ──
  const btw = DL.pxToNum(s.borderTopWidth);
  const bbw = DL.pxToNum(s.borderBottomWidth);
  const blw = DL.pxToNum(s.borderLeftWidth);
  const brw = DL.pxToNum(s.borderRightWidth);
  if (btw > 0 || bbw > 0 || blw > 0 || brw > 0) {
    if (btw === bbw && bbw === blw && blw === brw) {
      c.push(btw === 1 ? 'border' : `border-[${btw}px]`);
    } else {
      if (btw > 0) c.push(btw === 1 ? 'border-t' : `border-t-[${btw}px]`);
      if (bbw > 0) c.push(bbw === 1 ? 'border-b' : `border-b-[${bbw}px]`);
      if (blw > 0) c.push(blw === 1 ? 'border-l' : `border-l-[${blw}px]`);
      if (brw > 0) c.push(brw === 1 ? 'border-r' : `border-r-[${brw}px]`);
    }
    const bc = DL.parseColor(s.borderColor);
    if (bc) c.push(`border-[${DL.rgbToHex(bc.r, bc.g, bc.b)}]`);
  }

  // ── Position ──
  if (s.position === 'fixed') c.push('fixed');
  else if (s.position === 'absolute') c.push('absolute');
  else if (s.position === 'sticky') c.push('sticky');
  else if (s.position === 'relative') c.push('relative');

  if (s.position !== 'static') {
    const t = s.top, l = s.left, r2 = s.right, b2 = s.bottom;
    if (t === '0px' && l === '0px' && r2 === '0px' && b2 === '0px') {
      c.push('inset-0');
    } else {
      if (t === '0px') c.push('top-0');
      else if (t !== 'auto') { const v = DL.pxToNum(t); if (v !== 0) c.push(`top-${sp(v)}`); }
      if (l === '0px') c.push('left-0');
      else if (l !== 'auto') { const v = DL.pxToNum(l); if (v !== 0) c.push(`left-${sp(v)}`); }
      if (r2 === '0px') c.push('right-0');
      if (b2 === '0px') c.push('bottom-0');
    }
    const zi = parseInt(s.zIndex);
    if (!isNaN(zi) && zi !== 0) c.push(`z-${Math.abs(zi) <= 50 ? zi : '[' + zi + ']'}`);
  }

  // ── Overflow ──
  if (s.overflowX === 'hidden' && s.overflowY === 'hidden') c.push('overflow-hidden');
  else if (s.overflowX === 'hidden') c.push('overflow-x-hidden');
  else if (s.overflowY === 'hidden') c.push('overflow-y-hidden');
  if (s.overflowX === 'auto' || s.overflowX === 'scroll') c.push('overflow-x-auto');
  if (s.overflowY === 'auto' || s.overflowY === 'scroll') c.push('overflow-y-auto');

  // ── Opacity ──
  const op = parseFloat(s.opacity);
  if (op < 1 && op > 0) {
    const pct = Math.round(op * 100);
    c.push(`opacity-${pct}`);
  }

  // ── Object fit ──
  if (s.objectFit === 'cover') c.push('object-cover');
  else if (s.objectFit === 'contain') c.push('object-contain');
  if (s.objectPosition !== '50% 50%' && s.objectPosition) c.push(`object-[${s.objectPosition}]`);

  // ── Cursor ──
  if (s.cursor === 'pointer') c.push('cursor-pointer');

  return c.join(' ');
};

// ─── Font family detection ───────────────────────────────────
DL.getFontVar = (el: HTMLElement): string => {
  const ff = getComputedStyle(el).fontFamily.toLowerCase();
  if (ff.includes('dm mono') || ff.includes('jetbrains') || ff.includes('monospace')) return 'font-mono';
  if (ff.includes('creatodisplay') || ff.includes('dm serif') || ff.includes('argesta') || ff.includes('georgia') || ff.includes('times')) return 'font-serif';
  return '';
};

// ─── Aspect ratio ────────────────────────────────────────────
DL.getAspectRatio = (el: HTMLElement): string => {
  const rect = el.getBoundingClientRect();
  if (rect.width < 10 || rect.height < 10) return '';
  const r = rect.width / rect.height;
  if (Math.abs(r - 16/9) < 0.1) return 'aspect-video';
  if (Math.abs(r - 1) < 0.1) return 'aspect-square';
  return `aspect-[${Math.round(rect.width)}/${Math.round(rect.height)}]`;
};
