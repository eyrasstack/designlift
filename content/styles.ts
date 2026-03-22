// DesignLift — Computed style to Tailwind class mapper
// Extracts the actual CSS of each element and converts to utility classes

var DL: any = (window as any).__DL;

// ─── Tailwind spacing scale (px → class) ────────────────────
const SPACING: Record<number, string> = {
  0:'0',1:'px',2:'0.5',4:'1',6:'1.5',8:'2',10:'2.5',12:'3',14:'3.5',
  16:'4',20:'5',24:'6',28:'7',32:'8',36:'9',40:'10',44:'11',48:'12',
  56:'14',64:'16',80:'20',96:'24',112:'28',128:'32',160:'40',192:'48',
  224:'56',256:'64',288:'72',320:'80',384:'96',
};

function pxToSpacing(px: number): string {
  if (px === 0) return '0';
  const rounded = Math.round(px);
  if (SPACING[rounded] !== undefined) return SPACING[rounded];
  // Use arbitrary value for non-standard spacing
  return `[${rounded}px]`;
}

function pxToText(px: number): string {
  const rem = px / 16;
  const map: Record<number, string> = {
    12:'xs',14:'sm',16:'base',18:'lg',20:'xl',24:'2xl',
    30:'3xl',36:'4xl',48:'5xl',60:'6xl',72:'7xl',96:'8xl',128:'9xl',
  };
  const rounded = Math.round(px);
  if (map[rounded]) return map[rounded];
  return `[${rem.toFixed(2)}rem]`;
}

function fontWeightClass(w: number): string {
  const map: Record<number, string> = {
    100:'thin',200:'extralight',300:'light',400:'normal',
    500:'medium',600:'semibold',700:'bold',800:'extrabold',900:'black',
  };
  return map[w] || `[${w}]`;
}

// ─── Main: extract computed styles → Tailwind classes ────────
DL.getElementTailwind = (el: HTMLElement): string => {
  const s = getComputedStyle(el);
  const classes: string[] = [];
  const rect = el.getBoundingClientRect();

  // Display / layout
  if (s.display === 'flex') {
    classes.push('flex');
    if (s.flexDirection === 'column') classes.push('flex-col');
    if (s.flexDirection === 'row-reverse') classes.push('flex-row-reverse');
    if (s.flexWrap === 'wrap') classes.push('flex-wrap');
    // Align
    const ai = s.alignItems;
    if (ai === 'center') classes.push('items-center');
    else if (ai === 'flex-start') classes.push('items-start');
    else if (ai === 'flex-end') classes.push('items-end');
    else if (ai === 'stretch') {} // default
    // Justify
    const jc = s.justifyContent;
    if (jc === 'center') classes.push('justify-center');
    else if (jc === 'flex-end' || jc === 'end') classes.push('justify-end');
    else if (jc === 'space-between') classes.push('justify-between');
    else if (jc === 'space-around') classes.push('justify-around');
  } else if (s.display === 'grid') {
    classes.push('grid');
    const cols = s.gridTemplateColumns;
    if (cols && cols !== 'none') {
      const colCount = cols.split(/\s+/).length;
      if (colCount <= 12) classes.push(`grid-cols-${colCount}`);
      else classes.push(`grid-cols-[${cols}]`);
    }
  } else if (s.display === 'inline-flex') {
    classes.push('inline-flex');
  } else if (s.display === 'inline') {
    classes.push('inline');
  } else if (s.display === 'none') {
    classes.push('hidden');
  }

  // Gap
  const gap = DL.pxToNum(s.gap);
  if (gap > 0) classes.push(`gap-${pxToSpacing(gap)}`);

  // Width
  if (s.width !== 'auto' && rect.width > 0) {
    const maxW = DL.pxToNum(s.maxWidth);
    if (maxW > 0 && maxW < 9999) {
      classes.push(`max-w-[${Math.round(maxW)}px]`);
    }
    // Check if full width
    if (rect.width >= window.innerWidth * 0.98) {
      classes.push('w-full');
    }
  }

  // Height
  if (s.minHeight && s.minHeight !== '0px' && s.minHeight !== 'auto') {
    const mh = DL.pxToNum(s.minHeight);
    if (mh >= window.innerHeight * 0.9) classes.push('min-h-screen');
    else if (mh > 0) classes.push(`min-h-[${Math.round(mh)}px]`);
  }

  // Padding
  const pt = DL.pxToNum(s.paddingTop), pr = DL.pxToNum(s.paddingRight);
  const pb = DL.pxToNum(s.paddingBottom), pl = DL.pxToNum(s.paddingLeft);
  if (pt === pb && pl === pr && pt === pl && pt > 0) {
    classes.push(`p-${pxToSpacing(pt)}`);
  } else {
    if (pt === pb && pt > 0) classes.push(`py-${pxToSpacing(pt)}`);
    else {
      if (pt > 0) classes.push(`pt-${pxToSpacing(pt)}`);
      if (pb > 0) classes.push(`pb-${pxToSpacing(pb)}`);
    }
    if (pl === pr && pl > 0) classes.push(`px-${pxToSpacing(pl)}`);
    else {
      if (pl > 0) classes.push(`pl-${pxToSpacing(pl)}`);
      if (pr > 0) classes.push(`pr-${pxToSpacing(pr)}`);
    }
  }

  // Margin
  const mt = DL.pxToNum(s.marginTop), mr = DL.pxToNum(s.marginRight);
  const mb = DL.pxToNum(s.marginBottom), ml = DL.pxToNum(s.marginLeft);
  if (ml === mr && s.marginLeft === 'auto') {
    classes.push('mx-auto');
  } else {
    if (mt > 0) classes.push(`mt-${pxToSpacing(mt)}`);
    if (mb > 0) classes.push(`mb-${pxToSpacing(mb)}`);
    if (ml > 0 && s.marginLeft !== 'auto') classes.push(`ml-${pxToSpacing(ml)}`);
    if (mr > 0 && s.marginRight !== 'auto') classes.push(`mr-${pxToSpacing(mr)}`);
  }

  // Typography
  const fontSize = DL.pxToNum(s.fontSize);
  if (fontSize && fontSize !== 16) classes.push(`text-${pxToText(fontSize)}`);

  const fw = parseInt(s.fontWeight) || 400;
  if (fw !== 400) classes.push(`font-${fontWeightClass(fw)}`);

  const lh = s.lineHeight === 'normal' ? 0 : DL.pxToNum(s.lineHeight) / fontSize;
  if (lh > 0 && Math.abs(lh - 1.5) > 0.1) {
    if (lh <= 1) classes.push('leading-none');
    else if (lh <= 1.15) classes.push('leading-tight');
    else if (lh <= 1.35) classes.push('leading-snug');
    else if (lh <= 1.65) classes.push('leading-normal');
    else classes.push('leading-relaxed');
  }

  const ls = DL.pxToNum(s.letterSpacing);
  if (ls !== 0) {
    if (ls < -0.5) classes.push('tracking-tighter');
    else if (ls < 0) classes.push('tracking-tight');
    else if (ls > 1.5) classes.push('tracking-widest');
    else if (ls > 0.5) classes.push('tracking-wide');
  }

  if (s.textTransform === 'uppercase') classes.push('uppercase');
  else if (s.textTransform === 'lowercase') classes.push('lowercase');
  else if (s.textTransform === 'capitalize') classes.push('capitalize');

  if (s.textAlign === 'center') classes.push('text-center');
  else if (s.textAlign === 'right') classes.push('text-right');

  // Color
  const color = DL.parseColor(s.color);
  if (color) {
    const hex = DL.rgbToHex(color.r, color.g, color.b);
    if (hex !== '#000000') classes.push(`text-[${hex}]`);
  }

  // Background
  const bg = DL.parseColor(s.backgroundColor);
  if (bg && bg.a > 0.05) {
    const hex = DL.rgbToHex(bg.r, bg.g, bg.b);
    if (hex !== '#ffffff' && bg.a > 0.5) classes.push(`bg-[${hex}]`);
  }

  // Border radius
  const br = DL.pxToNum(s.borderRadius);
  if (br > 0) {
    if (br >= 9999 || br >= 500) classes.push('rounded-full');
    else if (br >= 12) classes.push(`rounded-[${Math.round(br)}px]`);
    else if (br >= 8) classes.push('rounded-lg');
    else if (br >= 6) classes.push('rounded-md');
    else if (br >= 4) classes.push('rounded');
    else classes.push('rounded-sm');
  }

  // Border
  if (DL.pxToNum(s.borderTopWidth) > 0) {
    const bw = DL.pxToNum(s.borderTopWidth);
    if (bw === 1) classes.push('border');
    else classes.push(`border-[${bw}px]`);
    const bc = DL.parseColor(s.borderColor);
    if (bc) classes.push(`border-[${DL.rgbToHex(bc.r, bc.g, bc.b)}]`);
  }

  // Position
  if (s.position === 'fixed') classes.push('fixed');
  else if (s.position === 'absolute') classes.push('absolute');
  else if (s.position === 'sticky') classes.push('sticky');
  else if (s.position === 'relative') classes.push('relative');

  if (s.position !== 'static') {
    if (s.top === '0px') classes.push('top-0');
    if (s.left === '0px') classes.push('left-0');
    if (s.right === '0px') classes.push('right-0');
    if (s.bottom === '0px') classes.push('bottom-0');
    if (s.top === '0px' && s.left === '0px' && s.right === '0px' && s.bottom === '0px') {
      // Replace individual with inset-0
      const idx = classes.indexOf('top-0');
      if (idx > -1) classes.splice(idx, 1);
      const idx2 = classes.indexOf('left-0');
      if (idx2 > -1) classes.splice(idx2, 1);
      const idx3 = classes.indexOf('right-0');
      if (idx3 > -1) classes.splice(idx3, 1);
      const idx4 = classes.indexOf('bottom-0');
      if (idx4 > -1) classes.splice(idx4, 1);
      classes.push('inset-0');
    }
    const zi = parseInt(s.zIndex);
    if (zi > 0 && zi < 100) classes.push(`z-${zi <= 50 ? zi : '[' + zi + ']'}`);
  }

  // Overflow
  if (s.overflow === 'hidden') classes.push('overflow-hidden');
  else if (s.overflow === 'auto' || s.overflow === 'scroll') classes.push('overflow-auto');
  if (s.overflowX === 'hidden' && s.overflowY !== 'hidden') classes.push('overflow-x-hidden');

  // Opacity
  const op = parseFloat(s.opacity);
  if (op < 1 && op > 0) classes.push(`opacity-[${Math.round(op * 100)}]`);

  // Object fit (for img/video)
  if (s.objectFit === 'cover') classes.push('object-cover');
  else if (s.objectFit === 'contain') classes.push('object-contain');

  return classes.join(' ');
};

// ─── Extract font-family as a readable name ──────────────────
DL.getFontVar = (el: HTMLElement): string => {
  const ff = getComputedStyle(el).fontFamily;
  if (ff.includes('DM Mono') || ff.includes('monospace')) return 'font-mono';
  if (ff.includes('DM Serif') || ff.includes('Georgia') || ff.includes('serif')) return 'font-serif';
  return '';
};

// ─── Get aspect ratio from element dimensions ───────────────
DL.getAspectRatio = (el: HTMLElement): string => {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return '';
  const ratio = rect.width / rect.height;
  if (Math.abs(ratio - 16/9) < 0.1) return 'aspect-video';
  if (Math.abs(ratio - 1) < 0.1) return 'aspect-square';
  if (Math.abs(ratio - 4/3) < 0.15) return 'aspect-[4/3]';
  if (Math.abs(ratio - 3/2) < 0.15) return 'aspect-[3/2]';
  return `aspect-[${Math.round(rect.width)}/${Math.round(rect.height)}]`;
};
