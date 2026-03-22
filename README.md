# DesignLift

Chrome Extension (Manifest V3) that extracts design systems and creates true 1:1 mirrors of any website.

**Two modes:**
1. **Extract Design Tokens** — colors, typography, spacing, shadows, animations, breakpoints from any site
2. **Mirror Site (1:1 Clone)** — captures the full rendered page as a self-contained HTML file with all CSS, fonts, images, and interaction scripts preserved

## Install

```bash
git clone https://github.com/eyrasstack/designlift.git
cd designlift
npm install
bash build.sh
```

Then load the extension:
1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `dist/` folder

## How to Use

### Extract Design Tokens
1. Navigate to any website
2. Click the DesignLift icon
3. Click **Extract Design Tokens**
4. Browse results in tabs (Colors | Type | Space | Structure | Full)
5. Export as Tailwind Config, CSS Variables, JSON Tokens, or JSX

### Mirror Site (1:1 Clone)
1. Navigate to the page you want to clone
2. Click the DesignLift icon
3. Click the purple **Mirror Site (1:1 Clone)** button
4. Wait while it fetches stylesheets and scripts
5. Downloads two files:
   - **`{hostname}-mirror.html`** — the complete page clone
   - **`page-screenshot.png`** — full-page reference screenshot
6. Open the HTML file in your browser — it renders identically to the original

## What the Mirror Captures

- **Full rendered DOM** — captured after JavaScript execution (dynamic content included)
- **All CSS stylesheets** — external sheets fetched and inlined (CORS bypassed via service worker)
- **CSS animations & hover states** — actual stylesheet rules preserved, not computed
- **Media queries** — responsive styles included
- **@font-face rules** — with real font file CDN URLs
- **Interaction scripts** — Webflow runtime, jQuery, GSAP, Lottie, Swiper kept
- **Images & videos** — URLs preserved (loaded from original CDN)
- **SVGs** — inline SVGs preserved as-is
- **Form elements** — inputs, selects, textareas with placeholders and options

### What gets stripped
- Google Analytics, GTM, Facebook Pixel
- Cookie consent banners (CookieYes, OneTrust, Finsweet)
- Chat widgets (Intercom, Drift, Crisp, Zendesk)
- reCAPTCHA, Hotjar, Segment, Mixpanel, Sentry
- Tracking pixels and hidden iframes
- Event handler attributes (`onclick`, etc.)

## Token Export Formats

| Format | File | Description |
|--------|------|-------------|
| Tailwind Config | `tailwind-extend.ts` | Theme extension for `tailwind.config.ts` |
| CSS Variables | `globals.css` | Custom properties for any project |
| JSON Tokens | `tokens.json` | Raw token data |
| JSX Components | `structure.jsx` | Page structure as a React component |
| Design System | `design-system.ts` | Complete token file |

## Tech Stack

- Chrome Extension Manifest V3
- TypeScript
- Content scripts for DOM/CSS analysis
- Service worker for CORS-free resource fetching
- Dark-themed popup UI
- Zero external runtime dependencies

## Project Structure

```
designlift/
  manifest.json
  tsconfig.json
  build.sh
  generate-icons.js
  global.d.ts
  popup/
    popup.html
    popup.css
    popup.ts
  content/
    utils.ts          — color parsing, helpers
    extractor.ts       — design token extraction
    cloner.ts          — page structure cloner (JSX output)
    mirror.ts          — TRUE 1:1 mirror engine (HTML output)
    scanner.ts         — orchestrator + screenshot capture
  background/
    service-worker.ts  — message routing, CSS/JS fetching, screenshots
  output/
    formatters.ts      — token → Tailwind/CSS/JSON formatters
  icons/
    icon-{16,32,48,128}.png
  dist/                — built extension (load this in Chrome)
```

## Development

```bash
# Edit .ts files, then rebuild
bash build.sh

# Reload in chrome://extensions
```

## Version History

- **v3.1** — Mirror mode with interaction JS (Webflow, jQuery, GSAP preserved)
- **v3.0** — Mirror mode: full DOM + all CSS as self-contained HTML
- **v2.0** — Full clone with inline styles (deprecated)
- **v1.3** — Improved style extraction accuracy
- **v1.2** — Styled clone with Tailwind classes (deprecated)
- **v1.1** — Version badge, extraction fixes
- **v1.0** — Initial release: design token extraction
