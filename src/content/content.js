// src/content/content.js
console.log("WA Scraper: Robust Selection Mode Loaded");

let selectionMode = false;
let startSignature = null; // We store the TEXT signature, not the HTML node

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
  startSignature = null;
  document.body.style.cursor = "crosshair";
  
  const style = document.createElement('style');
  style.id = "wa-selection-style";
  style.innerHTML = `
    .wa-select-hover { border: 2px dashed #3b82f6 !important; background: rgba(59, 130, 246, 0.1) !important; cursor: pointer !important; }
    .wa-select-start { border: 3px solid #22c55e !important; background: rgba(34, 197, 94, 0.1) !important; }
    .wa-select-end   { border: 3px solid #ef4444 !important; background: rgba(239, 68, 68, 0.1) !important; }
  `;
  document.head.appendChild(style);

  document.addEventListener('mouseover', handleHover);
  document.addEventListener('click', handleClick, { capture: true });
}

function disableSelectionMode() {
  selectionMode = false;
  startSignature = null;
  document.body.style.cursor = "default";
  
  const style = document.getElementById("wa-selection-style");
  if (style) style.remove();
  
  document.removeEventListener('mouseover', handleHover);
  document.removeEventListener('click', handleClick, { capture: true });
  
  document.querySelectorAll('.wa-select-start, .wa-select-end').forEach(el => {
    el.classList.remove('wa-select-start', 'wa-select-end');
  });
}

function handleHover(e) {
  if (!selectionMode) return;
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

  if (!startSignature) {
    // --- STEP 1: SET START POINT ---
    // We create a unique signature for this message (Time + Text)
    // This allows us to find it again even if the DOM changes slightly
    startSignature = getMessageSignature(target);
    target.classList.add('wa-select-start');
    
    chrome.runtime.sendMessage({ action: "STATUS_UPDATE", text: "Start set! Scroll & click the last message." });
  
  } else {
    // --- STEP 2: SET END POINT ---
    target.classList.add('wa-select-end');
    
    // We pass the End Node directly, but look for Start by signature
    const result = extractMessagesRobust(startSignature, target);
    
    chrome.runtime.sendMessage({ 
      action: "SELECTION_COMPLETE", 
      data: result 
    });
    
    disableSelectionMode();
  }
}

// Helper to create a unique ID for a message based on its content
function getMessageSignature(row) {
    return getMessageText(row); // Use the text itself as the ID
}

// REPLACE THIS FUNCTION IN SRC/CONTENT/CONTENT.JS

function extractMessagesRobust(savedStartSig, endNode) {
  // 1. Get ALL rows in the DOM
  const rawRows = Array.from(document.querySelectorAll('div[role="row"]'));

  // 2. FILTER: Keep only rows on the RIGHT side (The Chat Area)
  // The sidebar usually takes up the first 30% to 40% of the screen.
  // We strictly ignore anything starting on the left.
  const screenWidth = window.innerWidth;
  const safeZone = screenWidth * 0.30; // 30% width threshold

  const chatRows = rawRows.filter(row => {
    const rect = row.getBoundingClientRect();
    // Must be visible AND on the right side
    return rect.width > 0 && rect.height > 0 && rect.left > safeZone;
  });

  // 3. Find the End Message Index within this CLEAN list
  let endIndex = chatRows.indexOf(endNode);
  
  if (endIndex === -1) {
    // Edge case: If the user resized the window or something weird happened
    return "Error: Could not locate the end message in the chat area.";
  }

  // 4. Find Start Index by signature
  let startIndex = chatRows.findIndex(row => getMessageSignature(row) === savedStartSig);

  // 5. Handle "Deleted Top Message" (Virtual Scrolling)
  if (startIndex === -1) {
      console.warn("Start message unloaded. Grabbing from top of VISIBLE chat.");
      startIndex = 0; // Now safe! 0 is the top visible message, not a sidebar contact.
  }

  // 6. Ensure order
  if (startIndex > endIndex) {
    [startIndex, endIndex] = [endIndex, startIndex];
  }

  // 7. Extract
  const selectedRows = chatRows.slice(startIndex, endIndex + 1);
  
  let collectedMessages = [];
  selectedRows.forEach(row => {
    const text = getMessageText(row);
    if (text) collectedMessages.push(text);
  });

  return collectedMessages.join("\n\n");
}

function getMessageText(row) {
  // 1. Text Search
  const copyable = row.querySelector('.copyable-text');
  if (copyable) {
    const meta = copyable.getAttribute('data-pre-plain-text') || "";
    const textSpan = copyable.querySelector('span[dir="ltr"]') || 
                     copyable.querySelector('span[dir="auto"]') ||
                     copyable.querySelector('span.selectable-text');
    let body = textSpan ? textSpan.innerText : copyable.innerText;
    return `[${meta.trim()}] ${body}`;
  } 

  // 2. Sticker/Image Search
  const img = row.querySelector('img');
  if (img) {
      const src = img.src || "";
      if (src.includes("sticker")) return "[Sticker sent]";
      return "[Image/Media sent]";
  }

  // 3. Fallback
  let rawText = row.innerText.replace(/\n/g, ' ').trim();
  if (rawText.length < 30 && /\d{1,2}:\d{2}/.test(rawText)) return null; 
  return rawText;
}