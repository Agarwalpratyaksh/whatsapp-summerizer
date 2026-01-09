// src/content/content.js
console.log("WA Scraper: Optimized Version with Emoji Support 🚀");

let selectionMode = false;
let captureActive = false;
let startMessageData = null;
let endMessageData = null;
let capturedMessagesMap = new Map();
let captureInterval = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ENABLE_SELECTION_MODE") {
    enableSelectionMode();
    sendResponse({ status: "Selection mode enabled" });
  } else if (request.action === "RESET_SELECTION") {
    disableSelectionMode();
    sendResponse({ status: "Reset done" });
  }
  return true;
});

function enableSelectionMode() {
  selectionMode = true;
  captureActive = false;
  startMessageData = null;
  endMessageData = null;
  capturedMessagesMap.clear();
  document.body.style.cursor = "crosshair";

  injectStyles();
  hideWhatsAppJumpButton();

  document.addEventListener("mouseover", handleHover);
  document.addEventListener("click", handleClick, { capture: true });

  console.log("✅ Selection mode enabled");
}

function disableSelectionMode() {
  console.log("🛑 Cleaning up...");
  selectionMode = false;
  captureActive = false;
  startMessageData = null;
  endMessageData = null;
  capturedMessagesMap.clear();
  document.body.style.cursor = "default";

  stopContinuousCapture();
  showWhatsAppJumpButton();

  document.getElementById("wa-selection-style")?.remove();
  document.getElementById("wa-capture-overlay")?.remove();

  document.removeEventListener("mouseover", handleHover);
  document.removeEventListener("click", handleClick, { capture: true });

  document.querySelectorAll(".wa-select-start, .wa-select-end, .wa-select-hover")
    .forEach((el) => {
      el.classList.remove("wa-select-start", "wa-select-end", "wa-select-hover");
    });
}

// --- OPTIMIZED CAPTURE LOGIC ---

function startContinuousCapture() {
  if (captureInterval) clearInterval(captureInterval);
  
  // Capture immediately when starting
  captureCurrentViewport();
  
  captureInterval = setInterval(() => {
    if (captureActive) {
      captureCurrentViewport();
      updateCaptureUI();
    }
  }, 150); // Slightly slower for better performance

  console.log("✅ Continuous capture started");
}

function stopContinuousCapture() {
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }
  console.log("⏸️ Continuous capture stopped");
}

function captureCurrentViewport() {
  const rows = getChatRows();
  
  rows.forEach((row) => {
    const msgData = extractMessageData(row);
    if (msgData && msgData.text && !capturedMessagesMap.has(msgData.id)) {
      capturedMessagesMap.set(msgData.id, msgData);
    }
  });
}

function updateCaptureUI() {
  const overlay = document.getElementById('wa-capture-overlay');
  if (overlay && captureActive) {
    const count = capturedMessagesMap.size;
    overlay.innerHTML = `
      <div style="font-size: 24px; margin-bottom: 8px;">📥</div>
      <div style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">Capturing...</div>
      <div style="font-size: 28px; font-weight: 700; color: #22c55e; margin: 8px 0;">${count}</div>
      <div style="font-size: 13px; color: #aaa;">messages captured</div>
      <div style="font-size: 12px; color: #666; margin-top: 12px;">Scroll and click END message</div>
    `;
  }
}

// --- SMART PROCESSING (OPTIMIZED) ---

async function performIntelligentCapture(startData, endData) {
  console.log("🚀 Starting intelligent capture");
  console.log("START:", startData.preview);
  console.log("END:", endData.preview);
  
  showProgressOverlay("Processing...", 30);

  // Ensure both endpoints are captured
  if (!capturedMessagesMap.has(startData.id)) {
    capturedMessagesMap.set(startData.id, startData);
  }
  if (!capturedMessagesMap.has(endData.id)) {
    capturedMessagesMap.set(endData.id, endData);
  }

  // One final viewport capture
  await sleep(200);
  captureCurrentViewport();

  console.log(`Total captured: ${capturedMessagesMap.size} messages`);
  
  showProgressOverlay("Organizing messages...", 60);
  await sleep(300);
  
  extractAndSendRange(startData, endData);
}

// --- ENHANCED DATA EXTRACTION (WITH EMOJI SUPPORT) ---

function extractAndSendRange(startData, endData) {
  console.log("📦 Extracting message range");
  showProgressOverlay("Finalizing...", 80);
  
  let allMessages = Array.from(capturedMessagesMap.values());
  
  // Filter out invalid messages
  allMessages = allMessages.filter(m => m && m.text && m.text.trim().length > 0);
  
  if (allMessages.length === 0) {
    return sendError("No messages found");
  }

  console.log(`Valid messages: ${allMessages.length}`);

  // Find start and end indices with multiple strategies
  let startIndex = findMessageIndex(allMessages, startData);
  let endIndex = findMessageIndex(allMessages, endData);

  console.log("Indices - Start:", startIndex, "End:", endIndex);

  // Fallback to extremes if not found
  if (startIndex === -1) startIndex = 0;
  if (endIndex === -1) endIndex = allMessages.length - 1;

  // Ensure correct order
  if (startIndex > endIndex) {
    [startIndex, endIndex] = [endIndex, startIndex];
  }

  // Extract range
  let selectedMessages = allMessages.slice(startIndex, endIndex + 1);
  
  if (selectedMessages.length === 0) {
    return sendError("Could not extract message range");
  }

  // Deduplicate
  selectedMessages = deduplicateMessages(selectedMessages);

  console.log(`Final count: ${selectedMessages.length} messages`);

  // Format with emojis preserved
  const formattedOutput = formatMessages(selectedMessages);

  showProgressOverlay("Complete! ✅", 100);

  setTimeout(() => {
    chrome.runtime.sendMessage({
      action: "SELECTION_COMPLETE",
      data: formattedOutput,
    });
    disableSelectionMode();
  }, 400);
}

function findMessageIndex(messages, targetData) {
  // Strategy 1: Exact ID match
  let index = messages.findIndex(m => m.id === targetData.id);
  if (index !== -1) return index;

  // Strategy 2: Text content match (first 30 chars)
  const targetText = targetData.text.substring(0, 30).trim();
  index = messages.findIndex(m => 
    m.text.substring(0, 30).trim() === targetText
  );
  if (index !== -1) return index;

  // Strategy 3: Fuzzy text match
  index = messages.findIndex(m => 
    m.text.includes(targetText) || targetText.includes(m.text.substring(0, 20))
  );
  
  return index;
}

function deduplicateMessages(messages) {
  const seen = new Set();
  const unique = [];

  messages.forEach(msg => {
    // Create fingerprint: timestamp + sender + first 50 chars of text
    const fingerprint = `${msg.timestamp}_${msg.sender}_${msg.text.substring(0, 50)}`;
    
    if (!seen.has(fingerprint)) {
      seen.add(fingerprint);
      unique.push(msg);
    }
  });

  return unique;
}

function formatMessages(messages) {
  return messages.map((msg, i) => {
    const prev = messages[i - 1];
    
    // Compact format for consecutive messages from same sender
    if (prev && prev.sender === msg.sender) {
      return `> ${msg.text}`;
    }
    
    // Full format with timestamp and sender
    return `\n[${msg.timestamp}] ${msg.sender}: ${msg.text}`;
  }).join("\n").trim();
}

// --- ENHANCED MESSAGE EXTRACTION (EMOJI SUPPORT) ---

function extractMessageData(row) {
  try {
    const copyable = row.querySelector(".copyable-text");
    const timeEl = row.querySelector('span[data-testid="msg-time"]') || 
                   row.querySelector('span[dir="auto"]._amig');

    let text = "";
    let sender = "System";
    let timestamp = timeEl ? timeEl.innerText.trim() : "";
    let type = "system";

    if (copyable) {
      // Extract sender and timestamp from data attribute
      const dateStr = copyable.getAttribute("data-pre-plain-text") || "";
      const match = dateStr.match(/\[(.*?)\]\s*(.*?):/);
      
      if (match) {
        timestamp = match[1].trim();
        sender = match[2].trim();
      }

      // CRITICAL: Extract text WITH emojis preserved
      const textSpan = copyable.querySelector('span.selectable-text');
      if (textSpan) {
        // Get ALL child nodes including text and emoji images
        text = extractTextWithEmojis(textSpan);
      } else {
        text = copyable.innerText.trim();
      }
      
      type = "text";
    } else {
      // Handle system messages, media, stickers
      const img = row.querySelector("img");
      if (img && img.src && img.src.includes("sticker")) {
        text = "[Sticker]";
        type = "media";
      } else if (img || row.querySelector('span[data-testid="media-play"]')) {
        text = "[Media/Photo]";
        type = "media";
      } else if (row.innerText.includes("deleted")) {
        text = "[Deleted Message]";
        type = "system";
      } else {
        text = row.innerText.replace(/\d{1,2}:\d{2}\s?[ap]m/i, "").trim();
        type = "system";
      }
    }

    // Create unique ID
    const dataId = row.getAttribute("data-id");
    const textHash = hashText(text.substring(0, 20));
    const uniqueId = dataId || `msg_${timestamp}_${sender}_${textHash}`;

    return {
      id: uniqueId,
      timestamp,
      sender,
      text,
      preview: `${sender}: ${text.substring(0, 30)}...`,
      type,
    };
  } catch (error) {
    console.error("Error extracting message:", error);
    return null;
  }
}

// EMOJI EXTRACTION: Get text with emojis from WhatsApp's DOM
function extractTextWithEmojis(element) {
  let text = "";
  
  // Traverse all child nodes
  element.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      // Regular text
      text += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.tagName === 'IMG' && node.classList.contains('_1f4bz')) {
        // WhatsApp emoji image - get the alt text (actual emoji)
        text += node.alt || '';
      } else if (node.tagName === 'SPAN') {
        // Nested span, recurse
        text += extractTextWithEmojis(node);
      } else {
        // Other elements, try to get text content
        text += node.textContent || '';
      }
    }
  });
  
  return text;
}

function hashText(text) {
  // Simple hash for unique ID generation
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// --- DOM HELPERS ---

function getChatContainer() {
  const selectors = [
    'div[data-tab="6"]',
    'div[data-tab="7"]',
    'div[data-tab="8"]',
    'div[aria-label*="Message list"]',
    'div[aria-label*="essage list"]'
  ];
  
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.scrollHeight > el.clientHeight) {
      return el;
    }
  }
  
  // Fallback: find largest scrollable container
  const divs = Array.from(document.querySelectorAll('div'));
  return divs.find(div => 
    div.scrollHeight > div.clientHeight && 
    div.scrollHeight > 1000
  ) || null;
}

function getChatRows() {
  const rows = Array.from(document.querySelectorAll('div[role="row"]'));
  const leftBoundary = window.innerWidth * 0.25;
  
  return rows.filter(row => {
    const rect = row.getBoundingClientRect();
    return (
      rect.width > 100 &&
      rect.height > 20 &&
      rect.left > leftBoundary &&
      rect.top >= -50 && // Include slightly off-screen
      rect.bottom <= window.innerHeight + 50
    );
  });
}

// --- UI COMPONENTS ---

function injectStyles() {
  const style = document.createElement("style");
  style.id = "wa-selection-style";
  style.innerHTML = `
    .wa-select-hover { 
      outline: 2px dashed #3b82f6 !important; 
      background: rgba(59, 130, 246, 0.08) !important; 
      cursor: pointer !important;
      transition: all 0.15s ease;
    }
    .wa-select-start { 
      outline: 3px solid #22c55e !important; 
      background: rgba(34, 197, 94, 0.15) !important;
      box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2) !important;
    }
    .wa-select-end { 
      outline: 3px solid #ef4444 !important; 
      background: rgba(239, 68, 68, 0.15) !important;
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2) !important;
    }
    .wa-hide-jump [aria-label="Scroll to bottom"], 
    .wa-hide-jump [data-testid="scroll-to-bottom-button"] { 
      display: none !important; 
    }
    .wa-capture-overlay { 
      position: fixed; 
      top: 50%; 
      left: 50%; 
      transform: translate(-50%, -50%); 
      background: rgba(0, 0, 0, 0.95); 
      color: white; 
      padding: 32px 40px; 
      border-radius: 16px; 
      z-index: 10000; 
      text-align: center; 
      min-width: 280px; 
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
  `;
  document.head.appendChild(style);
}

function hideWhatsAppJumpButton() {
  document.body.classList.add("wa-hide-jump");
}

function showWhatsAppJumpButton() {
  document.body.classList.remove("wa-hide-jump");
}

function handleHover(e) {
  if (!selectionMode || captureActive) return;
  
  const prev = document.querySelector(".wa-select-hover");
  if (prev) prev.classList.remove("wa-select-hover");
  
  const target = e.target.closest('div[role="row"]');
  if (target) target.classList.add("wa-select-hover");
}

function handleClick(e) {
  if (!selectionMode) return;
  
  const target = e.target.closest('div[role="row"]');
  if (!target) return;
  
  e.preventDefault();
  e.stopPropagation();

  if (!captureActive) {
    // SELECT START
    startMessageData = extractMessageData(target);
    if (!startMessageData) {
      console.error("Failed to extract start message");
      return;
    }
    
    console.log("✅ START:", startMessageData.preview);
    target.classList.add("wa-select-start");
    captureActive = true;
    
    capturedMessagesMap.set(startMessageData.id, startMessageData);
    
    startContinuousCapture();
    showInstructions();
    
    chrome.runtime.sendMessage({
      action: "STATUS_UPDATE",
      text: "Start selected! Scroll to end message."
    });
  } else {
    // SELECT END
    endMessageData = extractMessageData(target);
    if (!endMessageData) {
      console.error("Failed to extract end message");
      return;
    }
    
    console.log("✅ END:", endMessageData.preview);
    target.classList.add("wa-select-end");
    
    stopContinuousCapture();
    capturedMessagesMap.set(endMessageData.id, endMessageData);
    
    performIntelligentCapture(startMessageData, endMessageData);
  }
}

function showInstructions() {
  const div = document.createElement('div');
  div.id = 'wa-capture-overlay';
  div.className = 'wa-capture-overlay';
  div.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 12px;">✅</div>
    <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Start Selected</div>
    <div style="font-size: 13px; color: #aaa;">Scroll and click the END message</div>
  `;
  document.body.appendChild(div);
}

function showProgressOverlay(text, pct) {
  let el = document.getElementById('wa-capture-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'wa-capture-overlay';
    el.className = 'wa-capture-overlay';
    document.body.appendChild(el);
  }
  
  el.innerHTML = `
    <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">${text}</div>
    <div style="background: #333; height: 6px; border-radius: 3px; overflow: hidden;">
      <div style="background: linear-gradient(90deg, #22c55e, #10b981); height: 100%; width: ${pct}%; transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);"></div>
    </div>
    <div style="font-size: 13px; color: #888; margin-top: 10px;">${Math.round(pct)}%</div>
  `;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sendError(msg) {
  console.error("❌ ERROR:", msg);
  chrome.runtime.sendMessage({
    action: "SELECTION_COMPLETE",
    data: "Error: " + msg
  });
  disableSelectionMode();
}