import React, { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "YOUR_GEMINI_API_KEY_HERE"; 
const genAI = new GoogleGenerativeAI(API_KEY);

function App() {
  const [view, setView] = useState("home"); // 'home', 'selecting', 'preview', 'summary'
  const [status, setStatus] = useState("");
  const [selectedMessages, setSelectedMessages] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);

  // Listen for messages from content.js (When user clicks in WhatsApp)
  useEffect(() => {
    chrome.runtime.onMessage.addListener((request) => {
      if (request.action === "STATUS_UPDATE") {
        setStatus(request.text);
      }
      else if (request.action === "SELECTION_COMPLETE") {
        setSelectedMessages(request.data);
        setStatus("Messages captured!");
        setView("preview");
      }
    });
  }, []);

  const startSelection = async () => {
    setView("selecting");
    setStatus("Click the FIRST message in the chat.");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: "ENABLE_SELECTION_MODE" });
  };

  const handleSummarize = async () => {
    setLoading(true);
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `Summarize this WhatsApp conversation cleanly. Focus on decisions and action items:\n\n${selectedMessages}`;
      const result = await model.generateContent(prompt);
      setSummary(result.response.text());
      setView("summary");
    } catch (error) {
      setSummary("Error: " + error.message);
      setView("summary");
    }
    setLoading(false);
  };

  return (
    <div className="h-screen w-full bg-slate-900 text-slate-200 p-4 font-sans flex flex-col">
      <div className="mb-4 border-b border-slate-700 pb-2">
        <h1 className="font-bold text-green-400">WA Summarizer</h1>
      </div>

      {/* VIEW 1: HOME */}
      {view === "home" && (
        <div className="flex flex-col gap-4 mt-4">
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-600 text-center">
            <p className="text-sm text-slate-300 mb-3">
              Want to summarize a specific conversation?
            </p>
            <button 
              onClick={startSelection}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded shadow-lg transition transform active:scale-95"
            >
              👆 Pick Start & End Messages
            </button>
          </div>
          <p className="text-xs text-center text-slate-500">
            Click the button, then click the first and last message in the chat window.
          </p>
        </div>
      )}

      {/* VIEW 2: SELECTING STATE (User is clicking on WhatsApp) */}
      {view === "selecting" && (
        <div className="flex flex-col items-center justify-center h-64 space-y-4 animate-pulse">
          <div className="text-4xl">🖱️</div>
          <div className="text-center font-bold text-green-400 text-lg">Selection Mode Active</div>
          <div className="bg-slate-800 px-4 py-2 rounded text-sm text-white border border-green-500">
            {status}
          </div>
          <button 
             onClick={() => {
               // Cancel logic if needed
               window.location.reload();
             }}
             className="text-xs text-red-400 underline"
          >
            Cancel
          </button>
        </div>
      )}

      {/* VIEW 3: PREVIEW (Review captured text) */}
      {view === "preview" && (
        <div className="flex flex-col h-full">
          <div className="text-xs text-slate-400 mb-1 flex justify-between">
            <span>Review captured messages:</span>
            <span className="text-green-400 font-bold">{selectedMessages.split('\n').length} lines</span>
          </div>
          <textarea 
            value={selectedMessages}
            readOnly
            className="flex-1 bg-black text-xs font-mono p-2 rounded border border-slate-700 mb-3 text-green-300 resize-none opacity-80"
          />
          <div className="flex gap-2">
            <button onClick={() => setView("home")} className="flex-1 bg-slate-700 py-2 rounded text-xs font-bold">Cancel</button>
            <button 
              onClick={handleSummarize} 
              disabled={loading}
              className="flex-[2] bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded shadow"
            >
              {loading ? "Generating..." : "✨ Summarize"}
            </button>
          </div>
        </div>
      )}

      {/* VIEW 4: SUMMARY */}
      {view === "summary" && (
        <div className="flex flex-col h-full">
          <div className="prose prose-invert prose-sm overflow-y-auto flex-1 bg-slate-800 p-3 rounded border border-slate-700 mb-3">
             <pre className="whitespace-pre-wrap font-sans text-sm">{summary}</pre>
          </div>
          <button onClick={() => setView("home")} className="w-full bg-slate-700 py-2 rounded text-xs font-bold">Start New Summary</button>
        </div>
      )}
    </div>
  );
}

export default App;