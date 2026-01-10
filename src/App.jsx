import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';

function App() {
  // --- STATE ---
  const [apiKey, setApiKey] = useState("");
  const [view, setView] = useState("loading"); // loading | setup | home | settings | selecting | preview | chat
  
  // App Logic State
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState("");
  const [messageCount, setMessageCount] = useState(0);
  const [chatHistory, setChatHistory] = useState([]); 
  const [inputMessage, setInputMessage] = useState("");
  
  const chatEndRef = useRef(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    const storedKey = localStorage.getItem("wa_gemini_key");
    const savedMsg = localStorage.getItem("wa_context");
    const savedChat = localStorage.getItem("wa_chat");

    if (storedKey) {
      setApiKey(storedKey);
      if (savedMsg) {
        setSelectedMessages(savedMsg);
        setMessageCount(savedMsg.split('\n').filter(l => l.includes('[') && l.includes(']')).length);
        if (savedChat) {
          try {
            setChatHistory(JSON.parse(savedChat));
            setView("chat");
          } catch (e) { setView("home"); }
        } else {
          setView("home");
        }
      } else {
        setView("home");
      }
    } else {
      setView("setup");
    }
  }, []);

  // --- PERSISTENCE ---
  useEffect(() => {
    if (apiKey) localStorage.setItem("wa_gemini_key", apiKey);
    if (selectedMessages) localStorage.setItem("wa_context", selectedMessages);
    if (chatHistory.length > 0) localStorage.setItem("wa_chat", JSON.stringify(chatHistory));
  }, [apiKey, selectedMessages, chatHistory]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, loading]);

  // --- CHROME LISTENER ---
  useEffect(() => {
    const handleMessage = (request) => {
      if (request.action === "STATUS_UPDATE") {
        setStatus(request.text);
        setError("");
      } else if (request.action === "SELECTION_COMPLETE") {
        const data = request.data;
        if (data.startsWith("Error:")) {
          setError(data);
          setView("home");
        } else {
          setSelectedMessages(data);
          setMessageCount(data.split('\n').filter(l => l.includes('[') && l.includes(']')).length);
          setStatus("✅ Capture complete!");
          setView("preview");
        }
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(handleMessage);
      return () => chrome.runtime.onMessage.removeListener(handleMessage);
    }
  }, []);

  // --- ACTIONS ---
  
  const handleSaveKey = (key) => {
    if (!key.trim().startsWith("AIza")) {
      setError("Invalid Key. It usually starts with 'AIza'.");
      return;
    }
    setApiKey(key.trim());
    localStorage.setItem("wa_gemini_key", key.trim());
    setView("home");
    setError("");
  };

  const handleRemoveKey = () => {
    localStorage.removeItem("wa_gemini_key");
    setApiKey("");
    resetAll();
    setView("setup");
  };

  const startSelection = async () => {
    try {
      setView("selecting");
      setStatus("🎯 Click the FIRST message");
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.url.includes("web.whatsapp.com")) throw new Error("Open WhatsApp Web first");
      await chrome.tabs.sendMessage(tab.id, { action: "ENABLE_SELECTION_MODE" });
    } catch (err) {
      setError("❌ " + err.message);
      setView("home");
    }
  };

  const cancelSelection = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id, { action: "RESET_SELECTION" });
    } catch (e) {}
    setView("home");
    setStatus("");
  };

  const resetAll = () => {
    setSelectedMessages("");
    setChatHistory([]);
    setMessageCount(0);
    setStatus("");
    setError("");
    localStorage.removeItem("wa_context");
    localStorage.removeItem("wa_chat");
    if (apiKey) setView("home");
  };

  const clearChatOnly = () => {
    setChatHistory([]);
    localStorage.removeItem("wa_chat");
  };

  const goBack = () => {
    if (view === "chat") setView("preview");
    else if (view === "preview") setView("home");
    else if (view === "settings") setView("home");
  };

  // --- AI ENGINE (FIXED) ---

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;
    const userQ = inputMessage;
    setInputMessage(""); 
    await generateAIResponse(userQ);
  };

  const generateAIResponse = async (query) => {
    if (!apiKey) { setError("⚠️ Missing API Key"); return; }
    
    const newHistory = [...chatHistory, { role: "user", text: query }];
    setChatHistory(newHistory);
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey });
      
      const conversationHistory = chatHistory.slice(-8).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));

      const systemInstruction = `
You are "Whatsapp group chat summerizer", an expert WhatsApp Conversation Analyst.
CONTEXT:
"""
${selectedMessages}
"""
Guidelines: 
1. Be Concise. Use bullet points for lists.
2. Use **Bold** for important names or keys.
3. Be Friendly . Use Emojis.
`;

      const response = await ai.models.generateContentStream({
        model: 'gemini-flash-lite-latest', 
        config: {
           systemInstruction: { parts: [{ text: systemInstruction }] },
           generationConfig: { maxOutputTokens: 1000 }
        },
        contents: [
            ...conversationHistory, 
            { role: 'user', parts: [{ text: query }] }
        ],
      });

      let fullResponse = "";
      setChatHistory(prev => [...prev, { role: "model", text: "..." }]);

      for await (const chunk of response) {
        // --- FIX IS HERE: chunk.text is a PROPERTY, not a function ---
        const chunkText = chunk.text || ""; 
        fullResponse += chunkText;
        
        setChatHistory(prev => {
           const newArr = [...prev];
           newArr[newArr.length - 1] = { role: "model", text: fullResponse };
           return newArr;
        });
      }

    } catch (err) {
      console.error(err);
      setError("❌ AI Error: " + (err.message || "Connection failed"));
      setChatHistory(prev => prev.slice(0, -1)); 
    } finally {
      setLoading(false);
    }
  };

  // --- COMPONENTS ---

  // Custom Markdown Renderer
  const MarkdownRenderer = ({ text }) => {
    if (!text) return null;
    const lines = text.split('\n');
    return (
      <div className="space-y-1">
        {lines.map((line, i) => {
          // Bullet Points
          if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
             const content = line.trim().substring(2);
             return (
               <div key={i} className="flex gap-2 items-start ml-1">
                 <span className="text-[#25D366] mt-1.5 text-[6px]">●</span>
                 <span className="flex-1" dangerouslySetInnerHTML={{ __html: formatBold(content) }} />
               </div>
             );
          }
          // Headers
          if (line.trim().startsWith('## ')) {
             return <h3 key={i} className="text-[#25D366] font-bold mt-2 mb-1" dangerouslySetInnerHTML={{ __html: formatBold(line.substring(3)) }} />;
          }
          // Standard Text
          return <p key={i} className="min-h-[1em]" dangerouslySetInnerHTML={{ __html: formatBold(line) }} />;
        })}
      </div>
    );
  };

  const formatBold = (text) => {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // --- VIEWS ---

  if (view === "loading") return <div className="h-screen bg-[#0A0A0A] flex items-center justify-center text-white/20">Loading...</div>;

  // SETUP VIEW
  if (view === "setup") {
    return (
      <div className="h-screen w-full bg-[#0A0A0A] text-white flex flex-col items-center justify-center p-8 text-center animate-fade-in">
        <div className="w-16 h-16 bg-[#25D366] rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(37,211,102,0.4)]">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM11 7H13V9H11V7ZM11 11H13V17H11V11Z"/></svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">Welcome to WA Insights</h1>
        <p className="text-white/50 text-[13px] mb-8 max-w-xs">Enter your Gemini API Key to start.</p>
        <div className="w-full max-w-xs space-y-4">
          <input 
            type="password" 
            placeholder="Paste Key (AIza...)" 
            className="w-full bg-[#1A1A1A] border border-white/[0.1] rounded-xl px-4 py-3 text-[13px] text-white focus:outline-none focus:border-[#25D366]"
            onChange={(e) => setApiKey(e.target.value)} 
          />
          <button onClick={() => handleSaveKey(apiKey)} className="w-full bg-[#25D366] hover:bg-[#20BD5A] text-black font-semibold py-3 rounded-xl text-[14px]">Save & Continue</button>
          <a href="https://aistudio.google.com/app/apikey" target="_blank" className="block text-[12px] text-white/30 hover:text-white/60 underline">Get free API Key ↗</a>
        </div>
      </div>
    );
  }

  // SETTINGS VIEW
  if (view === "settings") {
    return (
      <div className="h-screen w-full bg-[#0A0A0A] text-white flex flex-col p-6 animate-fade-in">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={goBack} className="w-8 h-8 bg-white/[0.05] rounded-full flex items-center justify-center hover:bg-white/[0.1]">←</button>
          <h2 className="text-lg font-semibold">Settings</h2>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5 space-y-4">
          <div>
            <label className="text-[12px] font-medium text-white/60 mb-1 block">API Key</label>
            <input type="password" value={apiKey} readOnly className="w-full bg-black/40 border border-white/[0.1] rounded-lg px-3 py-2 text-[13px] text-white/50 font-mono" />
          </div>
          <button onClick={handleRemoveKey} className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 py-2.5 rounded-lg text-[13px]">Remove Key</button>
        </div>
      </div>
    );
  }

  // MAIN UI
  return (
    <div className="h-screen w-full bg-[#0A0A0A] text-white flex flex-col font-sans antialiased overflow-hidden">
      
      {/* HEADER */}
      <header className="flex-shrink-0 border-b border-white/[0.08] bg-[#0A0A0A] z-10">
        <div className="px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {view !== "home" && view !== "selecting" ? (
               <button onClick={goBack} className="w-8 h-8 -ml-2 rounded-full hover:bg-white/[0.05] flex items-center justify-center text-white/80 transition-colors">
                 <span className="text-xl pb-1">←</span>
               </button>
            ) : (
               <div className="w-8 h-8 bg-[#25D366] rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(37,211,102,0.3)]">
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
               </div>
            )}
            <div>
              <h1 className="font-semibold text-sm tracking-wide">WA Insights</h1>
              {messageCount > 0 && <p className="text-[10px] text-white/40">{messageCount} msgs</p>}
            </div>
          </div>
          <div className="flex gap-2 items-center">
             {view !== "home" && (
              <button onClick={resetAll} className="text-[11px] bg-white/[0.05] hover:bg-white/[0.1] px-3 py-1.5 rounded-md transition-colors">
                New Chat
              </button>
            )}
            <button onClick={() => setView("settings")} className="w-8 h-8 rounded-full hover:bg-white/[0.05] flex items-center justify-center text-white/60 hover:text-white transition-colors">⚙️</button>
          </div>
        </div>
      </header>

      {/* ERROR BANNER */}
      {error && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 flex justify-between items-center">
          <span className="text-[12px] text-red-300">{error}</span>
          <button onClick={() => setError("")} className="text-red-300">×</button>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto relative scroll-smooth">
        
        {view === "home" && (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6 animate-fade-in">
            <div className="w-20 h-20 bg-white/[0.03] rounded-2xl border border-white/[0.08] flex items-center justify-center mb-2">
              <span className="text-4xl">✨</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2">Ready to Analyze</h2>
              <p className="text-[13px] text-white/40 max-w-[260px] mx-auto leading-relaxed">
                Open a chat, select messages, and uncover insights with your personal AI.
              </p>
            </div>
            <button onClick={startSelection} className="w-full max-w-xs bg-[#25D366] hover:bg-[#20BD5A] text-black font-semibold py-3.5 rounded-xl transition-all shadow-[0_4px_20px_rgba(37,211,102,0.2)] hover:shadow-[0_4px_25px_rgba(37,211,102,0.3)] active:scale-95 text-[14px]">
              Select Messages
            </button>
            {localStorage.getItem("wa_context") && (
              <button onClick={() => setView("chat")} className="text-[12px] text-white/40 hover:text-white transition-colors underline decoration-white/20 underline-offset-4">
                Resume previous session
              </button>
            )}
          </div>
        )}

        {view === "selecting" && (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center animate-pulse">
            <span className="text-5xl mb-6">👆</span>
            <h3 className="text-lg font-medium text-[#25D366] mb-2">Selection Mode Active</h3>
            <p className="text-[13px] text-white/50 mb-8 max-w-xs">{status}</p>
            <button onClick={cancelSelection} className="text-[12px] bg-white/[0.05] px-4 py-2 rounded-lg text-white/60 hover:bg-white/[0.1]">Cancel</button>
          </div>
        )}

        {view === "preview" && (
          <div className="h-full flex flex-col p-6 animate-fade-in">
            <h2 className="text-lg font-semibold mb-4">Preview Capture</h2>
            <textarea 
              readOnly 
              value={selectedMessages} 
              className="flex-1 bg-black/40 border border-white/[0.08] rounded-xl p-4 text-[12px] font-mono text-white/70 resize-none focus:outline-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={resetAll} className="flex-1 py-3 rounded-xl border border-white/[0.1] text-[13px] hover:bg-white/[0.05]">Discard</button>
              <button 
                onClick={() => {
                   setView("chat");
                   if(chatHistory.length === 0) generateAIResponse("Summarize this conversation in 3 bullet points.");
                }} 
                className="flex-[2] bg-[#25D366] text-black font-semibold py-3 rounded-xl text-[13px] hover:bg-[#20BD5A]"
              >
                Start Analysis
              </button>
            </div>
          </div>
        )}

        {view === "chat" && (
          <div className="min-h-full flex flex-col justify-end p-4 gap-4 pb-4">
            {chatHistory.length === 0 && (
               <div className="flex-1 flex flex-col items-center justify-center text-white/30 space-y-4">
                <span className="text-3xl opacity-50">🤖</span>
                <p className="text-[13px]">Ask me anything about the chat!</p>
              </div>
            )}
            {chatHistory.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                <div className={`max-w-[90%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-[#25D366] text-black font-medium rounded-tr-none' : 'bg-[#1F1F1F] text-white/90 border border-white/[0.05] rounded-tl-none'}`}>
                  {msg.role === 'model' ? (
                     <MarkdownRenderer text={msg.text} />
                  ) : (
                     <div className="whitespace-pre-wrap font-sans">{msg.text}</div>
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        )}
      </main>

      {/* INPUT AREA */}
      {view === "chat" && (
        <div className="flex-shrink-0 p-4 bg-[#0A0A0A] border-t border-white/[0.08]">
          <div className="relative flex items-end gap-2 bg-[#1A1A1A] border border-white/[0.1] rounded-xl p-1.5 focus-within:border-white/[0.2]">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a follow-up..."
              className="w-full bg-transparent text-[13px] text-white placeholder-white/30 px-3 py-2.5 max-h-24 min-h-[44px] resize-none focus:outline-none scrollbar-hide"
              rows={1}
            />
            <button
              onClick={handleSendMessage}
              disabled={loading || !inputMessage.trim()}
              className="flex-shrink-0 w-8 h-8 bg-[#25D366] disabled:bg-white/[0.1] disabled:text-white/20 text-black rounded-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95 mb-0.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;