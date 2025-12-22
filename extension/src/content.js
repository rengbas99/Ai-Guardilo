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

// Detect large input changes (likely paste)
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
    }
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
  
  // Show floating pill
  showPill(scanId, risks, content, source, filename);
  
  // Log to storage (async, don't block)
  logRisk(scanId, risks, source, filename).catch(err => {
    console.error('AI Guardrail: Failed to log risk', err);
  });
}

// Show floating pill notification
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

  // Create pill element
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
      max-width: 400px;
      animation: slideIn 0.3s ease-out;
    ">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <span style="font-size: 20px;">⚠️</span>
        <strong style="font-size: 16px;">${fullRisks.length} risk${fullRisks.length > 1 ? 's' : ''} detected</strong>
      </div>
      <div style="font-size: 12px; opacity: 0.9; margin-bottom: 12px;">
        ${filename ? `In "${filename.length > 30 ? filename.substring(0, 30) + '...' : filename}"` : `From ${source}`}
      </div>
      <div style="font-size: 11px; opacity: 0.8; margin-bottom: 12px;">
        Types: ${[...new Set(fullRisks.map(r => r.type))].join(', ')}
      </div>
      <div style="display: flex; gap: 8px;">
        <button id="ai-guardrail-fix" style="
          flex: 1;
          background: white;
          color: #dc2626;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          font-size: 13px;
        ">Fix</button>
        <button id="ai-guardrail-dismiss" style="
          background: rgba(255,255,255,0.2);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
        ">Dismiss</button>
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
    </style>
  `;

  document.body.appendChild(pill);

  // Store data for fix button - use full text and full risks
  pill.dataset.scanId = scanId;
  pill.dataset.risks = JSON.stringify(fullRisks);
  pill.dataset.content = fullText;
  pill.dataset.inputElement = inputElement ? 'textarea' : (contentEditable ? 'contenteditable' : 'none');

  // Fix button handler
  const fixBtn = pill.querySelector('#ai-guardrail-fix');
  fixBtn.addEventListener('click', () => {
    const fullText = pill.dataset.content;
    const fullRisks = JSON.parse(pill.dataset.risks);
    const redacted = detector.redact(fullText, fullRisks);
    
    console.log('🛡️ AI Guardrail: Redacting text', { original: fullText.substring(0, 100), redacted: redacted.substring(0, 100) });
    
    // Find the input field again (in case DOM changed)
    const textarea = document.querySelector('textarea[data-id], textarea#prompt-textarea');
    const contentEditable = document.querySelector('[contenteditable="true"]');
    const inputElement = textarea || contentEditable;
    
    if (inputElement) {
      // Replace text in input field (like Grammarly)
      if (textarea) {
        textarea.value = redacted;
        // Trigger input event so ChatGPT recognizes the change
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (contentEditable) {
        contentEditable.textContent = redacted;
        // Trigger input event
        contentEditable.dispatchEvent(new Event('input', { bubbles: true }));
        // Also update innerHTML for contenteditable
        contentEditable.innerHTML = redacted.replace(/\n/g, '<br>');
      }
      console.log('🛡️ AI Guardrail: Text replaced in input field');
    }
    
    // Also copy to clipboard
    navigator.clipboard.writeText(redacted).then(() => {
      // Update button to show success
      fixBtn.textContent = '✓ Fixed!';
      fixBtn.style.background = '#10b981';
      fixBtn.style.color = 'white';
      
      // Log fix action
      updateLog(scanId, 'fix').catch(console.error);
      
      // Auto-dismiss after 2 seconds
      setTimeout(() => {
        pill.remove();
      }, 2000);
    }).catch(err => {
      console.error('AI Guardrail: Failed to copy to clipboard', err);
      // Still show success if input was updated
      if (inputElement) {
        fixBtn.textContent = '✓ Fixed!';
        fixBtn.style.background = '#10b981';
        fixBtn.style.color = 'white';
        setTimeout(() => {
          pill.remove();
        }, 2000);
      } else {
        fixBtn.textContent = 'Error';
      }
    });
  });

  // Dismiss button handler
  const dismissBtn = pill.querySelector('#ai-guardrail-dismiss');
  dismissBtn.addEventListener('click', () => {
    updateLog(scanId, 'dismiss').catch(console.error);
    pill.remove();
  });

  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    if (document.body.contains(pill)) {
      updateLog(scanId, 'dismiss').catch(console.error);
      pill.remove();
    }
  }, 10000);
}

// Log risk to chrome.storage.local
async function logRisk(scanId, risks, source, filename) {
  try {
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
    // Graceful fail - don't break extension if storage fails
    console.error('AI Guardrail: Storage error', error);
  }
}

// Update log entry with user action
async function updateLog(scanId, userAction) {
  try {
    const result = await chrome.storage.local.get(['riskLogs']);
    const logs = result.riskLogs || [];

    const logEntry = logs.find(log => log.scanId === scanId);
    if (logEntry) {
      logEntry.userAction = userAction;
      logEntry.actionTimestamp = Date.now();
      await chrome.storage.local.set({ riskLogs: logs });
    }
  } catch (error) {
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

