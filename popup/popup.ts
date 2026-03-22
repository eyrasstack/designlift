// DesignLift — Popup UI logic

var scanData: any = null;

// ─── DOM REFS ────────────────────────────────────────────────────────

const $ = (sel: string) => document.querySelector(sel) as HTMLElement;
const statusBar = $('#status-bar');
const statusLabel = $('#status-label');
const progressFill = $('#progress-fill');
const errorBar = $('#error-bar');
const errorText = $('#error-text');
const resultsEl = $('#results');

// ─── HELPERS ─────────────────────────────────────────────────────────

function showStatus(text: string, progress: number) {
  statusBar.style.display = 'block';
  errorBar.style.display = 'none';
  statusLabel.textContent = text;
  progressFill.style.width = Math.round(progress * 100) + '%';
}

function showError(msg: string) {
  errorBar.style.display = 'block';
  errorText.textContent = msg;
  statusBar.style.display = 'none';
}

function hideStatus() {
  // Keep the completed state visible briefly
  setTimeout(() => {
    statusBar.style.display = 'none';
  }, 1000);
}

function copyText(text: string, feedbackEl?: HTMLElement) {
  navigator.clipboard.writeText(text).then(() => {
    if (feedbackEl) {
      const orig = feedbackEl.textContent;
      feedbackEl.textContent = 'Copied!';
      feedbackEl.classList.add('dl-copied');
      setTimeout(() => {
        feedbackEl.textContent = orig;
        feedbackEl.classList.remove('dl-copied');
      }, 2000);
    }
  });
}

function downloadFile(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── SCAN ────────────────────────────────────────────────────────────

function startScan(mode: string) {
  // Disable buttons
  document.querySelectorAll('.dl-actions .dl-btn').forEach(b => {
    (b as HTMLButtonElement).disabled = true;
    (b as HTMLElement).style.opacity = '0.5';
  });

  resultsEl.style.display = 'none';
  showStatus('Starting scan...', 0);

  chrome.runtime.sendMessage({ action: 'startScan', mode }, (response: any) => {
    // Re-enable buttons
    document.querySelectorAll('.dl-actions .dl-btn').forEach(b => {
      (b as HTMLButtonElement).disabled = false;
      (b as HTMLElement).style.opacity = '1';
    });

    if (chrome.runtime.lastError) {
      showError(chrome.runtime.lastError.message || 'Extension error');
      return;
    }

    if (!response || !response.success) {
      showError(response?.error || 'Scan failed. Make sure you\'re on a regular website.');
      return;
    }

    scanData = response.data;
    showStatus('Complete!', 1);
    hideStatus();
    renderResults();
  });
}

// ─── PROGRESS LISTENER ──────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg: any) => {
  if (msg.action === 'scanProgress') {
    showStatus(msg.status, msg.progress);
  }
});

// ─── RENDER RESULTS ──────────────────────────────────────────────────

function renderResults() {
  if (!scanData) return;
  resultsEl.style.display = 'block';

  renderColors();
  renderTypography();
  renderSpacing();
  renderStructure();
  renderFull();
}

// ── Colors Tab ──

function renderColors() {
  const container = $('#tab-colors');
  const colors = scanData.colors || [];

  if (!colors.length) {
    container.innerHTML = '<p class="dl-empty">No colors extracted</p>';
    return;
  }

  // Group by category
  const groups: Record<string, any[]> = {};
  colors.forEach((c: any) => {
    if (!groups[c.category]) groups[c.category] = [];
    groups[c.category].push(c);
  });

  const categoryOrder = ['background', 'surface', 'text-primary', 'text-secondary', 'text-muted', 'accent', 'border', 'shadow'];
  let html = '';

  for (const cat of categoryOrder) {
    if (!groups[cat]) continue;
    html += `<div class="dl-color-group">`;
    html += `<div class="dl-color-group-label">${cat}</div>`;
    for (const c of groups[cat]) {
      html += `
        <div class="dl-color-row" data-hex="${c.hex}" title="Click to copy">
          <div class="dl-swatch" style="background:${c.hex}"></div>
          <div class="dl-color-info">
            <div class="dl-color-hex">${c.hex}</div>
            <div class="dl-color-meta">${c.frequency} uses &middot; ${c.sampleElements?.[0] || ''}</div>
          </div>
          <span class="dl-copy-hint">Copy</span>
        </div>`;
    }
    html += `</div>`;
  }

  container.innerHTML = html;

  // Click to copy
  container.querySelectorAll('.dl-color-row').forEach(row => {
    row.addEventListener('click', () => {
      const hex = row.getAttribute('data-hex') || '';
      copyText(hex, row.querySelector('.dl-copy-hint') as HTMLElement);
    });
  });
}

// ── Typography Tab ──

function renderTypography() {
  const container = $('#tab-type');
  const tokens = scanData.typography || [];
  const fontStack = scanData.fontStack;

  let html = '';

  // Font stack info
  if (fontStack?.families?.length) {
    html += `<div class="dl-font-stack">`;
    html += `<div class="dl-font-stack-label">Font Stack</div>`;
    html += `<div class="dl-font-stack-value">${fontStack.families.slice(0, 3).join(', ')}</div>`;
    if (fontStack.googleFontsUrl) {
      html += `<div class="dl-font-stack-label" style="margin-top:8px">Google Fonts</div>`;
      html += `<div class="dl-font-stack-value" style="font-size:10px;word-break:break-all">${fontStack.googleFontsUrl}</div>`;
    }
    html += `</div>`;
  }

  if (!tokens.length) {
    html += '<p class="dl-empty">No typography tokens extracted</p>';
    container.innerHTML = html;
    return;
  }

  for (const t of tokens) {
    html += `
      <div class="dl-type-item">
        <div class="dl-type-role">${t.role}</div>
        <div class="dl-type-sample" style="font-size:${Math.min(t.fontSizePx, 28)}px;font-weight:${t.fontWeight};line-height:${t.lineHeight}">${t.sampleText || 'Sample text'}</div>
        <div class="dl-type-meta">${t.fontSize} / ${t.fontWeight} / ${t.lineHeight} lh${t.textTransform !== 'none' ? ' / ' + t.textTransform : ''}</div>
      </div>`;
  }

  container.innerHTML = html;
}

// ── Spacing Tab ──

function renderSpacing() {
  const container = $('#tab-spacing');
  const tokens = (scanData.spacing || []).slice(0, 12);
  const layout = scanData.layout || {};

  let html = '';

  // Layout tokens
  html += '<div class="dl-layout-grid">';
  const layoutItems = [
    ['Container', layout.containerMaxWidth],
    ['Section Y', layout.sectionPaddingY],
    ['Grid Gap', layout.gridGap],
    ['Card Pad', layout.cardPadding]
  ];
  for (const [label, value] of layoutItems) {
    if (!value || value === '0px') continue;
    html += `
      <div class="dl-layout-item">
        <div class="dl-layout-label">${label}</div>
        <div class="dl-layout-value">${value}</div>
      </div>`;
  }
  html += '</div>';

  // Spacing scale
  if (tokens.length) {
    html += '<div style="margin-top:14px">';
    html += '<div class="dl-color-group-label">Spacing Scale</div>';
    const maxVal = Math.max(...tokens.map((t: any) => parseInt(t.value)));
    for (const t of tokens) {
      const barW = Math.max(2, (parseInt(t.value) / maxVal) * 150);
      html += `
        <div class="dl-spacing-item">
          <div class="dl-spacing-value">${t.value}</div>
          <div class="dl-spacing-bar" style="width:${barW}px"></div>
          <div class="dl-spacing-tw">tw-${t.tailwindClass}</div>
        </div>`;
    }
    html += '</div>';
  }

  // Borders
  const borders = scanData.borders;
  if (borders?.radius?.length) {
    html += '<div style="margin-top:14px">';
    html += '<div class="dl-color-group-label">Border Radii</div>';
    html += '<div class="dl-type-meta">' + borders.radius.slice(0, 6).join(' &middot; ') + '</div>';
    html += '</div>';
  }

  container.innerHTML = html || '<p class="dl-empty">No spacing data</p>';
}

// ── Structure Tab ──

function renderStructure() {
  const container = $('#tab-structure');
  const structure = scanData.structure;

  if (!structure) {
    container.innerHTML = '<p class="dl-empty">No structure data. Use "Clone Page Structure" or "Extract Both".</p>';
    return;
  }

  let html = '<div class="dl-section-list">';
  for (const s of structure.sections || []) {
    html += `<span class="dl-section-tag">${s.type}</span>`;
  }
  html += '</div>';
  html += `<div class="dl-code">${escapeHtml(structure.html)}</div>`;

  container.innerHTML = html;
}

// ── Full Tab ──

function renderFull() {
  const container = $('#tab-full');
  if (!scanData) {
    container.innerHTML = '<p class="dl-empty">No data</p>';
    return;
  }

  const designSystem = DLFormat.toDesignSystem(scanData);
  container.innerHTML = `<div class="dl-code">${escapeHtml(designSystem)}</div>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── TAB SWITCHING ───────────────────────────────────────────────────

document.querySelectorAll('.dl-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.dl-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.dl-tab-content').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.getAttribute('data-tab');
    const content = document.getElementById('tab-' + target);
    if (content) content.classList.add('active');
  });
});

// ─── BUTTON HANDLERS ─────────────────────────────────────────────────

$('#btn-tokens').addEventListener('click', () => startScan('tokens'));
$('#btn-structure').addEventListener('click', () => startScan('structure'));
$('#btn-both').addEventListener('click', () => startScan('both'));

// Export buttons
$('#exp-tailwind').addEventListener('click', () => {
  if (!scanData) return;
  downloadFile('tailwind-extend.ts', DLFormat.toTailwindConfig(scanData));
});

$('#exp-css').addEventListener('click', () => {
  if (!scanData) return;
  downloadFile('globals.css', DLFormat.toCssVars(scanData), 'text/css');
});

$('#exp-json').addEventListener('click', () => {
  if (!scanData) return;
  downloadFile('tokens.json', DLFormat.toJson(scanData), 'application/json');
});

$('#exp-jsx').addEventListener('click', () => {
  if (!scanData) return;
  const structure = scanData.structure;
  if (!structure) {
    alert('No structure data. Run "Clone Page Structure" or "Extract Both" first.');
    return;
  }
  downloadFile('structure.jsx', DLFormat.structureToJsx(structure));
});

// Copy All — copies the design-system.ts content
$('#btn-copy-all').addEventListener('click', () => {
  if (!scanData) return;
  const content = DLFormat.toDesignSystem(scanData);
  copyText(content, $('#btn-copy-all'));
});

// Download — downloads the main design-system.ts file
$('#btn-download').addEventListener('click', () => {
  if (!scanData) return;
  downloadFile('design-system.ts', DLFormat.toDesignSystem(scanData));
});
