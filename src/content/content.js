// src/content/content.js - REAL-TIME CAPTURE SYSTEM
console.log("WA Scraper: Real-Time Capture System Loaded");

let selectionMode = false;
let captureMode = false;
let startMessageData = null;
let capturedMessages = []; // Messages captured in real-time
let captureStarted = false;
let observer = null;
let autoScrollInterval = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ENABLE_SELECTION_MODE") {
    enableSelectionMode();
    sendResponse({ status: "Selection mode enabled" });
  } 
  else if (request.action === "RESET_SELECTION") {
    disableSelectionMode();
    sendResponse({ status: "Reset done" });
  }
  return true;
});

function enableSelectionMode() {
  selectionMode = true;
  captureMode = false;
  captureStarted = false;
  startMessageData = null;
  capturedMessages = [];
  document.body.style.cursor = "crosshair";
  
  injectStyles();
  document.addEventListener('mouseover', handleHover);
  document.addEventListener('click', handleClick, { capture: true });
}

function disableSelectionMode() {
  console.log("🛑 Disabling selection mode");
  
  selectionMode = false;
  captureMode = false;
  captureStarted = false;
  startMessageData = null;
  capturedMessages = [];
  document.body.style.cursor = "default";
  
  // Stop observer
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  
  // Stop auto-scroll
  if (autoScrollInterval) {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;
  }
  
  // Clean up UI
  const style = document.getElementById("wa-selection-style");
  if (style) style.remove();
  
  const overlay = document.getElementById("wa-capture-overlay");
  if (overlay) overlay.remove();
  
  const jumpBtn = document.getElementById("wa-custom-jump-btn");
  if (jumpBtn) jumpBtn.remove();
  
  // Clean up event listeners
  document.removeEventListener('mouseover', handleHover);
  document.removeEventListener('click', handleClick, { capture: true });
  
  // Remove markers
  document.querySelectorAll('.wa-select-start, .wa-select-end, .wa-select-hover').forEach(el => {
    el.classList.remove('wa-select-start', 'wa-select-end', 'wa-select-hover');
  });
  
  console.log("✓ Selection mode disabled");
}

function injectStyles() {
  const style = document.createElement('style');
  style.id = "wa-selection-style";
  style.innerHTML = `
    .wa-select-hover { 
      border: 2px dashed #3b82f6 !important; 
      background: rgba(59, 130, 246, 0.1) !important; 
      cursor: pointer !important; 
    }
    .wa-select-start { 
      border: 3px solid #22c55e !important; 
      background: rgba(34, 197, 94, 0.2) !important; 
      box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.3) !important;
    }
    .wa-select-end { 
      border: 3px solid #ef4444 !important; 
      background: rgba(239, 68, 68, 0.2) !important; 
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.3) !important;
    }
    .wa-capture-overlay {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.95);
      color: white;
      padding: 24px 32px;
      border-radius: 12px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      border: 1px solid rgba(255,255,255,0.1);
      min-width: 320px;
      text-align: center;
    }
    .wa-custom-jump-btn {
      position: fixed;
      bottom: 100px;
      right: 50%;
      transform: translateX(50%);
      background: linear-gradient(135deg, #22c55e, #16a34a);
      color: white;
      padding: 16px 24px;
      border-radius: 50px;
      z-index: 999998;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      box-shadow: 0 4px 20px rgba(34, 197, 94, 0.4);
      border: 2px solid rgba(255,255,255,0.3);
      cursor: pointer;
      font-weight: 600;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.3s ease;
    }
    .wa-custom-jump-btn:hover {
      transform: translateX(50%) scale(1.05);
      box-shadow: 0 6px 25px rgba(34, 197, 94, 0.5);
    }
  `;
  document.head.appendChild(style);
}

function handleHover(e) {
  if (!selectionMode || captureMode) return;
  const prev = document.querySelector('.wa-select-hover');
  if (prev) prev.classList.remove('wa-select-hover');
  const target = e.target.closest('div[role="row"]');
  if (target) target.classList.add('wa-select-hover');
}

function handleClick(e) {
  if (!selectionMode) return;

  const target = e.target.closest('div[role="row"]');
  if (!target) return;

  e.preventDefault();
  e.stopPropagation();

  if (!captureStarted) {
    // STEP 1: User clicks START message
    startMessageData = extractMessageData(target);
    target.classList.add('wa-select-start');
    captureStarted = true;
    
    console.log("✓ START MESSAGE:", startMessageData);
    
    // Start real-time capture
    startRealTimeCapture();
    
    // Add the start message to captured list
    capturedMessages.push(startMessageData);
    
    // Show custom jump button and overlay
    showCaptureMode();
    
    chrome.runtime.sendMessage({ 
      action: "STATUS_UPDATE", 
      text: "Capturing... Scroll to the end or use our Smart Jump button!" 
    });
  
  } else {
    // STEP 2: User clicks END message
    const endMessageData = extractMessageData(target);
    target.classList.add('wa-select-end');
    
    console.log("✓ END MESSAGE:", endMessageData);
    console.log(`✓ Captured ${capturedMessages.length} messages in real-time`);
    
    // Stop capture
    stopRealTimeCapture();
    
    // Find start and end in captured messages
    finalizeCaptureRange(startMessageData, endMessageData);
  }
}

// Extract message data
function extractMessageData(row) {
  const copyable = row.querySelector('.copyable-text');
  
  if (copyable) {
    const meta = copyable.getAttribute('data-pre-plain-text') || "";
    
    const timeMatch = meta.match(/\[(\d{1,2}:\d{2})/);
    const dateMatch = meta.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    const senderMatch = meta.match(/\]\s*(.+?):\s*$/);
    
    const timestamp = timeMatch ? timeMatch[1] : "";
    const date = dateMatch ? dateMatch[1] : "";
    const sender = senderMatch ? senderMatch[1].trim() : "";
    
    const textSpan = copyable.querySelector('span.selectable-text') || 
                     copyable.querySelector('span[dir="ltr"]') || 
                     copyable.querySelector('span[dir="auto"]');
    
    let text = "";
    if (textSpan) {
      text = textSpan.innerText;
    } else {
      text = copyable.innerText.replace(meta, '');
    }
    
    text = text.replace(/\s+/g, ' ').trim();
    
    // Create unique ID
    const uniqueId = `${date}_${timestamp}_${sender}_${text.substring(0, 30)}`;
    
    return {
      id: uniqueId,
      timestamp,
      date,
      sender,
      text,
      fullMeta: meta.trim(),
      rawText: `[${meta.trim()}] ${text}`,
      type: 'text'
    };
  }
  
  // Media
  const img = row.querySelector('img');
  if (img) {
    const src = img.src || "";
    const isSticker = src.includes("sticker");
    const mediaType = isSticker ? "Sticker" : "Media";
    
    const timeEl = row.querySelector('span[data-testid="msg-time"]');
    const timestamp = timeEl ? timeEl.textContent.trim() : "";
    
    const uniqueId = `media_${timestamp}_${Date.now()}`;
    
    return {
      id: uniqueId,
      timestamp,
      text: `[${mediaType}]`,
      rawText: `[${timestamp}] [${mediaType}]`,
      type: 'media'
    };
  }
  
  // Fallback
  const rawText = row.innerText.replace(/\n/g, ' ').trim();
  return {
    id: `fallback_${Date.now()}`,
    text: rawText,
    rawText: rawText,
    type: 'unknown'
  };
}

// Start capturing messages in real-time as they appear
function startRealTimeCapture() {
  captureMode = true;
  
  // Get chat container
  const chatContainer = getChatContainer();
  if (!chatContainer) {
    console.error("Could not find chat container");
    return;
  }
  
  // Capture initial visible messages
  captureVisibleMessages();
  
  // Set up MutationObserver to watch for new messages
  observer = new MutationObserver((mutations) => {
    captureVisibleMessages();
  });
  
  observer.observe(chatContainer, {
    childList: true,
    subtree: true
  });
  
  console.log("✓ Real-time capture started");
}

function stopRealTimeCapture() {
  captureMode = false;
  
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  
  if (autoScrollInterval) {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;
  }
  
  console.log("✓ Real-time capture stopped");
}

// Capture all currently visible messages
function captureVisibleMessages() {
  const rows = getChatRows();
  
  rows.forEach(row => {
    const msgData = extractMessageData(row);
    
    // Check if already captured (avoid duplicates)
    const exists = capturedMessages.some(m => m.id === msgData.id);
    if (!exists) {
      capturedMessages.push(msgData);
    }
  });
}

// Show capture mode UI with custom jump button
function showCaptureMode() {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = "wa-capture-overlay";
  overlay.className = "wa-capture-overlay";
  overlay.innerHTML = `
    <div style="font-size: 20px; margin-bottom: 8px;">📥</div>
    <div style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">Capturing Messages</div>
    <div style="font-size: 14px; color: #a0a0a0; margin-bottom: 16px;">
      Scroll down manually or use the Smart Jump button
    </div>
    <div id="wa-message-counter" style="font-size: 24px; font-weight: bold; color: #22c55e;">
      ${capturedMessages.length} messages
    </div>
    <div style="margin-top: 16px; font-size: 12px; opacity: 0.7;">
      Click the last message when done
    </div>
  `;
  document.body.appendChild(overlay);
  
  // Update counter periodically
  setInterval(() => {
    const counter = document.getElementById('wa-message-counter');
    if (counter && captureMode) {
      counter.textContent = `${capturedMessages.length} messages`;
    }
  }, 500);
  
  // Create custom jump button
  const jumpBtn = document.createElement('div');
  jumpBtn.id = "wa-custom-jump-btn";
  jumpBtn.className = "wa-custom-jump-btn";
  jumpBtn.innerHTML = `
    <span style="font-size: 20px;">⚡</span>
    <span>Smart Jump to End</span>
  `;
  jumpBtn.onclick = handleSmartJump;
  document.body.appendChild(jumpBtn);
}

// Smart jump that scrolls fast while capturing
async function handleSmartJump() {
  console.log("⚡ Smart Jump initiated");
  
  const chatContainer = getChatContainer();
  if (!chatContainer) return;
  
  const jumpBtn = document.getElementById('wa-custom-jump-btn');
  if (jumpBtn) jumpBtn.innerHTML = '<span>⚡ Jumping...</span>';
  
  // Fast scroll to bottom while capturing
  const scrollStep = chatContainer.clientHeight * 0.8;
  let attempts = 0;
  const maxAttempts = 100;
  
  while (attempts < maxAttempts) {
    const beforeScroll = chatContainer.scrollTop;
    chatContainer.scrollTop += scrollStep;
    const afterScroll = chatContainer.scrollTop;
    
    // Capture messages at this position
    captureVisibleMessages();
    
    // Small delay to let WhatsApp load messages
    await sleep(150);
    
    // Check if reached bottom
    if (afterScroll >= chatContainer.scrollHeight - chatContainer.clientHeight - 50) {
      console.log("✓ Reached bottom");
      break;
    }
    
    // Check if scroll didn't move (stuck)
    if (beforeScroll === afterScroll) {
      console.log("✓ Scroll complete");
      break;
    }
    
    attempts++;
  }
  
  // Capture final position
  captureVisibleMessages();
  
  if (jumpBtn) {
    jumpBtn.innerHTML = `
      <span style="font-size: 20px;">✓</span>
      <span>Arrived! Click last message</span>
    `;
  }
  
  console.log(`✓ Jump complete. Captured ${capturedMessages.length} messages`);
}

// Finalize: extract range between start and end
function finalizeCaptureRange(startData, endData) {
  console.log("Finalizing capture...");
  console.log("Total captured:", capturedMessages.length);
  
  // Find indices
  let startIndex = capturedMessages.findIndex(m => m.id === startData.id);
  let endIndex = capturedMessages.findIndex(m => m.id === endData.id);
  
  console.log("Start index:", startIndex, "End index:", endIndex);
  
  if (startIndex === -1 || endIndex === -1) {
    // Fallback: try fuzzy matching
    startIndex = capturedMessages.findIndex(m => 
      m.timestamp === startData.timestamp && 
      m.text.substring(0, 20) === startData.text.substring(0, 20)
    );
    
    endIndex = capturedMessages.findIndex(m => 
      m.timestamp === endData.timestamp && 
      m.text.substring(0, 20) === endData.text.substring(0, 20)
    );
  }
  
  if (startIndex === -1 || endIndex === -1) {
    console.error("Could not locate messages in capture");
    chrome.runtime.sendMessage({ 
      action: "SELECTION_COMPLETE", 
      data: `Error: Could not locate messages.\n\nCaptured: ${capturedMessages.length} messages\nStart found: ${startIndex !== -1}\nEnd found: ${endIndex !== -1}` 
    });
    disableSelectionMode();
    return;
  }
  
  // Ensure correct order
  const [start, end] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
  
  // Extract range
  const selectedMessages = capturedMessages.slice(start, end + 1);
  const result = selectedMessages.map(m => m.rawText).join("\n\n");
  
  console.log(`✓ Extracted ${selectedMessages.length} messages`);
  
  chrome.runtime.sendMessage({ 
    action: "SELECTION_COMPLETE", 
    data: result 
  });
  
  disableSelectionMode();
}

// Helper: Get chat container
function getChatContainer() {
  const selectors = [
    'div[data-tab="6"]',
    'div[data-tab="7"]',
    'div[aria-label*="Message list"]',
    'div[aria-label*="Messages"]'
  ];
  
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el && el.scrollHeight > el.clientHeight) {
      return el;
    }
  }
  
  // Heuristic search
  const allDivs = document.querySelectorAll('div');
  for (const div of allDivs) {
    if (div.scrollHeight <= div.clientHeight) continue;
    const hasMessages = div.querySelectorAll('div[role="row"]').length > 5;
    if (!hasMessages) continue;
    const rect = div.getBoundingClientRect();
    if (rect.left < window.innerWidth * 0.25) continue;
    if (rect.width < 300 || rect.height < 300) continue;
    return div;
  }
  
  return null;
}

// Helper: Get chat rows
function getChatRows() {
  const rawRows = Array.from(document.querySelectorAll('div[role="row"]'));
  const screenWidth = window.innerWidth;
  const safeZone = screenWidth * 0.30;
  
  return rawRows.filter(row => {
    const rect = row.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.left > safeZone;
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}