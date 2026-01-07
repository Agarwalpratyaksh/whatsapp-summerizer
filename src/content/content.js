// src/content/content.js
console.log("WA Scraper: Stable Version Loaded");

let selectionMode = false;
let captureActive = false;
let startMessageData = null;
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
  capturedMessagesMap.clear();
  document.body.style.cursor = "crosshair";

  injectStyles();
  hideWhatsAppJumpButton(); 

  document.addEventListener("mouseover", handleHover);
  document.addEventListener("click", handleClick, { capture: true });

  console.log("✓ Selection mode enabled");
}

function disableSelectionMode() {
  console.log("🛑 Cleaning up...");
  selectionMode = false;
  captureActive = false;
  startMessageData = null;
  capturedMessagesMap.clear();
  document.body.style.cursor = "default";

  stopContinuousCapture(); // Ensure interval is cleared

  showWhatsAppJumpButton(); 

  document.getElementById("wa-selection-style")?.remove();
  document.getElementById("wa-capture-overlay")?.remove();
  document.getElementById("wa-progress-bar")?.remove();

  document.removeEventListener("mouseover", handleHover);
  document.removeEventListener("click", handleClick, { capture: true });

  document
    .querySelectorAll(".wa-select-start, .wa-select-end, .wa-select-hover")
    .forEach((el) => {
      el.classList.remove(
        "wa-select-start",
        "wa-select-end",
        "wa-select-hover"
      );
    });
}

// --- CORE CAPTURE LOGIC (REVERTED TO STABLE INTERVAL) ---

function startContinuousCapture() {
  // RELIABLE: Use setInterval instead of MutationObserver
  // This ensures we capture exactly what is on screen every 100ms
  if (captureInterval) clearInterval(captureInterval);
  
  captureInterval = setInterval(() => {
    if (captureActive) {
      captureCurrentViewport();
    }
  }, 100);

  console.log("✓ Manual Capture Active (Polling Mode)");
}

function stopContinuousCapture() {
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }
}

function captureCurrentViewport() {
  // We use the safer, non-cached selector to ensure we find rows even if DOM changes
  const rows = getChatRows();
  
  rows.forEach((row) => {
    const msgData = extractMessageData(row);
    if (!capturedMessagesMap.has(msgData.id)) {
      capturedMessagesMap.set(msgData.id, msgData);
    }
  });
}

// --- INTELLIGENT SCROLL (REVERSE SEARCH) ---

async function performIntelligentCapture(startData, endData) {
  console.log("🚀 Starting Reverse-Search...");
  showProgressOverlay("Syncing conversation...", 0);

  const container = getChatContainer();
  if (!container) return sendError("Chat container not found");

  // 1. Capture where we are right now (End)
  captureCurrentViewport();

  // 2. Check if we already have the Start
  if (capturedMessagesMap.has(startData.id)) {
    finishCapture(startData, endData);
    return;
  }

  console.log("🔍 Start message not in view. Scrolling UP...");
  
  // 3. Scroll UP Loop
  const startTime = Date.now();
  
  while (true) {
    // Scroll up by ~500px
    container.scrollTop -= 500;
    
    // WAIT: Give WhatsApp time to render (Critical for "Middle" messages)
    await sleep(250);
    
    // FORCE CAPTURE: Don't wait for an observer, just grab what's there
    captureCurrentViewport();

    // Check exit conditions
    if (capturedMessagesMap.has(startData.id)) {
      console.log("✅ Found start message!");
      break;
    }
    if (container.scrollTop === 0) {
      console.log("⚠️ Reached top of chat");
      break;
    }
    if (Date.now() - startTime > 60000) { // 1 min timeout
      console.log("⚠️ Timeout");
      break;
    }

    // UI Feedback
    const progress = Math.min(90, (capturedMessagesMap.size / 50) * 10);
    showProgressOverlay(`Reading history... (${capturedMessagesMap.size} msgs)`, progress);
  }

  // 4. One small scroll down to catch any edge cases
  container.scrollTop += 200;
  await sleep(200);
  captureCurrentViewport();

  finishCapture(startData, endData);
}

// --- DATA PROCESSING (SANITIZER) ---

function finishCapture(startData, endData) {
  showProgressOverlay("Finalizing...", 95);
  setTimeout(() => extractRange(startData, endData), 500);
}

function extractRange(startData, endData) {
  console.log("📦 Processing...");
  
  let allMessages = Array.from(capturedMessagesMap.values());

  // 1. Remove empty junk
  allMessages = allMessages.filter((m) => m.text && m.text.trim().length > 0);

  // 2. SORT (Critical: Timestamps might be out of order due to scrolling up)
  // We use a simple strategy: Find Start and End in the array.
  // Since we rely on Map insertion order, let's verify indices.
  
  let startIndex = allMessages.findIndex((m) => m.id === startData.id);
  let endIndex = allMessages.findIndex((m) => m.id === endData.id);

  // Fuzzy Fallback
  if (startIndex === -1) startIndex = allMessages.findIndex(m => m.text === startData.text);
  if (endIndex === -1) endIndex = allMessages.findIndex(m => m.text === endData.text);

  // If Start appears AFTER End in our list (because we scrolled UP), reverse the list
  if (startIndex > -1 && endIndex > -1 && startIndex > endIndex) {
    console.log("🔄 Reversing capture order...");
    allMessages.reverse();
    // Re-calculate indices after reverse
    startIndex = allMessages.findIndex((m) => m.id === startData.id);
    endIndex = allMessages.findIndex((m) => m.id === endData.id);
    
    // Fuzzy fallback again if needed
    if (startIndex === -1) startIndex = allMessages.findIndex(m => m.text === startData.text);
    if (endIndex === -1) endIndex = allMessages.findIndex(m => m.text === endData.text);
  }

  // Slice
  const finalStart = startIndex === -1 ? 0 : startIndex;
  const finalEnd = endIndex === -1 ? allMessages.length - 1 : endIndex;
  
  const selectedSlice = allMessages.slice(finalStart, finalEnd + 1);

  // 3. DEDUPLICATE (The "Ghost" Fix)
  const finalOutput = [];
  let lastMsg = null;

  selectedSlice.forEach((msg) => {
    if (!lastMsg) {
      finalOutput.push(msg);
      lastMsg = msg;
      return;
    }
    // If text AND time are identical, it's a render ghost -> skip it
    if (msg.text === lastMsg.text && msg.timestamp === lastMsg.timestamp) return;
    
    finalOutput.push(msg);
    lastMsg = msg;
  });

  // 4. FORMAT FOR AI (Token Economy)
  const result = finalOutput.map((msg, i) => {
    const prev = finalOutput[i-1];
    
    // Simplify display if sender is same as previous
    if (prev && prev.sender === msg.sender) {
        return `> ${msg.text}`;
    }
    return `\n[${msg.timestamp}] ${msg.sender}: ${msg.text}`;
  }).join("\n");

  console.log(`✅ Final count: ${finalOutput.length} messages`);

  chrome.runtime.sendMessage({
    action: "SELECTION_COMPLETE",
    data: result,
  });

  disableSelectionMode();
}

// --- DOM HELPERS ---

function extractMessageData(row) {
  const copyable = row.querySelector(".copyable-text");
  const dateStr = copyable ? copyable.getAttribute("data-pre-plain-text") : "";
  const timeEl = row.querySelector('span[data-testid="msg-time"]') || row.querySelector("._amig");

  let text = "";
  let type = "system";
  let sender = "System";
  let timestamp = timeEl ? timeEl.innerText.trim() : "";

  if (copyable) {
    const match = dateStr.match(/\[(.*?)\].*?:\s*/);
    const metaTimestamp = match ? match[1] : timestamp;
    sender = dateStr.replace(`[${metaTimestamp}] `, "").replace(":", "").trim();
    timestamp = metaTimestamp;

    const textSpan = copyable.querySelector("span.selectable-text");
    text = textSpan ? textSpan.innerText.trim() : copyable.innerText.replace(dateStr, "").trim();
    type = "text";
  } else {
    // Handle Media/System
    const img = row.querySelector("img");
    if (img && img.src.includes("sticker")) {
      text = "[Sticker]";
      type = "media";
    } else if (img || row.querySelector('span[data-testid="media-play"]')) {
      text = "[Media/Photo]";
      type = "media";
    } else if (row.innerText.includes("message was deleted")) {
      text = "[Deleted]";
      type = "system";
    } else {
      text = row.innerText.replace(/\d{1,2}:\d{2}\s?[ap]m/i, "").trim();
      type = "system";
    }
  }

  // Robust ID: WhatsApp ID OR Content Hash
  const dataId = row.getAttribute("data-id");
  const safeText = text.substring(0, 15).replace(/[^a-zA-Z0-9]/g, "");
  // Combine timestamp+sender+text to make a unique key for "ghost" deduplication
  const uniqueId = dataId || `gen_${timestamp}_${sender}_${safeText}`;

  return {
    id: uniqueId,
    timestamp,
    sender,
    text,
    preview: `${sender}: ${text.substring(0, 20)}...`,
    rawText: `[${timestamp}] ${sender}: ${text}`,
    type,
  };
}

function getChatContainer() {
  // Reliable check for the scrollable container
  const selectors = ['div[data-tab="6"]', 'div[data-tab="7"]', 'div[aria-label*="essage list"]'];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.scrollHeight > el.clientHeight) return el;
  }
  // Fallback: Find the biggest scrollable div
  const allDivs = document.querySelectorAll('div');
  for (const div of allDivs) {
      if(div.scrollHeight > div.clientHeight && div.innerText.includes(":")) {
          return div;
      }
  }
  return null;
}

function getChatRows() {
  // Global query (safest)
  const rows = Array.from(document.querySelectorAll('div[role="row"]'));
  const leftBoundary = window.innerWidth * 0.3; // Ignore sidebar
  
  return rows.filter(row => {
    const rect = row.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.left > leftBoundary;
  });
}

// --- UTILS ---

function injectStyles() {
  const style = document.createElement("style");
  style.id = "wa-selection-style";
  style.innerHTML = `
    .wa-select-hover { outline: 2px dashed #3b82f6 !important; background: rgba(59, 130, 246, 0.1) !important; cursor: pointer; }
    .wa-select-start { outline: 3px solid #22c55e !important; background: rgba(34, 197, 94, 0.2) !important; }
    .wa-select-end { outline: 3px solid #ef4444 !important; background: rgba(239, 68, 68, 0.2) !important; }
    .wa-hide-jump [aria-label="Scroll to bottom"], .wa-hide-jump [data-testid="scroll-to-bottom-button"] { display: none !important; }
    .wa-capture-overlay { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); background: rgba(0,0,0,0.9); color: white; padding: 30px; border-radius: 12px; z-index: 10000; text-align: center; }
  `;
  document.head.appendChild(style);
}

function hideWhatsAppJumpButton() { document.body.classList.add("wa-hide-jump"); }
function showWhatsAppJumpButton() { document.body.classList.remove("wa-hide-jump"); }

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
  e.preventDefault(); e.stopPropagation();

  if (!captureActive) {
    // START
    startMessageData = extractMessageData(target);
    target.classList.add("wa-select-start");
    captureActive = true;
    capturedMessagesMap.set(startMessageData.id, startMessageData);
    
    startContinuousCapture(); // Start Interval
    showInstructions();
    chrome.runtime.sendMessage({ action: "STATUS_UPDATE", text: "Start set! Scroll to end message." });
  } else {
    // END
    const endMessageData = extractMessageData(target);
    target.classList.add("wa-select-end");
    stopContinuousCapture();
    performIntelligentCapture(startMessageData, endMessageData);
  }
}

function showInstructions() {
    // Simple overlay logic
    const div = document.createElement('div');
    div.id = 'wa-capture-overlay';
    div.className = 'wa-capture-overlay';
    div.innerText = "Scroll to the END message and click it.";
    document.body.appendChild(div);
}

function showProgressOverlay(text, pct) {
    const el = document.getElementById('wa-capture-overlay');
    if(el) el.innerText = `${text} ${Math.round(pct)}%`;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function sendError(msg) {
    chrome.runtime.sendMessage({ action: "SELECTION_COMPLETE", data: "Error: " + msg });
    disableSelectionMode();
}