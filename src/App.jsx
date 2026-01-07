import React, { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "YOUR_GEMINI_API_KEY_HERE"; 
const genAI = new GoogleGenerativeAI(API_KEY);

function App() {
  const [view, setView] = useState("home");
  const [status, setStatus] = useState("");
  const [selectedMessages, setSelectedMessages] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [messageCount, setMessageCount] = useState(0);

  useEffect(() => {
    chrome.runtime.onMessage.addListener((request) => {
      if (request.action === "STATUS_UPDATE") {
        setStatus(request.text);
      }
      else if (request.action === "SELECTION_COMPLETE") {
        setSelectedMessages(request.data);
        
        // Count messages
        const lines = request.data.split('\n\n').filter(l => l.trim());
        setMessageCount(lines.length);
        
        if (request.data.startsWith("Error:")) {
          setStatus("⚠️ " + request.data);
          setView("selecting");
        } else {
          setStatus("✅ Messages captured successfully!");
          setView("preview");
        }
      }
    });
  }, []);

  const startSelection = async () => {
    setView("selecting");
    setStatus("🎯 Click the FIRST message you want to include");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: "ENABLE_SELECTION_MODE" });
  };

  const cancelSelection = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: "RESET_SELECTION" });
    setView("home");
    setStatus("");
  };

  const handleSummarize = async () => {
    setLoading(true);
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `You are a WhatsApp conversation summarizer. Analyze this conversation and provide:

1. **Main Topics**: What were the key subjects discussed?
2. **Key Decisions**: Any decisions made or agreements reached
3. **Action Items**: Tasks assigned or commitments made (with who if mentioned)
4. **Important Info**: Critical details, dates, or information shared

Keep it concise and well-organized.

Conversation:
${selectedMessages}`;

      const result = await model.generateContent(prompt);
      setSummary(result.response.text());
      setView("summary");
    } catch (error) {
      setSummary("❌ Error generating summary: " + error.message);
      setView("summary");
    }
    setLoading(false);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setStatus("✅ Copied to clipboard!");
    setTimeout(() => setStatus(""), 2000);
  };

  return (
    <div className="h-screen w-full bg-gradient-to-br from-slate-900 to-slate-800 text-slate-200 p-4 font-sans flex flex-col">
      {/* Header */}
      <div className="mb-4 border-b border-slate-700 pb-3 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-xl text-green-400 flex items-center gap-2">
            <span>💬</span> WA Summarizer
          </h1>
          <p className="text-xs text-slate-500 mt-1">Smart conversation insights</p>
        </div>
        {view !== "home" && (
          <button 
            onClick={() => setView("home")}
            className="text-xs text-slate-400 hover:text-white transition"
          >
            ← Back
          </button>
        )}
      </div>

      {/* VIEW 1: HOME */}
      {view === "home" && (
        <div className="flex flex-col gap-4 mt-4">
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl">
            <div className="text-center mb-4">
              <div className="text-5xl mb-3">📱</div>
              <h2 className="text-lg font-bold text-white mb-2">
                Summarize Any Conversation
              </h2>
              <p className="text-sm text-slate-400">
                Select start and end messages, we'll do the rest
              </p>
            </div>
            
            <button 
              onClick={startSelection}
              className="w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold py-4 rounded-lg shadow-lg transition transform hover:scale-105 active:scale-95"
            >
              🎯 Start Selection
            </button>
            
            {/* Debug button - TEMPORARY */}
            {/* Remove this in production
            <button 
              onClick={async () => {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                const response = await chrome.tabs.sendMessage(tab.id, { action: "DEBUG_CONTAINER" });
                alert(JSON.stringify(response, null, 2));
              }}
              className="w-full mt-2 bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 py-2 rounded transition"
            >
              🔍 Debug: Find Container
            </button>
            */}
          </div>

          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
            <h3 className="text-xs font-bold text-slate-400 mb-2">HOW IT WORKS:</h3>
            <ol className="text-xs text-slate-400 space-y-2">
              <li className="flex gap-2">
                <span className="text-green-400 font-bold">1.</span>
                <span>Click "Start Selection" button</span>
              </li>
              <li className="flex gap-2">
                <span className="text-green-400 font-bold">2.</span>
                <span>Click the first message you want</span>
              </li>
              <li className="flex gap-2">
                <span className="text-green-400 font-bold">3.</span>
                <span>Scroll down OR use our "Smart Jump" button</span>
              </li>
              <li className="flex gap-2">
                <span className="text-green-400 font-bold">4.</span>
                <span>Click the last message - Done!</span>
              </li>
            </ol>
          </div>

          <div className="bg-green-900/20 border border-green-600/30 p-3 rounded-lg">
            <div className="flex gap-2 items-start">
              <span className="text-green-400 text-lg">⚡</span>
              <div className="flex-1">
                <p className="text-xs text-green-300 font-semibold mb-1">Smart Capture Technology</p>
                <p className="text-xs text-slate-400">
                  Messages are captured in real-time as you scroll. Use our Smart Jump button to zip to the end while capturing everything!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: SELECTING */}
      {view === "selecting" && (
        <div className="flex flex-col items-center justify-center flex-1 space-y-6">
          <div className="relative">
            <div className="text-6xl animate-bounce">👆</div>
            <div className="absolute -top-2 -right-2 w-4 h-4 bg-green-500 rounded-full animate-ping"></div>
          </div>
          
          <div className="text-center">
            <div className="font-bold text-xl text-white mb-2">Selection Active</div>
            <div className="bg-slate-800 px-6 py-3 rounded-lg text-sm text-green-400 border border-green-500/30 shadow-lg max-w-xs">
              {status}
            </div>
          </div>

          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 max-w-xs">
            <p className="text-xs text-slate-400 text-center">
              <span className="text-yellow-400 font-bold">💡 Pro tip:</span> After clicking start, you'll see a live counter and a "Smart Jump" button that captures everything while scrolling!
            </p>
          </div>

          <button 
            onClick={cancelSelection}
            className="text-sm text-red-400 hover:text-red-300 underline transition"
          >
            Cancel Selection
          </button>
        </div>
      )}

      {/* VIEW 3: PREVIEW */}
      {view === "preview" && (
        <div className="flex flex-col h-full">
          <div className="mb-3 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-white">Review Messages</h2>
              <p className="text-xs text-slate-400">
                Captured <span className="text-green-400 font-bold">{messageCount}</span> messages
              </p>
            </div>
            <button
              onClick={() => copyToClipboard(selectedMessages)}
              className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded transition"
            >
              📋 Copy
            </button>
          </div>

          <textarea 
            value={selectedMessages}
            readOnly
            className="flex-1 bg-black/50 text-xs font-mono p-3 rounded-lg border border-slate-700 mb-3 text-green-300 resize-none"
            placeholder="Messages will appear here..."
          />

          <div className="flex gap-2">
            <button 
              onClick={cancelSelection} 
              className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-lg text-sm font-bold transition"
            >
              Cancel
            </button>
            <button 
              onClick={handleSummarize} 
              disabled={loading}
              className="flex-[2] bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 disabled:from-slate-600 disabled:to-slate-600 text-white font-bold py-3 rounded-lg shadow-lg transition transform hover:scale-105 active:scale-95 disabled:transform-none"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⚙️</span> Analyzing...
                </span>
              ) : (
                "✨ Generate Summary"
              )}
            </button>
          </div>
        </div>
      )}

      {/* VIEW 4: SUMMARY */}
      {view === "summary" && (
        <div className="flex flex-col h-full">
          <div className="mb-3 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-white">Summary</h2>
              <p className="text-xs text-slate-400">AI-generated insights</p>
            </div>
            <button
              onClick={() => copyToClipboard(summary)}
              className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded transition"
            >
              📋 Copy
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-800 p-4 rounded-lg border border-slate-700 mb-3">
            <div className="prose prose-invert prose-sm max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-sm text-slate-200 leading-relaxed">
                {summary}
              </pre>
            </div>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={() => setView("preview")} 
              className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-lg text-sm font-bold transition"
            >
              ← View Messages
            </button>
            <button 
              onClick={() => {
                setView("home");
                setSelectedMessages("");
                setSummary("");
                setMessageCount(0);
              }} 
              className="flex-1 bg-green-600 hover:bg-green-500 py-3 rounded-lg text-sm font-bold transition"
            >
              New Summary
            </button>
          </div>
        </div>
      )}

      {/* Status Toast */}
      {status && view !== "selecting" && (
        <div className="fixed bottom-4 right-4 bg-slate-800 border border-slate-700 px-4 py-2 rounded-lg shadow-xl text-sm animate-fade-in">
          {status}
        </div>
      )}
    </div>
  );
}

export default App;