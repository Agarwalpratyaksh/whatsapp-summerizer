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
    <div className="h-screen w-full bg-[#0A0A0A] text-white flex flex-col font-sans antialiased">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-white/[0.08]">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#25D366] rounded-lg flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C6.48 2 2 6.48 2 12C2 13.89 2.53 15.64 3.44 17.13L2 22L7.05 20.6C8.48 21.41 10.19 21.88 12 21.88C17.52 21.88 22 17.4 22 11.88C22 6.36 17.52 2 12 2Z" fill="white"/>
              </svg>
            </div>
            <div>
              <h1 className="font-semibold text-base tracking-tight">Summarizer</h1>
              <p className="text-[11px] text-white/40 -mt-0.5">WhatsApp Insights</p>
            </div>
          </div>
          {view !== "home" && (
            <button
              onClick={resetAll}
              className="text-[13px] text-white/50 hover:text-white transition-colors px-3 py-1.5 rounded-md hover:bg-white/[0.05]"
            >
              Home
            </button>
          )}
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="flex-shrink-0 bg-red-500/10 border-b border-red-500/20 px-6 py-3">
          <div className="flex items-start gap-2.5">
            <span className="text-red-400 text-sm mt-0.5">⚠</span>
            <p className="text-[13px] text-red-300 leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* VIEW 1: HOME */}
        {view === "home" && (
          <div className="h-full flex items-center justify-center p-6">
            <div className="w-full max-w-sm space-y-6">
              {/* Hero Card */}
              <div className="text-center space-y-4 pb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-white/[0.03] rounded-2xl border border-white/[0.08] mb-2">
                  <span className="text-4xl">💬</span>
                </div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight mb-2">
                    Capture Conversations
                  </h2>
                  <p className="text-[15px] text-white/50 leading-relaxed max-w-xs mx-auto">
                    Select any message range and extract AI-powered insights
                  </p>
                </div>
              </div>

              {/* Primary Action */}
              <button
                onClick={startSelection}
                className="w-full bg-[#25D366] hover:bg-[#20BD5A] text-white font-medium py-4 px-6 rounded-xl transition-colors text-[15px] shadow-lg shadow-[#25D366]/20"
              >
                Start Selection
              </button>

              {/* Instructions */}
              <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-5 space-y-4">
                <h3 className="text-[13px] font-medium text-white/60 uppercase tracking-wider">
                  How it Works
                </h3>
                <div className="space-y-3.5">
                  {[
                    "Click 'Start Selection' button",
                    "Click the first message you want",
                    "Scroll and click the last message",
                    "Get your AI summary instantly"
                  ].map((text, i) => (
                    <div key={i} className="flex gap-3.5 items-start">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-white/[0.06] flex items-center justify-center mt-0.5">
                        <span className="text-[11px] font-medium text-white/70">{i + 1}</span>
                      </div>
                      <span className="text-[14px] text-white/70 leading-relaxed pt-px">{text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Info Card */}
              <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-4">
                <div className="flex gap-3">
                  <span className="text-lg flex-shrink-0">⚡</span>
                  <div className="space-y-1">
                    <p className="text-[13px] font-medium text-white/90">
                      Real-time Capture
                    </p>
                    <p className="text-[13px] text-white/50 leading-relaxed">
                      Messages are captured as you scroll, perfect for long conversations
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: SELECTING */}
        {view === "selecting" && (
          <div className="h-full flex items-center justify-center p-6">
            <div className="text-center space-y-8 max-w-xs">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-white/[0.03] rounded-2xl border border-white/[0.08]">
                <span className="text-5xl animate-bounce">👆</span>
              </div>

              <div className="space-y-3">
                <h3 className="text-xl font-semibold">Selection Active</h3>
                <div className="bg-[#25D366]/10 border border-[#25D366]/20 px-6 py-3.5 rounded-xl">
                  <p className="text-[14px] text-[#25D366]">{status}</p>
                </div>
              </div>

              <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-4">
                <p className="text-[13px] text-white/60 leading-relaxed">
                  <span className="text-white/90 font-medium">Tip:</span> A live counter will show captured messages as you scroll
                </p>
              </div>

              <button
                onClick={cancelSelection}
                className="text-[13px] text-white/50 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* VIEW 3: PREVIEW */}
        {view === "preview" && (
          <div className="h-full flex flex-col p-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex-shrink-0 mb-4 flex justify-between items-start">
              <div>
                <h2 className="text-lg font-semibold mb-1">Review Messages</h2>
                <p className="text-[13px] text-white/50">
                  {messageCount} messages captured
                </p>
              </div>
              <button
                onClick={() => copyToClipboard(selectedMessages)}
                className="text-[13px] bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] px-4 py-2 rounded-lg transition-colors"
              >
                Copy
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 min-h-0 mb-4">
              <textarea
                ref={textareaRef}
                value={selectedMessages}
                readOnly
                className="w-full h-full bg-black/40 border border-white/[0.08] text-[13px] leading-[1.6] font-mono p-4 rounded-xl text-white/90 resize-none focus:outline-none focus:border-white/20 transition-colors"
                style={{ 
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}
                placeholder="Messages will appear here..."
              />
            </div>

            {/* Actions */}
            <div className="flex-shrink-0 flex gap-3">
              <button
                onClick={resetAll}
                className="flex-1 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] py-3.5 rounded-xl text-[14px] font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSummarize}
                disabled={loading}
                className="flex-[2] bg-[#25D366] hover:bg-[#20BD5A] disabled:bg-white/[0.05] disabled:text-white/30 text-white font-medium py-3.5 rounded-xl transition-colors text-[14px] disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Analyzing...
                  </span>
                ) : (
                  "Generate Summary"
                )}
              </button>
            </div>
          </div>
        )}

        {/* VIEW 4: SUMMARY */}
        {view === "summary" && (
          <div className="h-full flex flex-col p-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex-shrink-0 mb-4 flex justify-between items-start">
              <div>
                <h2 className="text-lg font-semibold mb-1">Summary</h2>
                <p className="text-[13px] text-white/50">AI-generated insights</p>
              </div>
              <button
                onClick={() => copyToClipboard(summary)}
                className="text-[13px] bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] px-4 py-2 rounded-lg transition-colors"
              >
                Copy
              </button>
            </div>

            {/* Summary Content */}
            <div className="flex-1 min-h-0 overflow-y-auto bg-white/[0.02] border border-white/[0.08] rounded-xl p-6 mb-4">
              <div className="prose prose-invert prose-sm max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-[14px] leading-[1.7] text-white/80">
                  {summary}
                </pre>
              </div>
            </div>

            {/* Actions */}
            <div className="flex-shrink-0 flex gap-3">
              <button
                onClick={() => setView("preview")}
                className="flex-1 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] py-3.5 rounded-xl text-[14px] font-medium transition-colors"
              >
                ← Messages
              </button>
              <button
                onClick={resetAll}
                className="flex-1 bg-[#25D366] hover:bg-[#20BD5A] text-white font-medium py-3.5 rounded-xl transition-colors text-[14px]"
              >
                New Summary
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Status Toast */}
      {status && view !== "selecting" && (
        <div className="fixed bottom-6 right-6 bg-[#1A1A1A] border border-white/[0.12] px-5 py-3 rounded-xl shadow-2xl text-[13px] animate-fade-in backdrop-blur-xl">
          {status}
        </div>
      )}
    </div>
  );
}

export default App;