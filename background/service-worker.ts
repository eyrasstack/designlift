chrome.runtime.onMessage.addListener((msg: any, sender: any, sendResponse: Function) => {
  if (msg.action === 'startScan') {
    handleScan(msg.mode)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message || String(error) }));
    return true; // keep channel open for async
  }

  // Forward progress messages from content script to popup
  if (msg.action === 'scanProgress' || msg.action === 'scanError') {
    // These are sent from content script — relay to all extension pages
    chrome.runtime.sendMessage(msg).catch(() => {});
  }
});

async function handleScan(mode: string) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab found');

  // Check for restricted pages
  const url = tab.url || '';
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:')) {
    throw new Error('Cannot scan browser internal pages. Navigate to a website first.');
  }

  // Inject content scripts in order — they share the isolated world scope
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: [
      'content/utils.js',
      'content/extractor.js',
      'content/cloner.js',
      'content/scanner.js'
    ]
  });

  // Send scan command and await the content script's response
  const response = await chrome.tabs.sendMessage(tab.id, { action: 'runScan', mode });
  return response;
}
