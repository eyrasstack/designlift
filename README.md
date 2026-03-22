# DesignLift

Chrome Extension (Manifest V3) that extracts the full design system from any website and clones its page structure into clean, reusable code.

**Two modes:**
1. **Extract Design Tokens** — colors, typography, spacing, shadows, animations, breakpoints
2. **Clone Page Structure** — clean semantic HTML/JSX with extracted design tokens applied

Works on any site — Shopify, WordPress, custom builds, whatever. Output is clean enough to drop into a Next.js/Tailwind project immediately.

## Install

```bash
# Clone the repo
git clone https://github.com/eyrasstack/designlift.git
cd designlift

# Install TypeScript
npm install

# Generate icons + compile + copy assets
bash build.sh
```

Then load the extension:
1. Go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `dist/` folder

## How to Use

1. Navigate to any website
2. Click the DesignLift icon in your toolbar
3. Choose a mode:
   - **Extract Design Tokens** — analyzes colors, fonts, spacing, shadows, animations, breakpoints
   - **Clone Page Structure** — captures the page's DOM as clean, semantic HTML
   - **Extract Both** — runs both at once
4. Browse results in the tabbed view (Colors | Type | Space | Structure | Full)
5. Export in your preferred format

## Export Formats

| Format | File | Description |
|--------|------|-------------|
| **Tailwind Config** | `tailwind-extend.ts` | Drop-in theme extension for your `tailwind.config.ts` |
| **CSS Variables** | `globals.css` | Custom properties ready for any project |
| **JSON Tokens** | `tokens.json` | Raw token data for design tools or custom pipelines |
| **JSX Components** | `structure.jsx` | Cloned page structure as a React component |
| **Design System** | `design-system.ts` | Complete token file with colors, typography, spacing, shadows, transitions |

## What Gets Extracted

### Colors
- Text colors (primary, secondary, muted — ranked by frequency)
- Background & surface colors
- Border, shadow, and accent colors
- SVG fill/stroke colors
- Gradient colors
- Similar colors merged automatically (RGB distance < 15)

### Typography
- Font families with Google Fonts URL detection
- Font sizes mapped to semantic roles (hero, h1–h4, body, small, label)
- Weights, line heights, letter spacing
- Text transform patterns

### Spacing
- Full spacing scale mapped to Tailwind classes
- Container max-width detection
- Section padding patterns
- Grid gap and card padding

### Borders & Shadows
- All border-radius values (with pill detection)
- Border widths
- Box shadows categorized as sm/md/lg/xl/glow/inner

### Animations
- Transition properties, durations, and easing curves
- Sorted by frequency

### Breakpoints
- All `@media` min/max-width values from stylesheets

### Structure Clone
- Semantic HTML output with `dl-` prefixed classes
- Section auto-classification (hero, nav, product-grid, cta-banner, faq, footer, etc.)
- Scripts, styles, tracking, cookie banners — all stripped
- Images replaced with descriptive placeholders
- Redundant wrapper divs flattened
- Links converted to relative paths

## Tech Stack

- Chrome Extension Manifest V3
- TypeScript (compiled with `tsc`)
- Content scripts for DOM/CSS analysis
- Dark-themed popup UI
- Zero external dependencies — pure browser APIs

## Project Structure

```
designlift/
  manifest.json           # Extension manifest (MV3)
  tsconfig.json           # TypeScript config
  build.sh                # Build script
  generate-icons.js       # Creates PNG icons (no dependencies)
  global.d.ts             # Shared type declarations
  popup/
    popup.html            # Extension popup UI
    popup.css             # Dark theme styling
    popup.ts              # UI logic, triggers scans, displays results
  content/
    utils.ts              # Color parsing, helpers, element utilities
    extractor.ts          # Design token extraction engine
    cloner.ts             # Page structure cloner
    scanner.ts            # Orchestrator — coordinates extraction
  background/
    service-worker.ts     # Message routing between popup and content scripts
  output/
    formatters.ts         # Formats tokens into Tailwind, CSS, JSON, JSX
  icons/
    icon-{16,32,48,128}.png
  dist/                   # Built extension (load this in Chrome)
```

## Development

```bash
# Edit any .ts file, then rebuild
bash build.sh

# Reload the extension in chrome://extensions (click the refresh icon)
```

## Limitations

- CORS-blocked stylesheets fall back to `getComputedStyle()` — token extraction still works, breakpoint detection may miss some values
- Scans up to 500 visible elements for performance (covers most pages)
- Shadow DOM components with closed roots are skipped
- Commercial/custom fonts are detected but can't be downloaded — the Google Fonts URL is captured when available
