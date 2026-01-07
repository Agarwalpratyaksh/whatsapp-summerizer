// src/content/content.js - FORCED RENDER CAPTURE SYSTEM
console.log("WA Scraper: Forced Render System Loaded");

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
  hideWhatsAppJumpButton(); // Hide WhatsApp's button to prevent skipping

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

  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }

  showWhatsAppJumpButton(); // Restore WhatsApp's button

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

  console.log("✓ Cleanup complete");
}

function injectStyles() {
  const style = document.createElement("style");
  style.id = "wa-selection-style";
  style.innerHTML = `
    .wa-select-hover { 
      outline: 3px dashed #3b82f6 !important;
      outline-offset: -3px;
      background: rgba(59, 130, 246, 0.08) !important; 
      cursor: pointer !important; 
    }
    .wa-select-start { 
      outline: 4px solid #22c55e !important;
      outline-offset: -4px;
      background: rgba(34, 197, 94, 0.15) !important; 
      position: relative;
    }
    .wa-select-start::after {
      content: "START ✓";
      position: absolute;
      top: -30px;
      left: 10px;
      background: #22c55e;
      color: white;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: bold;
      z-index: 999999;
    }
    .wa-select-end { 
      outline: 4px solid #ef4444 !important;
      outline-offset: -4px;
      background: rgba(239, 68, 68, 0.15) !important;
      position: relative;
    }
    .wa-select-end::after {
      content: "END ✓";
      position: absolute;
      top: -30px;
      left: 10px;
      background: #ef4444;
      color: white;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: bold;
      z-index: 999999;
    }
    .wa-capture-overlay {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.98);
      color: white;
      padding: 40px 50px;
      border-radius: 20px;
      z-index: 9999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      box-shadow: 0 20px 60px rgba(0,0,0,0.8);
      border: 2px solid rgba(34, 197, 94, 0.3);
      min-width: 400px;
      text-align: center;
      backdrop-filter: blur(10px);
    }
    .wa-progress-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 6px;
      background: rgba(0, 0, 0, 0.9);
      z-index: 9999999;
      border-top: 1px solid rgba(34, 197, 94, 0.3);
    }
    .wa-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #22c55e, #10b981);
      transition: width 0.3s ease;
      box-shadow: 0 0 20px rgba(34, 197, 94, 0.6);
    }
    /* Hide WhatsApp's jump button during capture */
    .wa-hide-jump [data-testid="jump-to-unread"] {
      display: none !important;
    }
      /* AGGRESSIVELY HIDE ALL WA SCROLL BUTTONS */
   .wa-hide-jump [aria-label="Scroll to bottom"],
   .wa-hide-jump span[data-icon="down"],
   .wa-hide-jump [data-testid="jump-to-unread"], 
   .wa-hide-jump [data-testid="scroll-to-bottom-button"] {
      display: none !important;
      opacity: 0 !important;
      pointer-events: none !important;
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
    // STEP 1: Start
    startMessageData = extractMessageData(target);
    target.classList.add("wa-select-start");
    captureActive = true;

    console.log("✅ START SELECTED:", startMessageData.preview);

    // Capture the start message
    capturedMessagesMap.set(startMessageData.id, startMessageData);

    // Start continuous capture
    startContinuousCapture();

    // Show instructions
    showInstructions();

    chrome.runtime.sendMessage({
      action: "STATUS_UPDATE",
      text: "Start captured! Now scroll down slowly or wait for auto-capture.",
    });
  } else {
    // STEP 2: End - trigger intelligent capture
    const endMessageData = extractMessageData(target);
    target.classList.add("wa-select-end");

    console.log("✅ END SELECTED:", endMessageData.preview);

    stopContinuousCapture();

    // Start the intelligent scrolling capture
    performIntelligentCapture(startMessageData, endMessageData);
  }
}

function extractMessageData(row) {
  // 1. Extract raw info first
  const copyable = row.querySelector(".copyable-text");
  const dateStr = copyable ? copyable.getAttribute("data-pre-plain-text") : "";
  const timeEl =
    row.querySelector('span[data-testid="msg-time"]') ||
    row.querySelector("._amig"); // Fallback selectors

  // Extract content
  let text = "";
  let type = "system";
  let sender = "System";
  let timestamp = timeEl ? timeEl.innerText.trim() : "";

  if (copyable) {
    // Normal Text Message
    const match = dateStr.match(/\[(.*?)\].*?:\s*/);
    const metaTimestamp = match ? match[1] : timestamp;
    sender = dateStr.replace(`[${metaTimestamp}] `, "").replace(":", "").trim();
    timestamp = metaTimestamp;

    const textSpan = copyable.querySelector("span.selectable-text");
    text = textSpan
      ? textSpan.innerText.trim()
      : copyable.innerText.replace(dateStr, "").trim();
    type = "text";
  } else {
    // Media / System / Deleted
    const img = row.querySelector("img");
    const isDeleted = row.innerText.includes("message was deleted");

    if (img && img.src.includes("sticker")) {
      text = "[Sticker]";
      type = "media";
    } else if (img || row.querySelector('span[data-testid="media-play"]')) {
      text = "[Media/Photo]";
      type = "media";
    } else if (isDeleted) {
      text = "[This message was deleted]";
      type = "system";
    } else {
      // Pure System message (e.g. "You changed group name")
      text = row.innerText.replace(/\d{1,2}:\d{2}\s?[ap]m/i, "").trim(); // Remove time from text
      type = "system";
    }
  }

  // 2. ROBUST ID GENERATION
  // WhatsApp's data-id is best, but if missing, we construct a "Content Fingerprint"
  // formatting: timestamp_sender_first15charsOfText
  const dataId = row.getAttribute("data-id");
  const safeText = text.substring(0, 20).replace(/[^a-zA-Z0-9]/g, "");

  // If no data-id, we rely on the specific combination of Time + Sender + Text content
  // This effectively debounces duplicates because the same message will generate the same ID
  const uniqueId =
    dataId ||
    `gen_${timestamp.replace(/\s/g, "")}_${sender.replace(
      /\s/g,
      ""
    )}_${safeText}`;

  return {
    id: uniqueId,
    timestamp,
    sender,
    text,
    preview: `${timestamp} ${sender}: ${text.substring(0, 30)}...`,
    rawText:
      type === "text"
        ? `[${timestamp}] ${sender}: ${text}`
        : `[${timestamp}] ${sender}: ${text}`,
    type,
  };
}
// Continuous capture while user scrolls manually
function startContinuousCapture() {
  captureInterval = setInterval(() => {
    if (captureActive) {
      captureCurrentViewport();
    }
  }, 100);

  console.log("✓ Continuous capture started (capturing every 100ms)");
}

function stopContinuousCapture() {
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }
}

function captureCurrentViewport() {
  const rows = getChatRows();

  rows.forEach((row) => {
    const msgData = extractMessageData(row);
    if (!capturedMessagesMap.has(msgData.id)) {
      capturedMessagesMap.set(msgData.id, msgData);
    }
  });
}

function showInstructions() {
  const overlay = document.createElement("div");
  overlay.id = "wa-capture-overlay";
  overlay.className = "wa-capture-overlay";
  overlay.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 20px;">⏳</div>
    <div style="font-size: 20px; font-weight: 700; margin-bottom: 16px; color: #22c55e;">
      AUTO-CAPTURE STARTING...
    </div>
    <div style="font-size: 14px; color: #aaa; line-height: 1.6;">
      We'll automatically scroll and capture all messages.<br/>
      <strong>Please don't touch anything!</strong>
    </div>
    <div style="margin-top: 24px; font-size: 32px; font-weight: 700;" id="wa-message-counter">
      ${capturedMessagesMap.size}
    </div>
    <div style="font-size: 12px; color: #888; margin-top: 4px;">messages captured</div>
  `;
  document.body.appendChild(overlay);

  // Update counter
  setInterval(() => {
    const counter = document.getElementById("wa-message-counter");
    if (counter) {
      counter.textContent = capturedMessagesMap.size;
    }
  }, 200);
}

// OPTIMIZED INTELLIGENT CAPTURE: "Reverse Search" Strategy
async function performIntelligentCapture(startData, endData) {
  console.log("🚀 Starting Reverse-Search Capture...");
  showProgressOverlay("Syncing conversation...", 0);

  const container = getChatContainer();
  if (!container) return sendError("Chat container not found");

  // 1. Capture the End (Current View)
  captureCurrentViewport();

  // 2. If Start is already here, we are done
  if (capturedMessagesMap.has(startData.id)) {
    finishCapture(startData, endData);
    return;
  }

  console.log("🔍 Start not found. Scrolling UP to find it...");

  // 3. Scroll UP until we find the start message
  let notFoundCount = 0;
  const startTime = Date.now();

  while (true) {
    // Scroll UP by ~400px
    container.scrollTop -= 450;

    // WAIT longer for rendering (Reduces "Ghost" rows)
    await sleep(200);
    captureCurrentViewport();

    // Check if we found the start
    if (capturedMessagesMap.has(startData.id)) {
      console.log("✅ Found start message!");
      break;
    }

    // Safety checks
    if (container.scrollTop === 0) {
      console.log("⚠️ Reached top of chat history");
      break;
    }
    if (Date.now() - startTime > 60000) {
      // 1 min timeout
      console.log("⚠️ Timeout looking for start message");
      break;
    }

    // Progress UI
    const progress = Math.min(90, (capturedMessagesMap.size / 50) * 10);
    showProgressOverlay(
      `Tracing history... (${capturedMessagesMap.size} found)`,
      progress
    );
  }

  // 4. Verification pass (Scroll down slightly to catch bottom edge of overlap)
  container.scrollTop += 200;
  await sleep(150);
  captureCurrentViewport();

  finishCapture(startData, endData);
}


function finishCapture(startData, endData) {
  showProgressOverlay("Finalizing...", 95);
  setTimeout(() => extractRange(startData, endData), 500);
}

// src/content/content.js

function extractRange(startData, endData) {
  console.log("📦 Processing & Sanitizing...");

  // 1. Convert Map to Array
  let allMessages = Array.from(capturedMessagesMap.values());

  // 2. FILTER & SANITIZE (The Fix for your Log)
  // Remove items that have no text or are just empty brackets
  allMessages = allMessages.filter((m) => m.text && m.text.trim().length > 0);

  // 3. SORT CHRONOLOGICALLY
  // We rely on DOM order mostly, but since we scrolled up, map might be mixed.
  // Best bet is to trust the Map order (Insertion order) if we scrolled consistently,
  // BUT since we scrolled UP, the earlier messages were added LAST.
  // We need to reverse the array if we captured bottom-up.
  // However, simpler is to sort by standard timestamp parsing if possible.
  // For now, let's try a logic based on the 'id' timestamp if available,
  // but standardizing WA timestamps is hard.

  // ALGORITHM: Find Start and End index in the big soup
  // Since we have duplicates, we look for the *First occurrence* of Start
  // and the *Last occurrence* of End.

  let startIndex = allMessages.findIndex((m) => m.id === startData.id);
  let endIndex = allMessages.findIndex((m) => m.id === endData.id);

  // Fallback fuzzy search
  if (startIndex === -1)
    startIndex = allMessages.findIndex(
      (m) => m.text === startData.text && m.timestamp === startData.timestamp
    );
  if (endIndex === -1)
    endIndex = allMessages.findIndex(
      (m) => m.text === endData.text && m.timestamp === endData.timestamp
    );

  // Correction if indices are swapped (due to capture order)
  if (startIndex > -1 && endIndex > -1 && startIndex > endIndex) {
    // If start is after end, it implies our array is reversed (Bottom-to-Top capture)
    // So we reverse the array to make it Top-to-Bottom
    allMessages.reverse();
    startIndex = allMessages.length - 1 - startIndex;
    endIndex = allMessages.length - 1 - endIndex;
  }

  // Slice the relevant chunk
  let selectedSlice = [];
  if (startIndex === -1 || endIndex === -1) {
    // If fuzzy match failed, we just return the whole clean buffer
    // ensuring we sort by time roughly (this is hard without robust date parsing)
    selectedSlice = allMessages;
  } else {
    selectedSlice = allMessages.slice(startIndex, endIndex + 1);
  }

  // 4. STRICT DEDUPLICATION (The Final Polish)
  const finalOutput = [];
  let lastMsg = null;

  selectedSlice.forEach((msg) => {
    if (!lastMsg) {
      finalOutput.push(msg);
      lastMsg = msg;
      return;
    }

    // Check against previous message
    const isDuplicateText = msg.text === lastMsg.text;
    const isDuplicateTime = msg.timestamp === lastMsg.timestamp;
    const isSystemOrMedia = msg.type === "media" || msg.type === "system";

    // If it's a generic message (Media/System) and matches previous exactly, SKIP IT
    if (isSystemOrMedia && isDuplicateText && isDuplicateTime) {
      return; // Skip duplicate media/system noise
    }

    // If it's the exact same ID, skip (should be handled by Map, but safety first)
    if (msg.id === lastMsg.id) return;

    finalOutput.push(msg);
    lastMsg = msg;
  });

  const result = finalOutput.map((m) => m.rawText).join("\n\n");

  console.log(
    `✅ Cleaned up: ${allMessages.length} -> ${finalOutput.length} messages`
  );

  chrome.runtime.sendMessage({
    action: "SELECTION_COMPLETE",
    data: result,
  });

  disableSelectionMode();
}

// Helper to parse WA dates
function parseWhatsAppDate(dateStr, timeStr) {
  try {
    // Expected format: Date "12/5/2024", Time "10:30 PM"
    return new Date(`${dateStr} ${timeStr}`);
  } catch (e) {
    return null;
  }
}

function showProgressOverlay(message, percent) {
  let overlay = document.getElementById("wa-capture-overlay");
  if (overlay) {
    overlay.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 20px;">
        ${percent < 100 ? "⏳" : "✅"}
      </div>
      <div style="font-size: 18px; font-weight: 700; margin-bottom: 20px; color: #22c55e;">
        ${message}
      </div>
      <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden;">
        <div style="width: ${percent}%; height: 100%; background: linear-gradient(90deg, #22c55e, #10b981); transition: width 0.3s ease;"></div>
      </div>
      <div style="margin-top: 16px; font-size: 14px; color: #888;">${percent.toFixed(
        0
      )}%</div>
    `;
  }
}

function sendError(message) {
  chrome.runtime.sendMessage({
    action: "SELECTION_COMPLETE",
    data: `Error: ${message}`,
  });
  disableSelectionMode();
}

function getChatContainer() {
  const selectors = [
    'div[data-tab="6"]',
    'div[data-tab="7"]',
    'div[aria-label*="essage list"]',
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el && el.scrollHeight > el.clientHeight) {
      return el;
    }
  }

  // Heuristic
  const allDivs = Array.from(document.querySelectorAll("div"));
  for (const div of allDivs) {
    if (div.scrollHeight <= div.clientHeight) continue;
    const messageCount = div.querySelectorAll('div[role="row"]').length;
    if (messageCount < 5) continue;
    const rect = div.getBoundingClientRect();
    if (rect.left < window.innerWidth * 0.25) continue;
    if (rect.width < 300 || rect.height < 300) continue;
    return div;
  }

  return null;
}

function getChatRows() {
  const rawRows = Array.from(document.querySelectorAll('div[role="row"]'));
  const screenWidth = window.innerWidth;
  const leftBoundary = screenWidth * 0.3;

  return rawRows.filter((row) => {
    const rect = row.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    if (rect.left < leftBoundary) return false;
    return true;
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
