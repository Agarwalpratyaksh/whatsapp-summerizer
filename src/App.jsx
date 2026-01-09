import React, { useState, useEffect, useRef } from 'react';

// Note: Replace with your actual Gemini API key
const API_KEY = "YOUR_GEMINI_API_KEY_HERE";

function App() {
  const [view, setView] = useState("home");
  const [status, setStatus] = useState("");
  const [selectedMessages, setSelectedMessages] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [error, setError] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    // Listen for messages from content script
    const handleMessage = (request) => {
      if (request.action === "STATUS_UPDATE") {
        setStatus(request.text);
        setError("");
      }
      else if (request.action === "SELECTION_COMPLETE") {
        const data = request.data;
        
        if (data.startsWith("Error:")) {
          setError(data);
          setStatus("");
          setView("home");
          setTimeout(() => setError(""), 5000);
        } else {
          setSelectedMessages(data);
          
          // Count messages (lines with timestamps)
          const lines = data.split('\n').filter(l => l.includes('[') && l.includes(']'));
          setMessageCount(lines.length);
          
          setStatus("✅ Capture complete!");
          setView("preview");
          setError("");
        }
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(handleMessage);
      return () => chrome.runtime.onMessage.removeListener(handleMessage);
    }
  }, []);

  const startSelection = async () => {
    try {
      setView("selecting");
      setStatus("🎯 Click the FIRST message");
      setError("");
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes("web.whatsapp.com")) {
        setError("⚠️ Please open WhatsApp Web first");
        setView("home");
        return;
      }
      
      await chrome.tabs.sendMessage(tab.id, { action: "ENABLE_SELECTION_MODE" });
    } catch (err) {
      setError("❌ Failed to start: " + err.message);
      setView("home");
    }
  };

  const cancelSelection = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id, { action: "RESET_SELECTION" });
    } catch (err) {
      console.error("Cancel error:", err);
    }
    setView("home");
    setStatus("");
    setError("");
  };

  const handleSummarize = async () => {
    if (!API_KEY || API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
      setError("⚠️ Please add your Gemini API key in App.jsx");
      return;
    }

    setLoading(true);
    setError("");
    
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Analyze this WhatsApp conversation and provide a concise summary:

**Format your response as:**

📌 **Main Topics**
[List 2-3 key discussion topics]

✅ **Key Decisions**
[Any decisions or agreements made]

📋 **Action Items**
[Tasks or commitments, with assignee if mentioned]

💡 **Important Info**
[Critical dates, numbers, or information]

Keep it brief and organized. Use emojis where appropriate.

**Conversation:**
${selectedMessages}`
              }]
            }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1000,
            }
          })
        }
      );

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message || "API Error");
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "No summary generated";
      setSummary(text);
      setView("summary");
    } catch (error) {
      console.error("Summary error:", error);
      setError("❌ " + error.message);
      setSummary("Failed to generate summary. Please check your API key and try again.");
      setView("summary");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setStatus("✅ Copied!");
    setTimeout(() => setStatus(""), 2000);
  };

  const resetAll = () => {
    setView("home");
    setSelectedMessages("");
    setSummary("");
    setMessageCount(0);
    setStatus("");
    setError("");
  };

  return (
    <div className="h-screen w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
        <div className="p-4 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-xl text-green-400 flex items-center gap-2">
              <span className="text-2xl">💬</span> WA Summarizer
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Smart conversation insights</p>
          </div>
          {view !== "home" && (
            <button
              onClick={resetAll}
              className="text-xs text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-md hover:bg-slate-800"
            >
              ← Home
            </button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex-shrink-0 bg-red-900/20 border-y border-red-600/30 px-4 py-3 animate-fade-in">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* VIEW 1: HOME */}
        {view === "home" && (
          <div className="max-w-md mx-auto space-y-4">
            <div className="bg-slate-800/50 backdrop-blur-sm p-8 rounded-2xl border border-slate-700/50 shadow-2xl">
              <div className="text-center mb-6">
                <div className="text-6xl mb-4">📱</div>
                <h2 className="text-xl font-bold text-white mb-2">
                  Summarize Conversations
                </h2>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Select any message range and get AI-powered insights instantly
                </p>
              </div>

              <button
                onClick={startSelection}
                className="w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold py-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] active:scale-98"
              >
                🎯 Start Selection
              </button>
            </div>

            <div className="bg-slate-800/30 backdrop-blur-sm p-5 rounded-xl border border-slate-700/30">
              <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
                <span>📖</span> HOW IT WORKS
              </h3>
              <div className="space-y-3">
                {[
                  { num: "1", text: "Click 'Start Selection'" },
                  { num: "2", text: "Click your first message" },
                  { num: "3", text: "Scroll to your last message" },
                  { num: "4", text: "Click it - Done!" }
                ].map(step => (
                  <div key={step.num} className="flex gap-3 items-start">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600/20 text-green-400 flex items-center justify-center text-xs font-bold">
                      {step.num}
                    </div>
                    <span className="text-sm text-slate-300 leading-relaxed">{step.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-green-900/10 border border-green-600/20 p-4 rounded-xl">
              <div className="flex gap-3">
                <span className="text-green-400 text-xl flex-shrink-0">⚡</span>
                <div>
                  <p className="text-xs text-green-300 font-semibold mb-1">
                    Real-time Capture
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Messages are captured as you scroll. Perfect for long conversations!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: SELECTING */}
        {view === "selecting" && (
          <div className="flex flex-col items-center justify-center h-full space-y-8">
            <div className="relative">
              <div className="text-7xl animate-bounce">👆</div>
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full animate-ping"></div>
            </div>

            <div className="text-center max-w-xs">
              <div className="font-bold text-2xl text-white mb-3">Selection Active</div>
              <div className="bg-slate-800/80 backdrop-blur-sm px-6 py-4 rounded-xl text-sm text-green-400 border border-green-500/30 shadow-xl">
                {status}
              </div>
            </div>

            <div className="bg-slate-800/30 backdrop-blur-sm p-5 rounded-xl border border-slate-700/30 max-w-sm">
              <p className="text-xs text-slate-400 text-center leading-relaxed">
                <span className="text-yellow-400 font-bold">💡 Tip:</span> After clicking start, you'll see a live counter tracking captured messages as you scroll!
              </p>
            </div>

            <button
              onClick={cancelSelection}
              className="text-sm text-red-400 hover:text-red-300 underline transition-colors"
            >
              Cancel Selection
            </button>
          </div>
        )}

        {/* VIEW 3: PREVIEW */}
        {view === "preview" && (
          <div className="h-full flex flex-col max-w-4xl mx-auto">
            <div className="flex-shrink-0 mb-4 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-white">Review Messages</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Captured <span className="text-green-400 font-bold">{messageCount}</span> messages
                </p>
              </div>
              <button
                onClick={() => copyToClipboard(selectedMessages)}
                className="text-xs bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                📋 Copy
              </button>
            </div>

            <textarea
              ref={textareaRef}
              value={selectedMessages}
              readOnly
              className="flex-1 bg-black/50 text-xs font-mono p-4 rounded-xl border border-slate-700/50 mb-4 text-green-300 resize-none focus:outline-none focus:border-green-500/50 transition-colors"
              placeholder="Messages will appear here..."
            />

            <div className="flex-shrink-0 flex gap-3">
              <button
                onClick={resetAll}
                className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-xl text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSummarize}
                disabled={loading}
                className="flex-[2] bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 disabled:from-slate-700 disabled:to-slate-600 text-white font-bold py-3 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] active:scale-98 disabled:transform-none disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⚙️</span> Analyzing...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    ✨ Generate Summary
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* VIEW 4: SUMMARY */}
        {view === "summary" && (
          <div className="h-full flex flex-col max-w-4xl mx-auto">
            <div className="flex-shrink-0 mb-4 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-white">Summary</h2>
                <p className="text-xs text-slate-400 mt-1">AI-generated insights</p>
              </div>
              <button
                onClick={() => copyToClipboard(summary)}
                className="text-xs bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                📋 Copy
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-800/50 backdrop-blur-sm p-6 rounded-xl border border-slate-700/50 mb-4">
              <div className="prose prose-invert prose-sm max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm text-slate-200 leading-relaxed">
                  {summary}
                </pre>
              </div>
            </div>

            <div className="flex-shrink-0 flex gap-3">
              <button
                onClick={() => setView("preview")}
                className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-xl text-sm font-semibold transition-colors"
              >
                ← View Messages
              </button>
              <button
                onClick={resetAll}
                className="flex-1 bg-green-600 hover:bg-green-500 py-3 rounded-xl text-sm font-bold transition-colors"
              >
                ✨ New Summary
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Status Toast */}
      {status && view !== "selecting" && (
        <div className="fixed bottom-4 right-4 bg-slate-800 backdrop-blur-sm border border-slate-700 px-5 py-3 rounded-xl shadow-2xl text-sm animate-fade-in z-50">
          {status}
        </div>
      )}
    </div>
  );
}

export default App;