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
      <div style="font-size: 40px; margin-bottom: 16px; opacity: 0.9;">📥</div>
      <div style="font-size: 15px; font-weight: 500; margin-bottom: 8px; opacity: 0.6;">Capturing Messages</div>
      <div style="font-size: 48px; font-weight: 600; color: #25D366; margin: 16px 0; letter-spacing: -0.02em;">${count}</div>
      <div style="font-size: 13px; color: rgba(255,255,255,0.4); margin-bottom: 20px;">messages captured</div>
      <div style="font-size: 12px; color: rgba(255,255,255,0.3); padding: 12px 20px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
        Scroll and click the last message
      </div>
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

  console.log("Initial Indices - Start:", startIndex, "End:", endIndex);

  // CRITICAL FIX: If we can't find exact matches, try timestamp-based ordering
  if (startIndex === -1 || endIndex === -1) {
    console.log("⚠️ Using fallback: timestamp-based range detection");
    
    // Find by timestamp comparison
    const startTime = parseTime(startData.timestamp);
    const endTime = parseTime(endData.timestamp);
    
    startIndex = allMessages.findIndex(m => parseTime(m.timestamp) >= startTime);
    endIndex = allMessages.findIndex(m => parseTime(m.timestamp) >= endTime);
    
    if (startIndex === -1) startIndex = 0;
    if (endIndex === -1) endIndex = allMessages.length - 1;
  }

  // Ensure correct order
  if (startIndex > endIndex) {
    [startIndex, endIndex] = [endIndex, startIndex];
  }

  console.log("Final Indices - Start:", startIndex, "End:", endIndex);

  // Extract range - STRICT BOUNDARY
  let selectedMessages = allMessages.slice(startIndex, endIndex + 1);
  
  if (selectedMessages.length === 0) {
    return sendError("Could not extract message range");
  }

  // Deduplicate
  selectedMessages = deduplicateMessages(selectedMessages);

  console.log(`Final count: ${selectedMessages.length} messages`);

  // Format with TOKEN OPTIMIZATION
  const formattedOutput = formatMessagesOptimized(selectedMessages);

  showProgressOverlay("Complete! ✅", 100);

  setTimeout(() => {
    chrome.runtime.sendMessage({
      action: "SELECTION_COMPLETE",
      data: formattedOutput,
    });
    disableSelectionMode();
  }, 400);
}

// Helper: Parse time for comparison (handles AM/PM)
function parseTime(timeStr) {
  // Format: "11:55 am" or "4:57 pm"
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (!match) return 0;
  
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const period = match[3].toLowerCase();
  
  if (period === 'pm' && hours !== 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;
  
  return hours * 60 + minutes;
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

// TOKEN-OPTIMIZED FORMATTING

function formatMessagesOptimized(messages) {
  let output = [];
  let lastSender = null;
  
  messages.forEach((msg) => {
    // Clean up text
    let content = msg.text.trim();
    if (!content) return;

    // Logic: New Sender vs Same Sender
    if (lastSender === msg.sender) {
      // If it's a continuation, check if it has a reply context
      if (content.startsWith("[Replying to:")) {
         output.push(`\n   ${content}`); // Indent replies slightly
      } else {
         output.push(`>> ${content}`);
      }
    } else {
      // New Speaker
      const prefix = lastSender ? "\n" : ""; 
      output.push(`${prefix}${msg.sender} [${msg.timestamp}]:\n   ${content}`);
    }
    
    lastSender = msg.sender;
  });
  
  return output.join('\n');
}


// --- ROBUST DATA EXTRACTION (FIXED EMOJIS) ---


// --- FIXED EXTRACTION LOGIC (SEPARATES REPLIES) ---

function extractMessageData(row) {
  try {
    const copyable = row.querySelector(".copyable-text");
    const timeEl = row.querySelector('span[data-testid="msg-time"]') || 
                   row.querySelector('span[dir="auto"]._amig');

    let text = "";
    let sender = "System";
    let timestamp = timeEl ? timeEl.innerText.trim() : "";
    let type = "system";
    let replyContext = "";

    if (copyable) {
      // 1. Metadata
      const dateStr = copyable.getAttribute("data-pre-plain-text") || "";
      const match = dateStr.match(/\[(.*?)\]\s*(.*?):/);
      if (match) {
        timestamp = match[1].trim();
        sender = match[2].trim();
      }

      // 2. Reply Detection
      const quoteContainer = row.querySelector('div[aria-label="Quoted message"]');
      if (quoteContainer) {
        const rawQuote = quoteContainer.innerText.replace(/\n/g, ' ').substring(0, 40);
        replyContext = `[Replying to: "${rawQuote}..."] `;
      }

      // 3. Extraction
      const realMessageNode = copyable.querySelector('span.selectable-text');
      if (realMessageNode) {
        text = extractTextWithEmojis(realMessageNode);
      } else {
        // Fallback: Clone and clean
        const clone = copyable.cloneNode(true);
        const quoteInClone = clone.querySelector('div[aria-label="Quoted message"]');
        if (quoteInClone) quoteInClone.remove();
        text = extractTextWithEmojis(clone);
      }

      // 4. CLEANUP (The Fix for "11:55 am") 🧹
      // If the text ends with the timestamp, slice it off
      if (timestamp && text.trim().endsWith(timestamp)) {
         text = text.trim().slice(0, -timestamp.length).trim();
      }
      // Regex backup: Remove trailing time pattern "12:00 pm" if it appears at the very end
      text = text.replace(/\d{1,2}:\d{2}\s?[ap]m$/i, '').trim();

      type = "text";
    } else {
      // System/Media logic...
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

    const uniqueId = row.getAttribute("data-id") || `${timestamp}_${sender}_${text.substring(0,15)}`;
    const finalText = replyContext ? `${replyContext}\n${text}` : text;

    return {
      id: uniqueId,
      timestamp,
      sender,
      text: finalText,
      rawText: text,
      preview: `${sender}: ${text.substring(0, 30)}...`,
      type,
    };
  } catch (error) {
    console.error("Extraction Error:", error);
    return null;
  }
}

// THE EMOJI FIXER FUNCTION
function getDeepText(element) {
  // 1. Clone the node so we don't destroy the actual WhatsApp UI
  const clone = element.cloneNode(true);
  
  // 2. Find all WhatsApp emoji images
  // WhatsApp uses images with class 'b87' or similar, but 'img' is safer
  const images = clone.querySelectorAll('img');
  
  images.forEach(img => {
    // WhatsApp puts the emoji char in 'alt' or 'data-plain-text'
    const emojiChar = img.alt || img.getAttribute('data-plain-text') || "";
    
    // Replace the <img> tag with a text node containing the emoji
    if (emojiChar) {
      const textNode = document.createTextNode(emojiChar);
      img.parentNode.replaceChild(textNode, img);
    }
  });

  // 3. Return the clean text
  return clone.innerText || clone.textContent;
}
// EMOJI EXTRACTION: Get text with emojis from WhatsApp's DOM
// HELPER: Extract text + emojis but IGNORE time and metadata
function extractTextWithEmojis(element) {
  let text = "";
  
  const traverse = (node) => {
    // 1. IGNORE Time & Metadata Nodes
    if (node.nodeType === Node.ELEMENT_NODE) {
      const isTime = node.getAttribute('data-testid') === 'msg-time' || 
                     node.classList.contains('_amig') ||
                     node.innerText.match(/\d{1,2}:\d{2}\s?[ap]m/i); // Safety check
                     
      // If this specific node is the time, SKIP it
      // (But be careful not to skip the whole message if the message contains a time string)
      // Best check: does it have data-pre-plain-text? No, that's the parent.
      // Check strict classes or if it's a known time container.
      if (node.getAttribute('data-testid') === 'msg-time') return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.tagName === 'IMG') {
        const emoji = node.getAttribute('alt') || 
                     node.getAttribute('data-plain-text') ||
                     node.getAttribute('aria-label') || '';
        text += emoji;
      } else {
        node.childNodes.forEach(child => traverse(child));
      }
    }
  };
  
  traverse(element);
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
      outline: 2px solid rgba(37, 211, 102, 0.3) !important; 
      background: rgba(37, 211, 102, 0.05) !important; 
      cursor: pointer !important;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .wa-select-start { 
      outline: 2px solid #25D366 !important; 
      background: rgba(37, 211, 102, 0.08) !important;
      box-shadow: 0 0 0 4px rgba(37, 211, 102, 0.12) !important;
    }
    .wa-select-end { 
      outline: 2px solid #25D366 !important; 
      background: rgba(37, 211, 102, 0.08) !important;
      box-shadow: 0 0 0 4px rgba(37, 211, 102, 0.12) !important;
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
      background: rgba(10, 10, 10, 0.98); 
      color: white; 
      padding: 32px 40px; 
      border-radius: 16px; 
      z-index: 10000; 
      text-align: center; 
      min-width: 320px; 
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.08);
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
    <div style="width: 56px; height: 56px; background: rgba(37, 211, 102, 0.1); border-radius: 12px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
      <span style="font-size: 32px;">✓</span>
    </div>
    <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">Start Selected</div>
    <div style="font-size: 13px; color: rgba(255,255,255,0.5);">Scroll and click the last message</div>
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
    <div style="font-size: 15px; font-weight: 500; margin-bottom: 20px; opacity: 0.7;">${text}</div>
    <div style="background: rgba(255,255,255,0.06); height: 4px; border-radius: 2px; overflow: hidden; margin-bottom: 12px;">
      <div style="background: #25D366; height: 100%; width: ${pct}%; transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);"></div>
    </div>
    <div style="font-size: 12px; color: rgba(255,255,255,0.4);">${Math.round(pct)}%</div>
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