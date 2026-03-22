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
    // Output is too large for message passing — trigger download directly from content script
    const cloneResult = DL.fullClone();
    // Create a blob and download directly in the page context
    const blob = new Blob([cloneResult.jsx], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clone-full.tsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    // Return metadata only (not the huge JSX string)
    result.fullClone = {
      sourceUrl: cloneResult.sourceUrl,
      timestamp: cloneResult.timestamp,
      viewport: cloneResult.viewport,
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
