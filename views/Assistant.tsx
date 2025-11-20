
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { ChatMessage, MessageSource, MessageOrigin, ConnectionState } from '../types';
import { mockService } from '../services/mockService';
import { transportService } from '../services/transportService';
import { soundService } from '../services/soundService';
import { checklistService } from '../services/checklistService';
import { realtimeWeatherService } from '../services/realtimeWeatherService';
import { ICONS } from '../constants';
import { Mic, Smartphone, Glasses, Music, ListChecks, Map, Home, Activity, Cloud, Sparkles, Cpu, Database } from 'lucide-react';

type IntentType = 'TRANSPORT' | 'DEVICE_CONTROL' | 'DIAGNOSTICS' | 'WEATHER' | 'LLM_GENERAL' | 'MUSIC' | 'CHECKLIST' | 'WEBVIEW' | 'HOME_ASSISTANT' | 'WAYPOINT';
type AudioSource = 'PHONE' | 'GLASSES';

const WAKE_WORD = "moncchichi"; 

const Assistant: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      text: "Hi! I'm Moncchichi. Say 'Moncchichi' to start.",
      source: MessageSource.ASSISTANT,
      origin: MessageOrigin.SYSTEM,
      timestamp: Date.now() - 10000
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [routingStatus, setRoutingStatus] = useState<string | null>(null);
  
  // Voice State
  const [audioSource, setAudioSource] = useState<AudioSource>('PHONE');
  const [isListening, setIsListening] = useState(false);
  const [liveTranscribeMode, setLiveTranscribeMode] = useState(false);
  const [transcriptionBuffer, setTranscriptionBuffer] = useState("");
  
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, routingStatus, transcriptionBuffer]);

  // Sound effect for thinking
  useEffect(() => {
      if (isThinking) {
          soundService.startThinking();
      } else {
          soundService.stopThinking();
      }
      return () => soundService.stopThinking();
  }, [isThinking]);

  // Mock Service Voice Subscription (Glasses)
  useEffect(() => {
      const unsub = mockService.subscribeToVoice((text, isFinal) => {
          if (audioSource === 'GLASSES') {
              if (liveTranscribeMode) {
                  if (isFinal) setTranscriptionBuffer(prev => prev + " " + text);
              } else if (isListening) {
                  setInput(text);
                  if (isFinal) {
                      handleVoiceInput(text);
                      setIsListening(false); 
                  }
              }
          }
      });
      return () => unsub();
  }, [audioSource, isListening, liveTranscribeMode]);

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

              for (let i = event.resultIndex; i < event.results.length; ++i) {
                  if (event.results[i].isFinal) {
                      final += event.results[i][0].transcript;
                  } else {
                      interim += event.results[i][0].transcript;
                  }
              }

              const detectedText = (final + interim).trim().toLowerCase();
              
              // Wake Word Detection
              if (!isListening && !liveTranscribeMode && detectedText.includes(WAKE_WORD)) {
                  activateListening();
                  // Remove wake word from input
                  setInput(detectedText.replace(WAKE_WORD, '').trim());
              }

              if (liveTranscribeMode) {
                  if (final) setTranscriptionBuffer(prev => prev + " " + final);
              } else if (isListening) {
                  setInput(final || interim);
                  // Simple silence/final detection could go here for auto-send
                  if (final) {
                      handleVoiceInput(final);
                      setIsListening(false);
                      recognitionRef.current.stop();
                  }
              }
          };

          recognitionRef.current.onend = () => {
              if (isListening || liveTranscribeMode) {
                  // Auto restart for continuous listening
                  try { recognitionRef.current.start(); } catch (e) {}
              }
          };
          
          recognitionRef.current.onerror = (event: any) => {
              // console.error("Speech Error", event.error);
              if (event.error !== 'no-speech') setIsListening(false);
          };
      }
  }, [isListening, liveTranscribeMode]);

  const activateListening = () => {
      setIsListening(true);
      soundService.playInteraction();
      setToast("Listening...");
  };

  const setToast = (msg: string) => {
      // Local helper for quick status updates in routing status or similar
      setRoutingStatus(msg);
      setTimeout(() => setRoutingStatus(null), 2000);
  };

  const handleVoiceInput = (text: string) => {
      const cleaned = text.replace(new RegExp(WAKE_WORD, 'gi'), '').trim();
      if (!cleaned) return;
      
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        text: cleaned,
        source: MessageSource.USER,
        origin: MessageOrigin.DEVICE,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, userMsg]);
      processUserRequest(cleaned);
  };

  const determineIntent = (text: string): IntentType => {
      const t = text.toLowerCase();
      if (t.includes("checklist") || t.includes("shopping list") || t.includes("to-do") || t.includes("remind me to") || (t.includes("add") && t.includes("to list"))) return 'CHECKLIST';
      if (t.includes("music") || t.includes("play") || t.includes("pause") || t.includes("next track") || t.includes("previous") || t.includes("song")) return 'MUSIC';
      if (t.includes("webview") || t.includes("show web") || t.includes("hide web") || t.includes("browser")) return 'WEBVIEW';
      if (t.includes("waypoint") || t.includes("add stop") || t.includes("delete stop") || t.includes("remove stop") || t.includes("navigate")) return 'WAYPOINT';
      if (t.includes("home assistant") || t.includes("light") || t.includes("turn on") || t.includes("turn off") || t.includes("activate")) return 'HOME_ASSISTANT';
      
      if (t.match(/(weather|rain|sunny|cloud|temp|hot|cold|umbrella|forecast|psi|haze|air|quality|uv|flood|lightning)/)) return 'WEATHER';
      if (t.match(/(bus|train|mrt|lrt|station|arrive|schedule|transport|stop|timing|crowd|breakdown|disruption|lift)/)) return 'TRANSPORT';
      if (t.match(/(battery|power|charge|charging|level|brightness|volume|silent|mode|lens|firmware)/)) return 'DEVICE_CONTROL';
      if (t.match(/(connect|pair|bluetooth|fix|broken|error|log|bug|issue|fail|offline)/)) return 'DIAGNOSTICS';
      return 'LLM_GENERAL';
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      text: input,
      source: MessageSource.USER,
      origin: MessageOrigin.LLM,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    processUserRequest(userMsg.text);
  };

  const processUserRequest = async (text: string) => {
     setIsThinking(true);
     setIsTyping(true);
     const lowerText = text.toLowerCase();
     
     await new Promise(r => setTimeout(r, 500));
     
     const intent = determineIntent(lowerText);
     let routingLabel = "";
     
     switch (intent) {
         case 'MUSIC': routingLabel = "Media Controller"; break;
         case 'CHECKLIST': routingLabel = "Checklist Manager"; break;
         case 'WEBVIEW': routingLabel = "WebView Controller"; break;
         case 'HOME_ASSISTANT': routingLabel = "Home Assistant API"; break;
         case 'WAYPOINT': routingLabel = "Navigation Manager"; break;
         case 'WEATHER': routingLabel = "Data.gov.sg API"; break;
         case 'TRANSPORT': routingLabel = "Transport API"; break;
         case 'DEVICE_CONTROL': routingLabel = "Device Controller"; break;
         case 'DIAGNOSTICS': routingLabel = "System Diagnostics"; break;
         case 'LLM_GENERAL': routingLabel = "Gemini Flash 2.5"; break;
     }
     setRoutingStatus(`Routing to ${routingLabel}...`);

     if (intent !== 'LLM_GENERAL') {
         await new Promise(r => setTimeout(r, 600));
     }

     let replyText = "";
     let origin = MessageOrigin.SYSTEM;
     
     // State Snapshots
     const connState = mockService.getConnectionState();
     const vitals = mockService.getVitals();
     
     switch (intent) {
         case 'MUSIC':
             origin = MessageOrigin.DEVICE;
             if (lowerText.includes("play")) {
                 mockService.sendCommand("MUSIC_CONTROL", "PLAY");
                 replyText = `Playing "${mockService.musicState.track}" by ${mockService.musicState.artist}`;
             } else if (lowerText.includes("pause") || lowerText.includes("stop")) {
                 mockService.sendCommand("MUSIC_CONTROL", "PAUSE");
                 replyText = "Music paused.";
             } else if (lowerText.includes("next")) {
                 mockService.sendCommand("MUSIC_CONTROL", "NEXT");
                 replyText = "Skipping to next track...";
             } else if (lowerText.includes("previous") || lowerText.includes("back")) {
                 mockService.sendCommand("MUSIC_CONTROL", "PREV");
                 replyText = "Going to previous track...";
             } else if (lowerText.includes("what") && lowerText.includes("playing")) {
                 replyText = `Currently playing: "${mockService.musicState.track}" by ${mockService.musicState.artist}`;
             } else {
                 replyText = "Music command recognized.";
             }
             break;

         case 'CHECKLIST':
             origin = MessageOrigin.SYSTEM;
             // Pattern matching for adding items
             // e.g. "Add milk to checklist", "Remind me to buy eggs tomorrow"
             const addMatch = lowerText.match(/(?:add|remind me to)\s+(.+?)(?:\s+(?:to|on)\s+(?:checklist|list|shopping|tomorrow|next week))?$/i);
             
             if (addMatch) {
                 const rawTask = addMatch[1].trim();
                 const dateOffset = checklistService.parseTimeQuery(lowerText);
                 // Cleanup common suffix words if matched greedily
                 const cleanTask = rawTask.replace(/\s+(?:tomorrow|today|next week|checklist|list)$/i, '');
                 
                 checklistService.addItem(cleanTask, dateOffset);
                 replyText = `Added "${cleanTask}" to your checklist${dateOffset > 0 ? ' for ' + (dateOffset === 1 ? 'Tomorrow' : 'Next Week') : ''}.`;
             } else if (lowerText.includes("open") || lowerText.includes("show")) {
                 const listName = lowerText.replace("open", "").replace("show", "").replace("checklist", "").trim() || "Default";
                 mockService.sendCommand("CHECKLIST_OPEN", listName);
                 replyText = `Opened checklist "${listName}" on HUD.`;
             } else if (lowerText.includes("close") || lowerText.includes("hide")) {
                 mockService.sendCommand("CHECKLIST_CLOSE");
                 replyText = "Checklist closed.";
             } else {
                 replyText = "I can add items. Try saying 'Add milk to checklist'.";
             }
             break;

         case 'WEBVIEW':
             origin = MessageOrigin.SYSTEM;
             if (lowerText.includes("show") || lowerText.includes("open")) {
                 const target = lowerText.includes("transit") ? "Transit" : (lowerText.includes("map") ? "Map" : "Web");
                 mockService.sendCommand("WEBVIEW_SHOW", target);
                 replyText = `Displaying ${target} WebView on glasses.`;
             } else {
                 mockService.sendCommand("CLEAR_SCREEN");
                 replyText = "WebView hidden.";
             }
             break;

         case 'HOME_ASSISTANT':
             origin = MessageOrigin.API; // External API
             // Mock integration
             if (lowerText.includes("on")) {
                 replyText = "Sent command to Home Assistant: Turn ON device.";
                 mockService.emitLog("HA", "INFO", "POST /api/services/light/turn_on");
             } else if (lowerText.includes("off")) {
                 replyText = "Sent command to Home Assistant: Turn OFF device.";
                 mockService.emitLog("HA", "INFO", "POST /api/services/light/turn_off");
             } else {
                 replyText = "Connected to Home Assistant. Ready for commands.";
             }
             break;

         case 'WAYPOINT':
             origin = MessageOrigin.SYSTEM;
             if (lowerText.includes("delete") || lowerText.includes("remove")) {
                 mockService.sendCommand("NAV_CONTROL", "DELETE_WAYPOINT");
                 replyText = "Stop removed from current route.";
                 mockService.emitLog("NAV", "INFO", "Waypoint removed");
             } else if (lowerText.includes("add")) {
                 mockService.sendCommand("NAV_CONTROL", "ADD_WAYPOINT");
                 replyText = "Waypoint added to route.";
                 mockService.emitLog("NAV", "INFO", "Waypoint added");
             } else if (lowerText.includes("delay")) {
                 replyText = "Route recalculated for delay.";
                 mockService.emitLog("NAV", "INFO", "Route Recalculated");
             } else {
                 replyText = "Navigation route updated.";
             }
             break;

         case 'WEATHER':
             origin = MessageOrigin.API; // External API
             try {
                 const w = await realtimeWeatherService.getUnifiedWeather();
                 replyText = `[Real-Time] ${w.location}: ${w.forecast2hr}, Temp ${w.forecast4day[0]?.temperature.high}°C. PSI: ${w.psi}. ${w.alerts.length > 0 ? w.alerts[0].message : ''}`;
             } catch (e) {
                 replyText = "[Error] Unable to contact Data.gov.sg API.";
             }
             break;

         case 'TRANSPORT':
             origin = MessageOrigin.API; // External API
             if (lowerText.match(/(breakdown|disruption)/)) {
                replyText = "[LTA] No reported train disruptions.";
             } else {
                replyText = "[Transport] Bus 147 arriving in 2 mins. MRT Service Normal.";
             }
             break;

         case 'DEVICE_CONTROL':
             origin = MessageOrigin.DEVICE;
             if (lowerText.includes("battery")) {
                replyText = `Glasses: ${vitals.batteryPercent}% | Case: ${vitals.caseBatteryPercent}%`;
             } else if (lowerText.includes("silent")) {
                 const mode = !vitals.silentMode;
                 mockService.sendCommand("SET_SILENT_MODE", mode);
                 replyText = `Silent mode turned ${mode ? "ON" : "OFF"}.`;
             } else {
                 replyText = `System OK. FW: ${vitals.firmwareVersion}`;
             }
             break;

         case 'DIAGNOSTICS':
             origin = MessageOrigin.SYSTEM;
             replyText = `Connection: ${connState}. Signal: ${vitals.signalRssi}dBm. No critical errors.`;
             break;

         case 'LLM_GENERAL':
             origin = MessageOrigin.LLM; // AI Source
             try {
                 const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                 const response = await ai.models.generateContent({
                     model: 'gemini-2.5-flash',
                     contents: text,
                     config: {
                         systemInstruction: "You are Moncchichi, an AI assistant for Even Realities G1 Smart Glasses. Keep your responses short, tech-savvy, and optimized for a small HUD.",
                     }
                 });
                 replyText = response.text || "I'm drawing a blank.";
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
     setMessages(prev => [...prev, replyMsg]);
     setIsTyping(false);
     soundService.playInteraction();
  };

  const handleStop = () => {
      setIsTyping(false);
      setIsThinking(false);
      setRoutingStatus(null);
      if (isListening) {
          if (audioSource === 'PHONE') recognitionRef.current?.stop();
          else mockService.sendCommand("STOP_VOICE_CAPTURE");
          setIsListening(false);
      }
      setLiveTranscribeMode(false);
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
      } else {
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
          if (audioSource === 'PHONE') recognitionRef.current?.stop();
          else mockService.sendCommand("STOP_VOICE_CAPTURE");
      } else {
          setLiveTranscribeMode(true);
          setTranscriptionBuffer("");
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

      // Assistant Messages Styling based on Origin
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

  const getOriginLabel = (origin: MessageOrigin) => {
      switch(origin) {
          case MessageOrigin.LLM: return { text: 'AI', icon: <Sparkles size={10} />, color: 'text-moncchichi-accent border-moncchichi-accent/30 bg-moncchichi-accent/5' };
          case MessageOrigin.API: return { text: 'API', icon: <Cloud size={10} />, color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/5' };
          case MessageOrigin.SYSTEM: return { text: 'SYS', icon: <Cpu size={10} />, color: 'text-moncchichi-textSec border-moncchichi-border bg-moncchichi-surface' };
          case MessageOrigin.DEVICE: return { text: 'DEV', icon: <Glasses size={10} />, color: 'text-moncchichi-success border-moncchichi-success/30 bg-moncchichi-success/5' };
          default: return { text: 'SYS', icon: <Activity size={10} />, color: 'text-moncchichi-textSec' };
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
            {isThinking && (
                <span className="text-[10px] text-moncchichi-accent animate-pulse font-mono">
                    {routingStatus || "Processing..."}
                </span>
            )}
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
                   {transcriptionBuffer || <span className="text-moncchichi-textSec opacity-50">Listening for speech...</span>}
               </div>
               <div className="mb-auto text-center text-xs text-moncchichi-accent uppercase tracking-wider py-4">
                   Live Transcription Active ({audioSource})
               </div>
          </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-40">
        {messages.map(msg => {
          const originInfo = getOriginLabel(msg.origin);
          return (
          <div key={msg.id} className={`flex ${msg.source === MessageSource.USER ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm animate-in fade-in slide-in-from-bottom-2 ${getMessageStyles(msg)}`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              <div className={`text-[10px] mt-1 opacity-80 flex items-center gap-2 ${msg.source === MessageSource.USER ? 'text-moncchichi-bg/80' : 'text-moncchichi-textSec'}`}>
                <span>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                {msg.source === MessageSource.ASSISTANT && (
                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${originInfo.color}`}>
                        {originInfo.icon}
                        <span className="font-bold text-[9px] tracking-wider">{originInfo.text}</span>
                    </div>
                )}
              </div>
            </div>
          </div>
        )})}
        
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
        
        {/* Quick Actions Bar */}
        {!isListening && !liveTranscribeMode && (
            <div className="flex gap-2 mb-2 overflow-x-auto no-scrollbar pb-1 px-1">
                <button onClick={() => processUserRequest("What is the weather now?")} className="shrink-0 px-3 py-1.5 bg-moncchichi-surfaceAlt border border-moncchichi-border rounded-full text-xs flex items-center gap-1.5 text-moncchichi-text hover:bg-moncchichi-border"><Cloud size={12}/> Weather</button>
                <button onClick={() => processUserRequest("Add milk to checklist")} className="shrink-0 px-3 py-1.5 bg-moncchichi-surfaceAlt border border-moncchichi-border rounded-full text-xs flex items-center gap-1.5 text-moncchichi-text hover:bg-moncchichi-border"><ListChecks size={12}/> Add Item</button>
            </div>
        )}

        <div className="flex items-center gap-2 bg-moncchichi-bg border border-moncchichi-border rounded-full p-1 pr-1.5">
          {/* Source Toggle */}
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
            placeholder={isListening ? `Listening... (Say '${WAKE_WORD}')` : "Ask Moncchichi..."}
            disabled={isThinking || liveTranscribeMode}
            className="flex-1 bg-transparent px-2 py-3 text-sm focus:outline-none disabled:opacity-50 placeholder-moncchichi-textSec/50"
          />

          {/* Mic Button */}
          <button 
             onClick={toggleListening}
             disabled={isThinking || liveTranscribeMode}
             className={`p-2.5 rounded-full transition-all active:scale-95 shrink-0 ${
                 isListening 
                 ? 'bg-moncchichi-error text-white animate-pulse' 
                 : 'text-moncchichi-textSec hover:text-moncchichi-text hover:bg-moncchichi-surface'
             }`}
          >
             <Mic size={20} />
          </button>

          <div className="w-px h-6 bg-moncchichi-border mx-1"></div>

          {/* Send Button */}
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
