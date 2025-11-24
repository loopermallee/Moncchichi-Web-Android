
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { ChatMessage, MessageSource, MessageOrigin, ConnectionState } from '../types';
import { mockService } from '../services/mockService';
import { soundService } from '../services/soundService';
import { checklistService } from '../services/checklistService';
import { realtimeWeatherService } from '../services/realtimeWeatherService';
import { memoryService } from '../services/memoryService';
import { settingsService } from '../services/settingsService';
import { ICONS } from '../constants';
import { Mic, Smartphone, Glasses, Music, ListChecks, Map, Home, Activity, Cloud, Sparkles, Cpu, Database, Trash2 } from 'lucide-react';

type IntentType = 'TRANSPORT' | 'DEVICE_CONTROL' | 'DIAGNOSTICS' | 'WEATHER' | 'LLM_GENERAL' | 'MUSIC' | 'CHECKLIST' | 'WEBVIEW' | 'HOME_ASSISTANT' | 'WAYPOINT';
type AudioSource = 'PHONE' | 'GLASSES';

const WAKE_WORD = "moncchichi"; 

const Assistant: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [routingStatus, setRoutingStatus] = useState<string | null>(null);
  
  // Voice State
  const [audioSource, setAudioSource] = useState<AudioSource>('PHONE');
  const [isListening, setIsListening] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [liveTranscribeMode, setLiveTranscribeMode] = useState(false);
  const [transcriptionBuffer, setTranscriptionBuffer] = useState("");
  const [interimResult, setInterimResult] = useState("");

  // Checklist Wizard State
  const [checklistWizard, setChecklistWizard] = useState<{
      step: 'NAME' | 'DUE' | 'DESC';
      data: { text: string; dueOffset: number; description: string };
  } | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const durationIntervalRef = useRef<any>(null);

  // Load Memory on Mount
  useEffect(() => {
      const history = memoryService.getChatHistory();
      if (history.length > 0) {
          setMessages(history);
      } else {
          setMessages([{
              id: '1',
              text: `Hi ${settingsService.get('userName')}! I'm Moncchichi. Say 'Moncchichi' to start.`,
              source: MessageSource.ASSISTANT,
              origin: MessageOrigin.SYSTEM,
              timestamp: Date.now()
          }]);
      }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, routingStatus, transcriptionBuffer, interimResult]);

  // Sound effect for thinking
  useEffect(() => {
      if (isThinking) {
          soundService.startThinking();
      } else {
          soundService.stopThinking();
      }
      return () => soundService.stopThinking();
  }, [isThinking]);

  // Recording Duration Timer
  useEffect(() => {
      if (isListening && !liveTranscribeMode) {
          setRecordingDuration(0);
          durationIntervalRef.current = setInterval(() => {
              setRecordingDuration(prev => prev + 1);
          }, 1000);
      } else {
          if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
          setRecordingDuration(0);
      }
      return () => { if (durationIntervalRef.current) clearInterval(durationIntervalRef.current); };
  }, [isListening, liveTranscribeMode]);

  const formatDuration = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Mock Service Voice Subscription (Glasses)
  useEffect(() => {
      const unsub = mockService.subscribeToVoice((text, isFinal) => {
          if (audioSource === 'GLASSES') {
              if (liveTranscribeMode) {
                  if (isFinal) {
                      setTranscriptionBuffer(prev => prev + " " + text);
                      setInterimResult("");
                  } else {
                      setInterimResult(text);
                  }
              } else if (isListening) {
                  if (isFinal) {
                      setInput(prev => (prev ? prev + " " : "") + text);
                  }
              }
          }
      });
      return () => unsub();
  }, [audioSource, isListening, liveTranscribeMode, checklistWizard]);

  // Init Web Speech API (Phone)
  useEffect(() => {
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
          // @ts-ignore
          const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
          recognitionRef.current = new SpeechRecognition();
          recognitionRef.current.continuous = true;
          recognitionRef.current.interimResults = true;

          recognitionRef.current.onresult = (event: any) => {
              let interim = '';
              let final = '';
              for (let i = 0; i < event.results.length; ++i) {
                  if (event.results[i].isFinal) {
                      final += event.results[i][0].transcript;
                  } else {
                      interim += event.results[i][0].transcript;
                  }
              }

              const detectedText = (final + interim).trim(); 
              const detectedTextLower = detectedText.toLowerCase();
              
              if (!isListening && !liveTranscribeMode && detectedTextLower.includes(WAKE_WORD)) {
                  activateListening();
                  setInput(detectedTextLower.replace(WAKE_WORD, '').trim());
                  return; 
              }

              if (liveTranscribeMode) {
                   let newFinal = '';
                   let newInterim = '';
                   for (let i = event.resultIndex; i < event.results.length; ++i) {
                      if (event.results[i].isFinal) {
                          newFinal += event.results[i][0].transcript;
                      } else {
                          newInterim += event.results[i][0].transcript;
                      }
                   }
                   if (newFinal) {
                      setTranscriptionBuffer(prev => prev + " " + newFinal);
                      setInterimResult("");
                   } else {
                      setInterimResult(newInterim);
                   }
              } else if (isListening) {
                  setInput(detectedText);
              }
          };

          recognitionRef.current.onend = () => {
              if (isListening || liveTranscribeMode) {
                  try { recognitionRef.current.start(); } catch (e) {}
              }
          };
      }
  }, [isListening, liveTranscribeMode]);

  const activateListening = () => {
      setIsListening(true);
      soundService.playInteraction();
      setToast("Recording...");
  };

  const setToast = (msg: string) => {
      setRoutingStatus(msg);
      setTimeout(() => setRoutingStatus(null), 2000);
  };

  const handleClearMemory = () => {
      memoryService.clearHistory();
      setMessages([{
          id: '1',
          text: "Memory cleared.",
          source: MessageSource.ASSISTANT,
          origin: MessageOrigin.SYSTEM,
          timestamp: Date.now()
      }]);
      soundService.playClick();
  };

  const addMessageToState = (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
      memoryService.addMessage(msg);
  };

  // Unified handler for all user inputs
  const handleUserInteraction = (text: string, origin: MessageOrigin) => {
      const cleaned = text.replace(new RegExp(WAKE_WORD, 'gi'), '').trim();
      if (!cleaned) return;

      const userMsg: ChatMessage = {
          id: Date.now().toString(),
          text: cleaned,
          source: MessageSource.USER,
          origin: origin,
          timestamp: Date.now()
      };
      addMessageToState(userMsg);
      
      if (checklistWizard) {
          processChecklistWizard(cleaned);
      } else {
          processUserRequest(cleaned);
      }
  };

  const determineIntent = (text: string): IntentType => {
      const t = text.toLowerCase();
      if (t.includes("checklist") || t.includes("shopping list") || t.includes("to-do") || t.includes("remind me to")) return 'CHECKLIST';
      if (t.includes("music") || t.includes("play") || t.includes("pause") || t.includes("next track")) return 'MUSIC';
      if (t.includes("webview") || t.includes("show web") || t.includes("browser")) return 'WEBVIEW';
      if (t.includes("home assistant") || t.includes("light")) return 'HOME_ASSISTANT';
      if (t.match(/(weather|rain|sunny|cloud|temp|forecast)/)) return 'WEATHER';
      if (t.match(/(bus|train|mrt|transport)/)) return 'TRANSPORT';
      if (t.match(/(battery|power|charge|charging|level|brightness)/)) return 'DEVICE_CONTROL';
      if (t.match(/(connect|pair|bluetooth|fix|broken|error)/)) return 'DIAGNOSTICS';
      return 'LLM_GENERAL';
  };

  const startChecklistWizard = () => {
      setChecklistWizard({ step: 'NAME', data: { text: '', dueOffset: 0, description: '' } });
      const msg: ChatMessage = {
          id: Date.now().toString(),
          text: "New task. What needs to be done?",
          source: MessageSource.ASSISTANT,
          origin: MessageOrigin.SYSTEM,
          timestamp: Date.now()
      };
      addMessageToState(msg);
      soundService.playInteraction();
  };

  const processChecklistWizard = async (text: string) => {
    if (!checklistWizard) return;
    
    setIsTyping(true);
    await new Promise(r => setTimeout(r, 600)); 
    
    const { step, data } = checklistWizard;
    let nextStep = step;
    let reply = "";
    let newData = { ...data };
    let finished = false;

    if (step === 'NAME') {
        newData.text = text;
        nextStep = 'DUE';
        reply = "When is it due? (e.g. Today, Tomorrow, Next Week)";
    } else if (step === 'DUE') {
        const lower = text.toLowerCase();
        let offset = 0;
        if (lower.includes('tomorrow')) offset = 1;
        else if (lower.includes('next week')) offset = 7;
        newData.dueOffset = offset;
        nextStep = 'DESC';
        reply = "Any additional details? (Type 'None' to skip)";
    } else if (step === 'DESC') {
        if (text.toLowerCase() !== 'none') newData.description = text;
        const item = checklistService.addItem(newData.text, newData.dueOffset);
        if (newData.description) checklistService.updateItemDetails(item.id, { description: newData.description });
        reply = `Task "${newData.text}" added to checklist.`;
        finished = true;
    }

    if (finished) setChecklistWizard(null);
    else setChecklistWizard({ step: nextStep as any, data: newData });
    
    const msg: ChatMessage = {
        id: Date.now().toString(),
        text: reply,
        source: MessageSource.ASSISTANT,
        origin: MessageOrigin.SYSTEM,
        timestamp: Date.now()
    };
    addMessageToState(msg);
    setIsTyping(false);
    soundService.playInteraction();
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    handleUserInteraction(input, MessageOrigin.LLM);
    setInput('');
  };

  const processUserRequest = async (text: string) => {
     setIsThinking(true);
     setIsTyping(true);
     const lowerText = text.toLowerCase();
     
     await new Promise(r => setTimeout(r, 500));
     const intent = determineIntent(lowerText);
     let replyText = "";
     let origin = MessageOrigin.SYSTEM;
     
     const vitals = mockService.getVitals();
     
     switch (intent) {
         case 'MUSIC':
             origin = MessageOrigin.DEVICE;
             if (lowerText.includes("play")) { mockService.sendCommand("MUSIC_CONTROL", "PLAY"); replyText = "Playing music."; }
             else if (lowerText.includes("pause")) { mockService.sendCommand("MUSIC_CONTROL", "PAUSE"); replyText = "Music paused."; }
             else replyText = "Music command recognized.";
             break;

         case 'CHECKLIST':
             origin = MessageOrigin.SYSTEM;
             startChecklistWizard();
             setIsThinking(false);
             setIsTyping(false);
             setRoutingStatus(null);
             return;

         case 'WEBVIEW':
             origin = MessageOrigin.SYSTEM;
             mockService.sendCommand("WEBVIEW_SHOW", "Web");
             replyText = "WebView launched.";
             break;

         case 'HOME_ASSISTANT':
             origin = MessageOrigin.API; 
             replyText = "Home Assistant is ready.";
             break;

         case 'WEATHER':
             origin = MessageOrigin.API;
             try {
                 const w = await realtimeWeatherService.getUnifiedWeather();
                 replyText = `[Real-Time] ${w.location}: ${w.forecast2hr}, Temp ${w.temperature}°C.`;
             } catch (e) { replyText = "Weather unavailable."; }
             break;

         case 'TRANSPORT':
             origin = MessageOrigin.API; 
             replyText = "Transport data accessed.";
             break;

         case 'DEVICE_CONTROL':
             origin = MessageOrigin.DEVICE;
             replyText = `Glasses Battery: ${vitals?.batteryPercent ?? '--'}%`;
             break;

         case 'DIAGNOSTICS':
             origin = MessageOrigin.SYSTEM;
             replyText = "System nominal.";
             break;

         case 'LLM_GENERAL':
             origin = MessageOrigin.LLM; 
             try {
                 // Inject Memory Context
                 const context = memoryService.getContextSummary();
                 const userName = settingsService.get('userName');
                 const systemPrompt = `You are Moncchichi, an AI assistant for Even Realities G1 Smart Glasses. User: ${userName}. ${context}. Keep responses short/concise for HUD.`;

                 const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                 const response = await ai.models.generateContent({
                     model: 'gemini-2.5-flash',
                     contents: text,
                     config: { systemInstruction: systemPrompt }
                 });
                 replyText = response.text || "No response generated.";
             } catch (e) {
                 replyText = "AI Network Error.";
             }
             break;
     }

     setIsThinking(false);
     setRoutingStatus(null);
     
     const replyMsg: ChatMessage = {
        id: Date.now().toString(),
        text: replyText,
        source: MessageSource.ASSISTANT,
        origin: origin,
        timestamp: Date.now()
     };
     addMessageToState(replyMsg);
     setIsTyping(false);
     soundService.playInteraction();
  };

  const handleStop = () => {
      setIsTyping(false);
      setIsThinking(false);
      setRoutingStatus(null);
      setChecklistWizard(null);
      if (isListening) {
          if (audioSource === 'PHONE') recognitionRef.current?.stop();
          else mockService.sendCommand("STOP_VOICE_CAPTURE");
          setIsListening(false);
      }
      setLiveTranscribeMode(false);
      setInterimResult("");
  };

  const toggleAudioSource = () => {
      setAudioSource(prev => prev === 'PHONE' ? 'GLASSES' : 'PHONE');
      handleStop();
  };

  const toggleListening = () => {
      if (isListening) {
          setIsListening(false);
          if (audioSource === 'PHONE' && recognitionRef.current) recognitionRef.current.stop();
          else mockService.sendCommand("STOP_VOICE_CAPTURE");
          
          if (input.trim()) {
              handleUserInteraction(input, MessageOrigin.DEVICE);
              setInput('');
          }
      } else {
          setInput('');
          activateListening();
          if (audioSource === 'PHONE') {
              try { recognitionRef.current?.start(); } catch (e) {}
          } else {
              mockService.sendCommand("START_VOICE_CAPTURE");
          }
      }
  };

  const toggleLiveTranscribe = () => {
      if (liveTranscribeMode) {
          setLiveTranscribeMode(false);
          setInterimResult("");
          if (audioSource === 'PHONE') recognitionRef.current?.stop();
          else mockService.sendCommand("STOP_VOICE_CAPTURE");
      } else {
          setLiveTranscribeMode(true);
          setTranscriptionBuffer("");
          setInterimResult("");
          if (audioSource === 'PHONE') {
              try { recognitionRef.current?.start(); } catch (e) {}
          } else {
              mockService.sendCommand("START_VOICE_CAPTURE");
          }
      }
  };

  const getMessageStyles = (msg: ChatMessage) => {
      if (msg.source === MessageSource.USER) {
          return 'bg-moncchichi-accent text-moncchichi-bg rounded-br-none';
      }
      switch (msg.origin) {
          case MessageOrigin.LLM:
              return 'bg-moncchichi-accent/5 border border-moncchichi-accent/40 text-moncchichi-text rounded-bl-none shadow-[0_0_10px_rgba(166,145,242,0.1)]';
          case MessageOrigin.API:
              return 'bg-cyan-500/5 border border-cyan-500/40 text-moncchichi-text rounded-bl-none';
          case MessageOrigin.DEVICE:
              return 'bg-moncchichi-success/5 border border-moncchichi-success/40 text-moncchichi-text rounded-bl-none';
          case MessageOrigin.SYSTEM:
          default:
              return 'bg-moncchichi-surfaceAlt border border-moncchichi-border text-moncchichi-text rounded-bl-none';
      }
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Top Bar */}
      <div className="p-4 border-b border-moncchichi-border flex justify-between items-center bg-moncchichi-surface">
        <h2 className="text-lg font-bold flex items-center gap-2">
          {ICONS.Assistant} Assistant
        </h2>
        <div className="flex items-center gap-2">
            <button onClick={handleClearMemory} className="p-1.5 text-moncchichi-textSec hover:text-moncchichi-error rounded-full">
                <Trash2 size={16} />
            </button>
            <button 
                onClick={toggleLiveTranscribe}
                className={`text-xs px-2 py-1 rounded-full border transition-colors ${liveTranscribeMode ? 'bg-moncchichi-success text-moncchichi-bg border-moncchichi-success' : 'text-moncchichi-textSec border-moncchichi-border hover:bg-moncchichi-surfaceAlt'}`}
            >
                {liveTranscribeMode ? 'Live On' : 'Live Transcribe'}
            </button>
        </div>
      </div>

      {/* Live Transcription Overlay */}
      {liveTranscribeMode && (
          <div className="absolute inset-x-0 top-14 bottom-20 bg-moncchichi-bg/95 z-10 p-6 overflow-y-auto flex flex-col-reverse">
               <div className="text-2xl font-medium text-moncchichi-text leading-relaxed animate-in fade-in slide-in-from-bottom-4">
                   <span>{transcriptionBuffer}</span>
                   {interimResult && <span className="text-moncchichi-textSec ml-2 transition-opacity">{interimResult}</span>}
               </div>
               <div className="mb-auto text-center text-xs text-moncchichi-accent uppercase tracking-wider py-4">
                   Live Transcription Active ({audioSource})
               </div>
          </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-40">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.source === MessageSource.USER ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm animate-in fade-in slide-in-from-bottom-2 ${getMessageStyles(msg)}`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              <div className={`text-[10px] mt-1 opacity-80 flex items-center gap-2 ${msg.source === MessageSource.USER ? 'text-moncchichi-bg/80' : 'text-moncchichi-textSec'}`}>
                <span>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              </div>
            </div>
          </div>
        ))}
        
        {(isTyping || isThinking) && (
          <div className="flex justify-start items-center gap-3">
            <div className="bg-moncchichi-surfaceAlt border border-moncchichi-border rounded-2xl rounded-bl-none px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-moncchichi-textSec rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                <div className="w-2 h-2 bg-moncchichi-textSec rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                <div className="w-2 h-2 bg-moncchichi-textSec rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 w-full p-3 border-t border-moncchichi-border bg-moncchichi-surface pb-safe z-20">
        <div className="flex items-center gap-2 bg-moncchichi-bg border border-moncchichi-border rounded-full p-1 pr-1.5">
          <button 
              onClick={toggleAudioSource}
              className={`h-10 w-10 flex items-center justify-center rounded-full transition-colors shrink-0 ${audioSource === 'PHONE' ? 'bg-moncchichi-surface border border-moncchichi-border text-moncchichi-text' : 'bg-moncchichi-accent/20 text-moncchichi-accent border border-moncchichi-accent/50'}`}
          >
              {audioSource === 'PHONE' ? <Smartphone size={18} /> : <Glasses size={18} />}
          </button>

          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={isListening ? `Recording...` : "Ask Moncchichi..."}
            disabled={isThinking || liveTranscribeMode}
            className="flex-1 bg-transparent px-2 py-3 text-sm focus:outline-none disabled:opacity-50 placeholder-moncchichi-textSec/50"
          />

          <button 
             onClick={toggleListening}
             disabled={isThinking || liveTranscribeMode}
             className={`p-2.5 rounded-full transition-all active:scale-95 shrink-0 ${
                 isListening 
                 ? 'bg-moncchichi-error text-white animate-pulse shadow-lg shadow-moncchichi-error/30' 
                 : 'text-moncchichi-textSec hover:text-moncchichi-text hover:bg-moncchichi-surface'
             }`}
          >
             <Mic size={20} />
          </button>

          <div className="w-px h-6 bg-moncchichi-border mx-1"></div>

          <button 
            onClick={handleSend}
            disabled={!input.trim() || isTyping || liveTranscribeMode}
            className="p-2.5 bg-moncchichi-accent text-moncchichi-bg rounded-full hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-95 shadow-lg shadow-moncchichi-accent/20 shrink-0"
          >
            {ICONS.Send}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Assistant;
