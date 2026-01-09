// src/content/content.js
console.log("WA Scraper: Debug Version Loaded");

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

  console.log("✅ Selection mode enabled");
}

function disableSelectionMode() {
  console.log("🛑 Cleaning up...");
  selectionMode = false;
  captureActive = false;
  startMessageData = null;
  capturedMessagesMap.clear();
  document.body.style.cursor = "default";

  stopContinuousCapture();

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

// --- CORE CAPTURE LOGIC ---

function startContinuousCapture() {
  if (captureInterval) clearInterval(captureInterval);
  
  captureInterval = setInterval(() => {
    if (captureActive) {
      captureCurrentViewport();
    }
  }, 100);

  console.log("✅ Continuous Capture Active");
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
  console.log(`📸 Capturing viewport: ${rows.length} rows visible`);
  
  rows.forEach((row) => {
    const msgData = extractMessageData(row);
    if (!capturedMessagesMap.has(msgData.id)) {
      capturedMessagesMap.set(msgData.id, msgData);
      console.log(`➕ Added message: ${msgData.preview}`);
    }
  });
  
  console.log(`📊 Total captured: ${capturedMessagesMap.size} messages`);
}

// --- SIMPLIFIED INTELLIGENT CAPTURE ---

async function performIntelligentCapture(startData, endData) {
  console.log("🚀 ========== STARTING CAPTURE ==========");
  console.log("Start message:", startData.preview);
  console.log("End message:", endData.preview);
  console.log("Messages in map:", capturedMessagesMap.size);
  
  showProgressOverlay("Checking messages...", 20);

  // CRITICAL: Make sure both are in the map
  if (!capturedMessagesMap.has(startData.id)) {
    console.log("⚠️ START not in map, adding it");
    capturedMessagesMap.set(startData.id, startData);
  }
  
  if (!capturedMessagesMap.has(endData.id)) {
    console.log("⚠️ END not in map, adding it");
    capturedMessagesMap.set(endData.id, endData);
  }

  // Do one final capture of current viewport
  showProgressOverlay("Capturing visible messages...", 40);
  await sleep(300);
  captureCurrentViewport();

  console.log(`✅ Total messages captured: ${capturedMessagesMap.size}`);
  
  // Check if we have both markers
  const hasStart = capturedMessagesMap.has(startData.id);
  const hasEnd = capturedMessagesMap.has(endData.id);
  
  console.log("Has START in map:", hasStart);
  console.log("Has END in map:", hasEnd);

  // If selection is small (both likely visible), just process immediately
  if (hasStart && hasEnd) {
    console.log("✅ Both messages found! Processing...");
    showProgressOverlay("Processing messages...", 70);
    await sleep(500);
    finishCapture(startData, endData);
    return;
  }

  // If we're missing one, try to find it
  const container = getChatContainer();
  if (!container) {
    console.error("❌ Container not found!");
    return sendError("Chat container not found");
  }

  showProgressOverlay("Searching for missing messages...", 50);

  // Quick scroll attempt to find missing message
  if (!hasStart) {
    console.log("🔍 Searching for START message...");
    await quickScrollSearch(container, startData, "up", 10);
  }
  
  if (!hasEnd) {
    console.log("🔍 Searching for END message...");
    await quickScrollSearch(container, endData, "down", 10);
  }

  console.log("✅ Search complete, processing...");
  finishCapture(startData, endData);
}

async function quickScrollSearch(container, targetData, direction, maxScrolls) {
  const scrollAmount = direction === "up" ? -300 : 300;
  
  for (let i = 0; i < maxScrolls; i++) {
    console.log(`Scroll attempt ${i + 1}/${maxScrolls} (${direction})`);
    
    const oldScroll = container.scrollTop;
    container.scrollTop += scrollAmount;
    await sleep(250);
    
    captureCurrentViewport();
    
    if (capturedMessagesMap.has(targetData.id)) {
      console.log(`✅ Found target after ${i + 1} scrolls!`);
      return true;
    }
    
    // Hit boundary
    if (container.scrollTop === oldScroll) {
      console.log(`⚠️ Hit ${direction === "up" ? "top" : "bottom"}`);
      break;
    }
  }
  
  return false;
}

// --- DATA PROCESSING ---

function finishCapture(startData, endData) {
  console.log("🔄 Starting finishCapture");
  showProgressOverlay("Finalizing...", 85);
  setTimeout(() => extractRange(startData, endData), 300);
}

function extractRange(startData, endData) {
  console.log("📦 ========== EXTRACTING RANGE ==========");
  console.log("Total in map:", capturedMessagesMap.size);
  
  let allMessages = Array.from(capturedMessagesMap.values());
  console.log("Array length:", allMessages.length);

  // 1. Filter empty
  allMessages = allMessages.filter((m) => m.text && m.text.trim().length > 0);
  console.log("After filtering empty:", allMessages.length);

  if (allMessages.length === 0) {
    console.error("❌ No messages after filtering!");
    return sendError("No messages captured");
  }

  // 2. Find indices
  let startIndex = allMessages.findIndex((m) => m.id === startData.id);
  let endIndex = allMessages.findIndex((m) => m.id === endData.id);

  console.log("Initial indices - Start:", startIndex, "End:", endIndex);

  // Fallback: text matching
  if (startIndex === -1) {
    console.log("🔍 Using text fallback for START");
    startIndex = allMessages.findIndex(m => 
      m.text.includes(startData.text.substring(0, 20)) || 
      startData.text.includes(m.text.substring(0, 20))
    );
    console.log("Text fallback START index:", startIndex);
  }
  
  if (endIndex === -1) {
    console.log("🔍 Using text fallback for END");
    endIndex = allMessages.findIndex(m => 
      m.text.includes(endData.text.substring(0, 20)) || 
      endData.text.includes(m.text.substring(0, 20))
    );
    console.log("Text fallback END index:", endIndex);
  }

  // If still not found, use extremes
  if (startIndex === -1) {
    console.log("⚠️ START not found, using 0");
    startIndex = 0;
  }
  if (endIndex === -1) {
    console.log("⚠️ END not found, using last");
    endIndex = allMessages.length - 1;
  }

  // 3. Handle reversed order
  if (startIndex > endIndex) {
    console.log("🔄 Indices reversed, swapping");
    [startIndex, endIndex] = [endIndex, startIndex];
  }

  console.log("Final indices - Start:", startIndex, "End:", endIndex);

  // 4. Extract slice
  const selectedSlice = allMessages.slice(startIndex, endIndex + 1);
  console.log("Slice length:", selectedSlice.length);

  if (selectedSlice.length === 0) {
    console.error("❌ Empty slice!");
    return sendError("Could not extract message range");
  }

  // 5. Deduplicate
  const finalOutput = [];
  const seen = new Set();

  selectedSlice.forEach((msg) => {
    const key = `${msg.timestamp}_${msg.sender}_${msg.text}`;
    if (!seen.has(key)) {
      seen.add(key);
      finalOutput.push(msg);
    }
  });

  console.log("After dedup:", finalOutput.length);

  // 6. Format
  const result = finalOutput.map((msg, i) => {
    const prev = finalOutput[i-1];
    
    if (prev && prev.sender === msg.sender) {
      return `> ${msg.text}`;
    }
    return `\n[${msg.timestamp}] ${msg.sender}: ${msg.text}`;
  }).join("\n");

  console.log("✅ ========== CAPTURE COMPLETE ==========");
  console.log("Final message count:", finalOutput.length);
  console.log("Output preview:", result.substring(0, 200));

  showProgressOverlay("Complete!", 100);

  setTimeout(() => {
    chrome.runtime.sendMessage({
      action: "SELECTION_COMPLETE",
      data: result,
    });
    disableSelectionMode();
  }, 500);
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

  const dataId = row.getAttribute("data-id");
  const safeText = text.substring(0, 15).replace(/[^a-zA-Z0-9]/g, "");
  const uniqueId = dataId || `gen_${timestamp}_${sender}_${safeText}`;

  return {
    id: uniqueId,
    timestamp,
    sender,
    text,
    preview: `${sender}: ${text.substring(0, 20)}...`,
    type,
  };
}

function getChatContainer() {
  console.log("🔍 Looking for chat container...");
  
  const selectors = [
    'div[data-tab="6"]', 
    'div[data-tab="7"]', 
    'div[aria-label*="essage list"]',
    'div[aria-label*="Message list"]'
  ];
  
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.scrollHeight > el.clientHeight) {
      console.log("✅ Found container with selector:", sel);
      console.log("Container scrollHeight:", el.scrollHeight, "clientHeight:", el.clientHeight);
      return el;
    }
  }
  
  console.log("⚠️ Using fallback container search");
  const allDivs = Array.from(document.querySelectorAll('div'));
  for (const div of allDivs) {
    if (div.scrollHeight > div.clientHeight && div.scrollHeight > 1000) {
      console.log("✅ Found container via fallback");
      return div;
    }
  }
  
  console.error("❌ Could not find chat container!");
  return null;
}

function getChatRows() {
  const rows = Array.from(document.querySelectorAll('div[role="row"]'));
  const leftBoundary = window.innerWidth * 0.3;
  
  const visibleRows = rows.filter(row => {
    const rect = row.getBoundingClientRect();
    return (
      rect.width > 0 && 
      rect.height > 0 && 
      rect.left > leftBoundary &&
      rect.top >= 0 &&
      rect.bottom <= window.innerHeight
    );
  });
  
  return visibleRows;
}

// --- UI HELPERS ---

function injectStyles() {
  const style = document.createElement("style");
  style.id = "wa-selection-style";
  style.innerHTML = `
    .wa-select-hover { outline: 2px dashed #3b82f6 !important; background: rgba(59, 130, 246, 0.1) !important; cursor: pointer; }
    .wa-select-start { outline: 3px solid #22c55e !important; background: rgba(34, 197, 94, 0.2) !important; }
    .wa-select-end { outline: 3px solid #ef4444 !important; background: rgba(239, 68, 68, 0.2) !important; }
    .wa-hide-jump [aria-label="Scroll to bottom"], .wa-hide-jump [data-testid="scroll-to-bottom-button"] { display: none !important; }
    .wa-capture-overlay { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); background: rgba(0,0,0,0.95); color: white; padding: 30px 40px; border-radius: 12px; z-index: 10000; text-align: center; min-width: 250px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
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
    // START SELECTION
    startMessageData = extractMessageData(target);
    console.log("✅ START CLICKED:", startMessageData);
    
    target.classList.add("wa-select-start");
    captureActive = true;
    
    // Add to map immediately
    capturedMessagesMap.set(startMessageData.id, startMessageData);
    
    startContinuousCapture();
    showInstructions();
    
    chrome.runtime.sendMessage({ 
      action: "STATUS_UPDATE", 
      text: "✅ Start set! Now click the END message." 
    });
  } else {
    // END SELECTION
    const endMessageData = extractMessageData(target);
    console.log("✅ END CLICKED:", endMessageData);
    
    target.classList.add("wa-select-end");
    stopContinuousCapture();
    
    // Add to map immediately
    capturedMessagesMap.set(endMessageData.id, endMessageData);
    
    console.log("📊 Messages captured during selection:", capturedMessagesMap.size);
    
    performIntelligentCapture(startMessageData, endMessageData);
  }
}

function showInstructions() {
  const div = document.createElement('div');
  div.id = 'wa-capture-overlay';
  div.className = 'wa-capture-overlay';
  div.innerHTML = `
    <div style="font-size: 20px; margin-bottom: 12px;">✅ Start Selected</div>
    <div style="font-size: 14px; color: #aaa;">Click the END message to complete</div>
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
    <div style="font-size: 16px; margin-bottom: 12px; font-weight: 600;">${text}</div>
    <div style="background: #333; height: 8px; border-radius: 4px; overflow: hidden; margin-top: 8px;">
      <div style="background: linear-gradient(90deg, #22c55e, #10b981); height: 100%; width: ${pct}%; transition: width 0.3s ease;"></div>
    </div>
    <div style="font-size: 12px; color: #888; margin-top: 8px;">${Math.round(pct)}%</div>
  `;
}

function sleep(ms) { 
  return new Promise(r => setTimeout(r, ms)); 
}

function sendError(msg) {
  console.error("❌ ERROR:", msg);
  chrome.runtime.sendMessage({ 
    action: "SELECTION_COMPLETE", 
    data: "Error: " + msg 
  });
  disableSelectionMode();
}