chrome.runtime.onMessage.addListener((msg: any, sender: any, sendResponse: Function) => {
  if (msg.action === 'startScan') {
    handleScan(msg.mode)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message || String(error) }));
    return true;
  }

  // Capture a single viewport screenshot
  if (msg.action === 'captureViewport') {
    chrome.tabs.captureVisibleTab(null as any, { format: 'png' }, (dataUrl: string) => {
      sendResponse({ dataUrl });
    });
    return true;
  }

  // Fetch external stylesheets (CORS bypass — service worker is not subject to page CORS)
  if (msg.action === 'fetchStylesheets') {
    handleFetchStylesheets(msg.urls)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({}));
    return true;
  }

  // Forward progress messages
  if (msg.action === 'scanProgress' || msg.action === 'scanError') {
    chrome.runtime.sendMessage(msg).catch(() => {});
  }
});

// ─── Fetch stylesheets with CORS bypass ──────────────────────
async function handleFetchStylesheets(urls: string[]): Promise<Record<string, string>> {
  const results: Record<string, string> = {};

  const fetches = urls.map(async (url) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (response.ok) {
        let cssText = await response.text();

        // Check for @import rules in the fetched CSS and fetch those too (1 level deep)
        const importRegex = /@import\s+url\(\s*['"]?(.+?)['"]?\s*\)/g;
        let match;
        const importUrls: string[] = [];
        while ((match = importRegex.exec(cssText)) !== null) {
          try {
            const importUrl = new URL(match[1], url).href;
            importUrls.push(importUrl);
          } catch (e) {}
        }

        // Fetch imported stylesheets
        for (const importUrl of importUrls) {
          try {
            const importResp = await fetch(importUrl, { signal: AbortSignal.timeout(5000) });
            if (importResp.ok) {
              const importCSS = await importResp.text();
              // Replace the @import with the actual CSS content
              cssText = cssText.replace(
                new RegExp(`@import\\s+url\\(['"]?${escapeRegex(match![1])}['"]?\\)\\s*;?`),
                `/* Imported from: ${importUrl} */\n${importCSS}\n`
              );
              results[importUrl] = importCSS;
            }
          } catch (e) {}
        }

        results[url] = cssText;
      }
    } catch (e) {
      results[url] = '';
    }
  });

  await Promise.allSettled(fetches);
  return results;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Scan handler ────────────────────────────────────────────
async function handleScan(mode: string) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab found');

  const url = tab.url || '';
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:')) {
    throw new Error('Cannot scan browser internal pages. Navigate to a website first.');
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: [
      'content/utils.js',
      'content/extractor.js',
      'content/styles.js',
      'content/cloner.js',
      'content/fullclone.js',
      'content/mirror.js',
      'content/scanner.js'
    ]
  });

  const response = await chrome.tabs.sendMessage(tab.id, { action: 'runScan', mode });
  return response;
}
