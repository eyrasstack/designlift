// DesignLift — Scanner orchestrator
// Injected last. Coordinates extraction and sends results back.

var DL: any = (window as any).__DL;

DL.runScan = async (mode: string): Promise<any> => {
  const sendProgress = (progress: number, status: string) => {
    try { chrome.runtime.sendMessage({ action: 'scanProgress', progress, status }); } catch (e) {}
  };

  const result: any = {
    sourceUrl: window.location.href,
    timestamp: new Date().toISOString()
  };

  if (mode === 'tokens' || mode === 'both') {
    sendProgress(0.1, 'Gathering visible elements...');
    const elements = DL.getVisibleElements(500);

    sendProgress(0.15, `Analyzing ${elements.length} elements...`);

    sendProgress(0.2, 'Extracting colors...');
    result.colors = DL.extractColors(elements);

    sendProgress(0.35, 'Extracting typography...');
    const typo = DL.extractTypography(elements);
    result.typography = typo.tokens;
    result.fontStack = typo.fontStack;

    sendProgress(0.5, 'Extracting spacing...');
    const spacing = DL.extractSpacing(elements);
    result.spacing = spacing.tokens;
    result.layout = spacing.layout;

    sendProgress(0.6, 'Extracting borders...');
    result.borders = DL.extractBorders(elements);

    sendProgress(0.7, 'Extracting shadows...');
    result.shadows = DL.extractShadows(elements);

    sendProgress(0.8, 'Extracting animations...');
    result.animations = DL.extractAnimations(elements);

    sendProgress(0.85, 'Extracting breakpoints...');
    result.breakpoints = DL.extractBreakpoints();
  }

  if (mode === 'clone-styled') {
    sendProgress(0.9, 'Building 1:1 styled clone...');
    result.styledClone = DL.cloneStyled();
  }

  if (mode === 'clone-full') {
    // Full 1:1 clone with inline styles
    const cloneResult = DL.fullClone();

    // Download the JSX file
    sendProgress(0.92, 'Downloading clone-full.tsx...');
    const blob = new Blob([cloneResult.jsx], { type: 'text/plain' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = 'clone-full.tsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);

    // Capture full-page screenshot by scrolling + stitching
    sendProgress(0.93, 'Capturing full-page screenshot...');
    try {
      await DL.captureFullPageScreenshot();
    } catch (e: any) {
      console.warn('Screenshot capture failed:', e.message);
    }

    result.fullClone = {
      sourceUrl: cloneResult.sourceUrl,
      timestamp: cloneResult.timestamp,
      viewport: cloneResult.viewport,
      downloaded: true,
    };
  }

  if (mode === 'mirror') {
    // TRUE 1:1 MIRROR — captures full DOM + all CSS stylesheets
    sendProgress(0.05, 'Collecting stylesheet URLs...');
    const stylesheetUrls = DL._collectStylesheetUrls();

    sendProgress(0.1, `Fetching ${stylesheetUrls.length} external stylesheets...`);
    let externalCSS: Record<string, string> = {};
    if (stylesheetUrls.length > 0) {
      const fetchResponse: any = await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'fetchStylesheets', urls: stylesheetUrls }, resolve);
      });
      externalCSS = fetchResponse || {};
    }

    sendProgress(0.5, 'Building page mirror...');
    const html = DL.mirrorPage(externalCSS);

    sendProgress(0.85, 'Downloading mirror HTML...');
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    const hostname = window.location.hostname.replace(/\./g, '-');
    a.download = `${hostname}-mirror.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);

    // Capture full-page screenshot
    sendProgress(0.9, 'Capturing full-page screenshot...');
    try {
      await DL.captureFullPageScreenshot();
    } catch (e: any) {
      console.warn('Screenshot failed:', e.message);
    }

    result.mirror = {
      sourceUrl: window.location.href,
      timestamp: new Date().toISOString(),
      stylesheetCount: stylesheetUrls.length,
      htmlSize: html.length,
      downloaded: true,
    };
  }

  if (mode === 'structure' || mode === 'both') {
    sendProgress(0.9, 'Cloning page structure...');
    result.structure = DL.cloneStructure();

    // Collect all image URLs found on the page
    sendProgress(0.95, 'Collecting image assets...');
    const images: { src: string; alt: string; width: number; height: number }[] = [];
    document.querySelectorAll('img').forEach((img: HTMLImageElement) => {
      const src = img.currentSrc || img.src || img.getAttribute('data-src') || '';
      if (!src || src.startsWith('data:')) return;
      images.push({
        src,
        alt: img.alt || '',
        width: img.naturalWidth || img.width || 0,
        height: img.naturalHeight || img.height || 0
      });
    });
    result.images = images;
  }

  sendProgress(1.0, 'Complete!');
  return result;
};

// ─── Full-page screenshot capture ────────────────────────────
// Scrolls the page, captures each viewport via background script,
// stitches into one tall image, and downloads as PNG.
DL.captureFullPageScreenshot = async (): Promise<void> => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const fullHeight = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight
  );
  const steps = Math.ceil(fullHeight / vh);
  const maxSteps = Math.min(steps, 15); // cap at 15 screens

  // Save current scroll position
  const origScroll = window.scrollY;

  // Capture each viewport
  const captures: string[] = [];
  for (let i = 0; i < maxSteps; i++) {
    const scrollY = i * vh;
    window.scrollTo(0, scrollY);
    // Wait for repaint
    await new Promise(r => setTimeout(r, 300));

    // Request screenshot from background service worker
    const response: any = await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'captureViewport' }, resolve);
    });

    if (response?.dataUrl) {
      captures.push(response.dataUrl);
    }
  }

  // Restore scroll
  window.scrollTo(0, origScroll);

  if (captures.length === 0) return;

  // Stitch screenshots on a canvas
  const canvas = document.createElement('canvas');
  canvas.width = vw * window.devicePixelRatio;
  // Last section might be partial
  const lastSectionHeight = fullHeight - (maxSteps - 1) * vh;
  const totalHeight = ((maxSteps - 1) * vh + Math.min(lastSectionHeight, vh));
  canvas.height = totalHeight * window.devicePixelRatio;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Load and draw each capture
  for (let i = 0; i < captures.length; i++) {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => resolve(); // skip failed images
      img.src = captures[i];
    });
    const y = i * vh * window.devicePixelRatio;
    ctx.drawImage(img, 0, y);
  }

  // Convert canvas to blob and download
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'page-screenshot.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 'image/png');
};

// Set up message listener (guard against duplicate listeners on re-injection)
if (!(window as any).__dl_listener_active) {
  (window as any).__dl_listener_active = true;

  chrome.runtime.onMessage.addListener((msg: any, _sender: any, sendResponse: Function) => {
    if (msg.action === 'runScan') {
      DL.runScan(msg.mode)
        .then((data: any) => sendResponse({ success: true, data }))
        .catch((err: any) => sendResponse({ success: false, error: err.message || String(err) }));
      return true; // async response
    }
  });
}
