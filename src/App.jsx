import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';

function App() {
  // --- STATE ---
  const [apiKey, setApiKey] = useState("");
  const [view, setView] = useState("loading"); // loading | setup | home | settings | selecting | preview | chat
  
  // Logic State
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Active Session Data
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [selectedMessages, setSelectedMessages] = useState("");
  const [messageCount, setMessageCount] = useState(0);
  const [chatHistory, setChatHistory] = useState([]); 
  const [inputMessage, setInputMessage] = useState("");
  
  // History State
  const [sessions, setSessions] = useState([]);

  const chatEndRef = useRef(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    const storedKey = localStorage.getItem("wa_gemini_key");
    const storedSessions = localStorage.getItem("wa_sessions");

    if (storedKey) {
      setApiKey(storedKey);
      if (storedSessions) {
        try {
          const parsed = JSON.parse(storedSessions);
          setSessions(parsed);
        } catch (e) {
          console.error("Corrupt history", e);
        }
      }
      setView("home");
    } else {
      setView("setup");
    }
  }, []);

  // --- PERSISTENCE ---
  
  // Save API Key
  useEffect(() => {
    if (apiKey) localStorage.setItem("wa_gemini_key", apiKey);
  }, [apiKey]);

  // Auto-Save Current Session to History
  useEffect(() => {
    if (!currentSessionId || !selectedMessages) return;

    setSessions(prevSessions => {
      const existingIdx = prevSessions.findIndex(s => s.id === currentSessionId);
      const updatedSession = {
        id: currentSessionId,
        date: existingIdx > -1 ? prevSessions[existingIdx].date : Date.now(),
        preview: selectedMessages.substring(0, 50) + "...", // Short preview for list
        context: selectedMessages,
        history: chatHistory,
        count: messageCount
      };

      let newSessions;
      if (existingIdx > -1) {
        newSessions = [...prevSessions];
        newSessions[existingIdx] = updatedSession;
      } else {
        newSessions = [updatedSession, ...prevSessions];
      }

      localStorage.setItem("wa_sessions", JSON.stringify(newSessions));
      return newSessions;
    });
  }, [chatHistory, selectedMessages, currentSessionId, messageCount]);

  // Scroll to bottom
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
          // NEW CAPTURE FLOW
          setSelectedMessages(data);
          setMessageCount(data.split('\n').filter(l => l.includes('[') && l.includes(']')).length);
          setStatus("✅ Capture complete!");
          setView("preview"); // Go to preview first
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
    setSessions([]);
    localStorage.removeItem("wa_sessions");
    setView("setup");
  };

  const startSelection = async () => {
    try {
      // Clear current session data for a new capture
      setCurrentSessionId(null);
      setSelectedMessages("");
      setChatHistory([]);
      setMessageCount(0);
      
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

  // Start Analysis (From Preview)
  const initializeNewSession = () => {
    const newId = Date.now().toString();
    setCurrentSessionId(newId);
    setChatHistory([]);
    setView("chat");
    generateAIResponse("Summarize this conversation in 3 bullet points.", newId);
  };

  // Resume Old Session (From Home)
  const resumeSession = (session) => {
    setCurrentSessionId(session.id);
    setSelectedMessages(session.context);
    setChatHistory(session.history || []);
    setMessageCount(session.count || 0);
    setView("chat");
  };

  const deleteSession = (e, id) => {
    e.stopPropagation(); // Prevent clicking the parent container
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    localStorage.setItem("wa_sessions", JSON.stringify(newSessions));
  };

  const goBack = () => {
    if (view === "chat") setView("home"); // FIXED: Chat -> Home
    else if (view === "preview") setView("home");
    else if (view === "settings") setView("home");
  };

  // --- AI ENGINE ---

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;
    const userQ = inputMessage;
    setInputMessage(""); 
    await generateAIResponse(userQ);
  };

  const generateAIResponse = async (query, specificSessionId = null) => {
    if (!apiKey) { setError("⚠️ Missing API Key"); return; }
    
    // Optimistic Update
    setChatHistory(prev => [...prev, { role: "user", text: query }]);
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
1. Be Concise. Use bullet points.
2. Use **Bold** for keys.
3. Be Friendly & Safe. Use Emojis.
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

  const MarkdownRenderer = ({ text }) => {
    if (!text) return null;
    const lines = text.split('\n');
    return (
      <div className="space-y-1">
        {lines.map((line, i) => {
          if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
             const content = line.trim().substring(2);
             return (
               <div key={i} className="flex gap-2 items-start ml-1">
                 <span className="text-[#25D366] mt-1.5 text-[6px]">●</span>
                 <span className="flex-1" dangerouslySetInnerHTML={{ __html: formatBold(content) }} />
               </div>
             );
          }
          if (line.trim().startsWith('## ')) {
             return <h3 key={i} className="text-[#25D366] font-bold mt-2 mb-1" dangerouslySetInnerHTML={{ __html: formatBold(line.substring(3)) }} />;
          }
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

  // SETUP
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

  // SETTINGS
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
          <button onClick={handleRemoveKey} className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 py-2.5 rounded-lg text-[13px]">Logout & Clear All</button>
        </div>
      </div>
    );
  }

  // MAIN LAYOUT
  return (
    <div className="h-screen w-full bg-[#0A0A0A] text-white flex flex-col font-sans antialiased overflow-hidden">
      
      {/* HEADER */}
      <header className="flex-shrink-0 border-b border-white/[0.08] bg-[#0A0A0A] z-10">
        <div className="px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* BACK BUTTON LOGIC */}
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
              {messageCount > 0 && view !== "home" && <p className="text-[10px] text-white/40">{messageCount} msgs</p>}
            </div>
          </div>
          <div className="flex gap-2 items-center">
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
        
        {/* --- HOME VIEW (Redesigned) --- */}
        {view === "home" && (
          <div className="min-h-full p-6 flex flex-col animate-fade-in">
            
            {/* Hero Section */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 text-center mb-8">
              <div className="w-14 h-14 bg-[#25D366]/20 rounded-xl flex items-center justify-center mx-auto mb-4 text-2xl">
                 ✨
              </div>
              <h2 className="text-lg font-semibold mb-2">New Analysis</h2>
              <p className="text-[13px] text-white/50 mb-6">Capture a new WhatsApp conversation.</p>
              <button 
                onClick={startSelection} 
                className="w-full bg-[#25D366] hover:bg-[#20BD5A] text-black font-semibold py-3 rounded-xl transition-all shadow-[0_4px_15px_rgba(37,211,102,0.2)] text-[14px]"
              >
                Start New Chat
              </button>
            </div>

            {/* History Section */}
            <h3 className="text-[12px] font-semibold text-white/40 uppercase tracking-wider mb-4 px-1">Recent Chats</h3>
            
            {sessions.length === 0 ? (
              <div className="text-center py-10 opacity-30 text-[13px]">
                No history yet. Start a chat!
              </div>
            ) : (
              <div className="space-y-3 pb-4">
                {sessions.map((session) => (
                  <div 
                    key={session.id} 
                    onClick={() => resumeSession(session)}
                    className="group bg-[#1A1A1A] border border-white/[0.05] hover:border-white/[0.15] rounded-xl p-4 cursor-pointer transition-all active:scale-[0.98]"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                         <span className="text-lg">💬</span>
                         <span className="text-[13px] font-medium text-white/90">
                           {new Date(session.date).toLocaleDateString()} 
                           <span className="opacity-50 ml-1.5 text-[11px] font-normal">{new Date(session.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                         </span>
                      </div>
                      <button 
                        onClick={(e) => deleteSession(e, session.id)} 
                        className="text-white/20 hover:text-red-400 p-1.5 -mr-2 -mt-2 rounded-md transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                    <p className="text-[12px] text-white/50 line-clamp-2 leading-relaxed">
                      {session.preview.replace(/\n/g, ' ')}
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-[10px] text-white/30">
                       <span className="bg-white/[0.05] px-1.5 py-0.5 rounded text-[#25D366]">{session.count} msgs</span>
                       <span>•</span>
                       <span>{session.history.length} AI turns</span>
                    </div>
                  </div>
                ))}
              </div>
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
              <button onClick={() => setView("home")} className="flex-1 py-3 rounded-xl border border-white/[0.1] text-[13px] hover:bg-white/[0.05]">Discard</button>
              <button 
                onClick={initializeNewSession} 
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
                <p className="text-[13px]">Analyzing chat...</p>
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