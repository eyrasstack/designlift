chrome.runtime.onMessage.addListener((msg: any, sender: any, sendResponse: Function) => {
  if (msg.action === 'startScan') {
    handleScan(msg.mode)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message || String(error) }));
    return true; // keep channel open for async
  }

  // Capture a single viewport screenshot — called by content script during scroll-capture
  if (msg.action === 'captureViewport') {
    chrome.tabs.captureVisibleTab(null as any, { format: 'png' }, (dataUrl: string) => {
      sendResponse({ dataUrl });
    });
    return true;
  }

  // Forward progress messages from content script to popup
  if (msg.action === 'scanProgress' || msg.action === 'scanError') {
    chrome.runtime.sendMessage(msg).catch(() => {});
  }
});

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
      'content/scanner.js'
    ]
  });

  const response = await chrome.tabs.sendMessage(tab.id, { action: 'runScan', mode });
  return response;
}
