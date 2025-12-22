/**
 * Content Script - Detects paste/file uploads containing PII
 * Uses dynamic import to load PIIDetector (bundled by Vite)
 */

// Import PIIDetector (will be bundled by Vite)
import { PIIDetector } from './utils/pii-detector.js';

// Initialize detector
const detector = new PIIDetector();

// Generate unique scan ID
function generateScanId() {
  return `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Handle paste events
function handlePaste(event) {
  const pastedText = (event.clipboardData || window.clipboardData).getData('text');
  
  if (!pastedText || pastedText.trim().length === 0) {
    return;
  }

  // Small delay to allow paste to complete
  setTimeout(() => {
    scanAndAlert(pastedText, 'paste');
  }, 100);
}

// Handle file uploads
function handleFileUpload(event) {
  const file = event.target.files?.[0];
  
  if (!file) {
    return;
  }

  // Only process text files
  if (!file.type.startsWith('text/') && !file.name.match(/\.(txt|md|csv|log)$/i)) {
    return;
  }

  const reader = new FileReader();
  
  reader.onload = (e) => {
    const fileContent = e.target?.result;
    if (fileContent && typeof fileContent === 'string') {
      scanAndAlert(fileContent, 'file', file.name);
    }
  };
  
  reader.onerror = () => {
    console.error('AI Guardrail: Failed to read file');
  };
  
  reader.readAsText(file);
}

// Detect input changes (paste or typing)
function handleInputChange(event) {
  const input = event.target;
  const newValue = input.value || input.textContent || '';
  
  // Check if this is a large sudden change (likely paste)
  if (newValue.length > 50 && input.dataset.lastLength) {
    const lastLength = parseInt(input.dataset.lastLength, 10);
    const changeSize = newValue.length - lastLength;
    
    // If change is > 20 chars, likely a paste
    if (changeSize > 20) {
      const newText = newValue.substring(lastLength);
      scanAndAlert(newText, 'paste');
    } else {
      // Small change - likely typing, scan the entire current text
      // Use debounce to avoid scanning on every keystroke
      clearTimeout(input.dataset.scanTimeout);
      input.dataset.scanTimeout = setTimeout(() => {
        scanAndAlert(newValue, 'typing');
      }, 500); // Wait 500ms after user stops typing
    }
  } else {
    // First input or small text - scan everything
    clearTimeout(input.dataset.scanTimeout);
    input.dataset.scanTimeout = setTimeout(() => {
      if (newValue.length > 10) { // Only scan if meaningful length
        scanAndAlert(newValue, 'typing');
      }
    }, 500);
  }
  
  input.dataset.lastLength = newValue.length.toString();
}

// Scan text and show alert if PII detected
function scanAndAlert(content, source, filename = null) {
  console.log('🛡️ AI Guardrail: scanAndAlert called', { content: content.substring(0, 50), source, filename });
  
  if (!content || typeof content !== 'string') {
    return;
  }

  const risks = detector.scan(content);
  console.log('🛡️ AI Guardrail: Detected risks', risks.length, risks);
  
  if (risks.length === 0) {
    return; // No PII detected
  }

  const scanId = generateScanId();
  
  // Show inline underlines (Grammarly-style) AND floating pill
  showInlineSuggestions(scanId, risks, content, source, filename);
  showPill(scanId, risks, content, source, filename);
  
  // Log to storage (async, don't block)
  // Silently handle errors - extension context might be invalidated
  logRisk(scanId, risks, source, filename).catch(() => {
    // Error already logged in logRisk function
  });
}

// Show Grammarly-style inline suggestions with red underlines
function showInlineSuggestions(scanId, risks, content, source, filename) {
  // Get the input field
  const textarea = document.querySelector('textarea[data-id], textarea#prompt-textarea');
  const contentEditable = document.querySelector('[contenteditable="true"]');
  const inputElement = textarea || contentEditable;
  
  if (!inputElement) {
    console.log('🛡️ AI Guardrail: No input element found for inline suggestions');
    return;
  }

  const fullText = inputElement.value || inputElement.textContent || '';
  const fullRisks = detector.scan(fullText);
  
  if (fullRisks.length === 0) {
    return;
  }

  // Remove existing underlines
  removeInlineSuggestions();

  // Create overlay container for underlines and tooltips
  const overlayId = 'ai-guardrail-overlay';
  let overlay = document.getElementById(overlayId);
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = overlayId;
    overlay.style.cssText = `
      position: absolute;
      pointer-events: none;
      z-index: 1000000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    // Add CSS animations for underlines
    const style = document.createElement('style');
    style.textContent = `
      @keyframes ai-guardrail-pulse {
        0%, 100% {
          opacity: 1;
          transform: scaleY(1);
        }
        50% {
          opacity: 0.7;
          transform: scaleY(1.1);
        }
      }
      @keyframes ai-guardrail-tooltip-fade {
        from {
          opacity: 0;
          transform: translateY(-100%) translateY(-4px);
        }
        to {
          opacity: 1;
          transform: translateY(-100%) translateY(0);
        }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(overlay);
  }

  // Get input element position
  const rect = inputElement.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

  // Position overlay to match input field
  overlay.style.top = (rect.top + scrollTop) + 'px';
  overlay.style.left = (rect.left + scrollLeft) + 'px';
  overlay.style.width = rect.width + 'px';
  overlay.style.height = rect.height + 'px';

  // Create underline elements for each risk
  fullRisks.forEach((risk, index) => {
    // Calculate position of risk in text
    const textBefore = fullText.substring(0, risk.start);
    const textRisk = fullText.substring(risk.start, risk.end);
    
    // Create a temporary element to measure text width
    const measureEl = document.createElement('span');
    measureEl.style.visibility = 'hidden';
    measureEl.style.position = 'absolute';
    measureEl.style.whiteSpace = 'pre-wrap';
    measureEl.style.font = window.getComputedStyle(inputElement).font;
    measureEl.style.padding = window.getComputedStyle(inputElement).padding;
    measureEl.textContent = textBefore;
    document.body.appendChild(measureEl);
    
    const beforeWidth = measureEl.offsetWidth;
    measureEl.textContent = textRisk;
    const riskWidth = measureEl.offsetWidth;
    measureEl.textContent = textBefore + textRisk;
    const beforeHeight = measureEl.offsetHeight;
    measureEl.textContent = textBefore.substring(0, Math.max(0, textBefore.lastIndexOf('\n')));
    const linesBefore = measureEl.textContent.split('\n').length - 1;
    
    document.body.removeChild(measureEl);

    // Create underline element (positioned BELOW text, not above)
    const underline = document.createElement('div');
    underline.className = 'ai-guardrail-underline';
    underline.dataset.riskIndex = index;
    underline.dataset.scanId = scanId;
    
    // Calculate line height for proper positioning
    const lineHeight = parseFloat(window.getComputedStyle(inputElement).lineHeight) || 20;
    const paddingTop = parseFloat(window.getComputedStyle(inputElement).paddingTop) || 0;
    const textTop = paddingTop + (linesBefore * lineHeight);
    
    underline.style.cssText = `
      position: absolute;
      left: ${beforeWidth}px;
      top: ${textTop + lineHeight - 2}px;
      width: ${riskWidth}px;
      height: 3px;
      background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%);
      border-bottom: 3px solid #f59e0b;
      border-bottom-style: wavy;
      pointer-events: auto;
      cursor: pointer;
      z-index: 1000001;
      animation: ai-guardrail-pulse 2s ease-in-out infinite;
      box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);
    `;

    // Create tooltip (positioned above underline)
    const tooltip = document.createElement('div');
    tooltip.className = 'ai-guardrail-tooltip';
    tooltip.dataset.riskIndex = index;
    const tooltipTop = textTop + lineHeight - 2 - 8; // Position above underline
    tooltip.style.cssText = `
      position: absolute;
      left: ${beforeWidth}px;
      top: ${tooltipTop}px;
      transform: translateY(-100%);
      margin-bottom: 8px;
      background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
      color: white;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 12px;
      white-space: nowrap;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      pointer-events: auto;
      z-index: 1000002;
      display: none;
      min-width: 220px;
      border: 1px solid #374151;
      animation: ai-guardrail-tooltip-fade 0.2s ease-out;
    `;
    
    const placeholder = detector.getPlaceholder(risk.type, index + 1);
    tooltip.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 4px;">PII Detected: ${risk.type}</div>
      <div style="opacity: 0.9; margin-bottom: 8px;">${risk.text} → ${placeholder}</div>
      <div style="display: flex; gap: 6px;">
        <button class="ai-guardrail-accept-inline" style="
          flex: 1;
          background: #10b981;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
          font-weight: 600;
        ">Accept</button>
        <button class="ai-guardrail-dismiss-inline" style="
          flex: 1;
          background: #6b7280;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
          font-weight: 600;
        ">Dismiss</button>
      </div>
    `;

    // Show tooltip on hover
    underline.addEventListener('mouseenter', () => {
      tooltip.style.display = 'block';
    });
    
    underline.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });

    // Accept button in tooltip
    const acceptBtn = tooltip.querySelector('.ai-guardrail-accept-inline');
    acceptBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      acceptInlineSuggestion(scanId, risk, fullText, fullRisks, inputElement);
    });

    // Dismiss button in tooltip
    const dismissBtn = tooltip.querySelector('.ai-guardrail-dismiss-inline');
    dismissBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeInlineSuggestions();
    });

    overlay.appendChild(underline);
    overlay.appendChild(tooltip);
  });
}

// Accept a single inline suggestion
function acceptInlineSuggestion(scanId, risk, fullText, allRisks, inputElement) {
  // Redact only this specific risk
  const redacted = detector.redact(fullText, [risk]);
  
  // Update input field
  if (inputElement.tagName === 'TEXTAREA') {
    inputElement.value = redacted;
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (inputElement.isContentEditable) {
    inputElement.textContent = redacted;
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    inputElement.innerHTML = redacted.replace(/\n/g, '<br>');
  }
  
  // Remove this underline
  const underline = document.querySelector(`.ai-guardrail-underline[data-risk-index="${allRisks.indexOf(risk)}"]`);
  if (underline) {
    underline.style.display = 'none';
  }
  
  // Re-scan and update remaining underlines
  setTimeout(() => {
    const newText = inputElement.value || inputElement.textContent || '';
    const newRisks = detector.scan(newText);
    if (newRisks.length > 0) {
      showInlineSuggestions(scanId, newRisks, newText, 'paste', null);
    } else {
      removeInlineSuggestions();
    }
  }, 100);
  
  updateLog(scanId, 'fix').catch(() => {
    // Error already handled in updateLog function
  });
}

// Remove all inline suggestions
function removeInlineSuggestions() {
  const overlay = document.getElementById('ai-guardrail-overlay');
  if (overlay) {
    overlay.remove();
  }
  
  // Also remove any remaining underlines
  document.querySelectorAll('.ai-guardrail-underline, .ai-guardrail-tooltip').forEach(el => el.remove());
}

// Show floating pill notification with preview (Grammarly-style)
function showPill(scanId, risks, content, source, filename) {
  // Remove existing pill if any
  const existingPill = document.getElementById('ai-guardrail-pill');
  if (existingPill) {
    existingPill.remove();
  }

  // Get the full input text (not just the new content) for proper redaction
  const textarea = document.querySelector('textarea[data-id], textarea#prompt-textarea');
  const contentEditable = document.querySelector('[contenteditable="true"]');
  const inputElement = textarea || contentEditable;
  const fullText = inputElement ? (inputElement.value || inputElement.textContent || '') : content;

  // Re-scan the full text to get correct positions for all risks
  const fullRisks = detector.scan(fullText);
  console.log('🛡️ AI Guardrail: Full text risks', fullRisks.length, 'Full text length:', fullText.length);

  // Generate redacted text for preview
  const redacted = detector.redact(fullText, fullRisks);

  // Create preview text with highlights showing changes
  const createPreviewText = (text, risks) => {
    // Sort risks by position (reverse order for safe replacement)
    const sortedRisks = [...risks].sort((a, b) => b.start - a.start);
    let preview = text;
    const counters = {
      postcode: 0,
      nhs_number: 0,
      email: 0,
      name: 0
    };
    
    for (const risk of sortedRisks) {
      counters[risk.type]++;
      const placeholder = detector.getPlaceholder(risk.type, counters[risk.type]);
      const highlighted = `<mark style="background: #fef3c7; color: #92400e; padding: 2px 4px; border-radius: 3px; font-weight: 600;">${risk.text}</mark>`;
      const replacement = `<span style="background: #d1fae5; color: #065f46; padding: 2px 4px; border-radius: 3px; font-weight: 600;">${placeholder}</span>`;
      
      // Show original highlighted, then replacement
      preview = preview.substring(0, risk.start) + 
                highlighted + ' → ' + replacement + 
                preview.substring(risk.end);
    }
    
    return preview;
  };

  const previewHTML = createPreviewText(fullText, fullRisks);

  // Create pill element with preview
  const pill = document.createElement('div');
  pill.id = 'ai-guardrail-pill';
  pill.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
      color: white;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      z-index: 1000000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      max-width: 500px;
      animation: slideIn 0.3s ease-out;
    ">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
        <span style="font-size: 20px;">⚠️</span>
        <strong style="font-size: 16px;">${fullRisks.length} risk${fullRisks.length > 1 ? 's' : ''} detected</strong>
      </div>
      
      <div style="font-size: 12px; opacity: 0.9; margin-bottom: 12px;">
        ${filename ? `In "${filename.length > 30 ? filename.substring(0, 30) + '...' : filename}"` : `From ${source}`}
      </div>
      
      <div style="font-size: 11px; opacity: 0.8; margin-bottom: 12px;">
        Types: ${[...new Set(fullRisks.map(r => r.type))].join(', ')}
      </div>

      <!-- Preview Section -->
      <div id="ai-guardrail-preview" style="
        background: white;
        color: #111827;
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 12px;
        max-height: 200px;
        overflow-y: auto;
        font-size: 12px;
        line-height: 1.6;
      ">
        <div style="font-weight: 600; margin-bottom: 8px; color: #374151;">Preview Changes:</div>
        <div style="color: #6b7280; word-wrap: break-word;">${previewHTML}</div>
      </div>

      <!-- Action Buttons -->
      <div id="ai-guardrail-actions" style="display: flex; gap: 8px;">
        <button id="ai-guardrail-accept" style="
          flex: 1;
          background: #10b981;
          color: white;
          border: none;
          padding: 10px 16px;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
        ">✓ Accept</button>
        <button id="ai-guardrail-reject" style="
          flex: 1;
          background: rgba(255,255,255,0.2);
          color: white;
          border: none;
          padding: 10px 16px;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
        ">✗ Reject</button>
      </div>
    </div>
    <style>
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      #ai-guardrail-accept:hover {
        background: #059669 !important;
        transform: scale(1.02);
      }
      #ai-guardrail-reject:hover {
        background: rgba(255,255,255,0.3) !important;
      }
    </style>
  `;

  document.body.appendChild(pill);

  // Store data
  pill.dataset.scanId = scanId;
  pill.dataset.risks = JSON.stringify(fullRisks);
  pill.dataset.content = fullText;
  pill.dataset.redacted = redacted;

  // Accept button handler
  const acceptBtn = pill.querySelector('#ai-guardrail-accept');
  acceptBtn.addEventListener('click', () => {
    const fullText = pill.dataset.content;
    const redacted = pill.dataset.redacted;
    
    // Find the input field again (in case DOM changed)
    const textarea = document.querySelector('textarea[data-id], textarea#prompt-textarea');
    const contentEditable = document.querySelector('[contenteditable="true"]');
    const inputElement = textarea || contentEditable;
    
    if (inputElement) {
      // Replace text in input field
      if (textarea) {
        textarea.value = redacted;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (contentEditable) {
        contentEditable.textContent = redacted;
        contentEditable.dispatchEvent(new Event('input', { bubbles: true }));
        contentEditable.innerHTML = redacted.replace(/\n/g, '<br>');
      }
      console.log('🛡️ AI Guardrail: Text replaced in input field');
    }
    
    // Copy to clipboard
    navigator.clipboard.writeText(redacted).catch(console.error);
    
    // Update button to show success
    acceptBtn.textContent = '✓ Accepted!';
    acceptBtn.style.background = '#059669';
    
    // Log fix action
    updateLog(scanId, 'fix').catch(() => {
    // Error already handled in updateLog function
  });
    
    // Auto-dismiss after 1.5 seconds
    setTimeout(() => {
      pill.remove();
    }, 1500);
  });

  // Reject button handler
  const rejectBtn = pill.querySelector('#ai-guardrail-reject');
  rejectBtn.addEventListener('click', () => {
    updateLog(scanId, 'dismiss').catch(() => {
      // Error already handled in updateLog function
    });
    pill.remove();
    removeInlineSuggestions();
  });

  // Auto-dismiss after 15 seconds (longer for preview)
  setTimeout(() => {
    if (document.body.contains(pill)) {
      updateLog(scanId, 'dismiss').catch(() => {
      // Error already handled in updateLog function
    });
      pill.remove();
    }
    // Also remove inline suggestions when pill dismisses
    removeInlineSuggestions();
  }, 15000);
}

// Check if extension context is still valid
function isExtensionContextValid() {
  try {
    // Try to access chrome.runtime - if it throws, context is invalidated
    return chrome.runtime && chrome.runtime.id !== undefined;
  } catch (e) {
    return false;
  }
}

// Log risk to chrome.storage.local
async function logRisk(scanId, risks, source, filename) {
  try {
    // Check if extension context is still valid
    if (!isExtensionContextValid()) {
      console.warn('AI Guardrail: Extension context invalidated, skipping log');
      return;
    }

    const logEntry = {
      scanId,
      timestamp: Date.now(),
      risks: risks.map(r => ({
        type: r.type,
        confidence: r.confidence,
        // NO raw content - anonymized metadata only
      })),
      source,
      filename: filename || null,
      userAction: null, // Will be updated when user clicks Fix/Dismiss
    };

    // Get existing logs
    const result = await chrome.storage.local.get(['riskLogs']);
    const logs = result.riskLogs || [];

    // Add new log
    logs.push(logEntry);

    // Cap at 1000 entries (FIFO)
    if (logs.length > 1000) {
      logs.shift();
    }

    // Save
    await chrome.storage.local.set({ riskLogs: logs });
  } catch (error) {
    // Handle extension context invalidated error gracefully
    if (error.message && error.message.includes('Extension context invalidated')) {
      console.warn('AI Guardrail: Extension context invalidated, skipping log');
      return;
    }
    // Graceful fail - don't break extension if storage fails
    console.error('AI Guardrail: Storage error', error);
  }
}

// Update log entry with user action
async function updateLog(scanId, userAction) {
  try {
    // Check if extension context is still valid
    if (!isExtensionContextValid()) {
      console.warn('AI Guardrail: Extension context invalidated, skipping log update');
      return;
    }

    const result = await chrome.storage.local.get(['riskLogs']);
    const logs = result.riskLogs || [];

    const logEntry = logs.find(log => log.scanId === scanId);
    if (logEntry) {
      logEntry.userAction = userAction;
      logEntry.actionTimestamp = Date.now();
      await chrome.storage.local.set({ riskLogs: logs });
    }
  } catch (error) {
    // Handle extension context invalidated error gracefully
    if (error.message && error.message.includes('Extension context invalidated')) {
      console.warn('AI Guardrail: Extension context invalidated, skipping log update');
      return;
    }
    console.error('AI Guardrail: Failed to update log', error);
  }
}

// Initialize event listeners
function init() {
  console.log('🛡️ AI Guardrail: Content script initialized on', window.location.href);
  
  // Paste event
  document.addEventListener('paste', (e) => {
    console.log('🛡️ AI Guardrail: Paste event detected');
    handlePaste(e);
  }, true);

  // File upload detection
  document.addEventListener('change', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'file') {
      handleFileUpload(e);
    }
  }, true);

  // Input change detection (for large pastes)
  document.addEventListener('input', (e) => {
    handleInputChange(e);
  }, true);
  
  // Also handle contenteditable elements
  document.addEventListener('input', (e) => {
    if (e.target.isContentEditable) {
      handleInputChange(e);
    }
  }, true);

  // ChatGPT-specific detection (monitor input field directly)
  const setupChatGPTMonitoring = () => {
    // ChatGPT uses textarea with data-id attribute or contenteditable div
    const textarea = document.querySelector('textarea[data-id], textarea#prompt-textarea');
    const contentEditable = document.querySelector('[contenteditable="true"]');
    
    const inputElement = textarea || contentEditable;
    
    if (inputElement) {
      console.log('🛡️ AI Guardrail: Found ChatGPT input field', inputElement);
      
      let lastValue = inputElement.value || inputElement.textContent || '';
      let checkCount = 0;
      
      // Monitor for changes every 500ms
      const monitorInterval = setInterval(() => {
        const currentValue = inputElement.value || inputElement.textContent || '';
        
        if (currentValue !== lastValue) {
          const changeSize = currentValue.length - lastValue.length;
          
          // If significant change (likely paste), scan it
          if (changeSize > 20 && currentValue.length > lastValue.length) {
            const newText = currentValue.substring(lastValue.length);
            console.log('🛡️ AI Guardrail: Detected large text change, scanning...', newText.substring(0, 50));
            scanAndAlert(newText, 'paste');
          }
          
          lastValue = currentValue;
        }
        
        checkCount++;
        // Stop after 5 minutes to avoid memory leaks
        if (checkCount > 600) {
          clearInterval(monitorInterval);
        }
      }, 500);
      
      // Also listen for focus (user might paste when focused)
      inputElement.addEventListener('focus', () => {
        console.log('🛡️ AI Guardrail: Input field focused');
      });
    } else {
      // Retry after 2 seconds if input not found yet
      setTimeout(setupChatGPTMonitoring, 2000);
    }
  };
  
  // Start monitoring
  setupChatGPTMonitoring();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

