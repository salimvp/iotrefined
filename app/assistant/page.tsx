"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, CornerDownLeft, Loader2, Mic, MicOff, Send, Sparkles, User, Volume2, VolumeX, Zap } from "lucide-react";
import { useHome } from "@/lib/store";
import type { AssistantAction, AssistantTurn } from "@/lib/assistant";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/StatusPill";

/**
 * Minimal Web Speech API types — TypeScript's DOM lib does not ship them, and
 * the actual browser support varies, so every use is feature-detected first.
 */
type SpeechResult = { isFinal: boolean; 0: { transcript: string } };
type SpeechResultEvent = { results: { length: number; [index: number]: SpeechResult } };
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const VOICE_STORAGE_KEY = "assistant:voice-replies";

/** Chrome exposes this unprefixed; Safari and older builds only ship the webkit alias. */
function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Strip the markdown the model emits so spoken replies do not read out asterisks. */
function speakableText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_#>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SUGGESTIONS = [
  "Is anyone moving in the house?",
  "Is the soil dry?",
  "How full is the dustbin?",
  "Turn on the light.",
  "Why did the buzzer activate?",
  "Show me a status summary.",
];

interface Message extends AssistantTurn {
  action?: AssistantAction | null;
  engine?: "llm" | "local";
}

export default function AssistantPage() {
  const { snapshot, sendCommand } = useHome();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I read live data from your ESP32 — motion, soil, water level, temperature, gas, flame, rain, the dustbin and the door. I can act on the house (just say “turn on the light” or “refill the tank”), and I'm happy to answer general questions too. I never guess a reading — sensor values always come from the live data.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOut, setVoiceOut] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  // Feature detection and the saved voice preference are client-only, so the
  // voice controls appear once the page has hydrated.
  useEffect(() => {
    setMicSupported(getRecognitionCtor() !== null);
    setTtsSupported("speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined");
    try {
      setVoiceOut(window.localStorage.getItem(VOICE_STORAGE_KEY) === "on");
    } catch {
      /* storage unavailable (private mode) — keep the in-memory default */
    }
    return () => {
      recognitionRef.current?.abort();
      window.speechSynthesis.cancel();
    };
  }, []);

  /** Read a reply aloud, with markdown stripped out first. */
  function speak(text: string) {
    const plain = speakableText(text);
    if (!ttsSupported || !plain) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(plain));
  }

  function toggleVoiceOut() {
    const next = !voiceOut;
    setVoiceOut(next);
    if (!next) window.speechSynthesis.cancel();
    try {
      window.localStorage.setItem(VOICE_STORAGE_KEY, next ? "on" : "off");
    } catch {
      /* ignore */
    }
  }

  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    // Never let the microphone pick up the assistant's own spoken reply.
    window.speechSynthesis.cancel();
    const recognition = new Ctor();
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let transcript = "";
      let isFinal = false;
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        transcript += result[0].transcript;
        if (result.isFinal) isFinal = true;
      }
      const text = transcript.trim();
      if (text) setInput(text);
      // Dictation submits on its own; a spoken command should just go.
      if (isFinal && text) void ask(text);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setInput("");
    const history: Message[] = [...messages, { role: "user", content: question }];
    setMessages(history);
    setBusy(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
          context: snapshot,
        }),
      });
      const data = (await res.json()) as { reply?: string; action?: AssistantAction | null; engine?: "llm" | "local" };
      const reply = data.reply ?? "Sorry, I couldn't reach the assistant service.";

      setMessages((prev) => [...prev, { role: "assistant", content: reply, action: data.action ?? null, engine: data.engine }]);

      if (voiceOut) speak(reply);

      // A control request becomes a real command row — never a plain reply.
      if (data.action) {
        await sendCommand(data.action.command_type, data.action.value);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "I couldn't reach the assistant service. Your dashboard is still updating live." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card padded={false} className="flex h-[calc(100vh-15rem)] min-h-[420px] flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-gradient shadow-glow">
            <Bot className="h-4 w-4 text-white" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-white">Home Assistant</h2>
            <p className="text-[11px] text-slate-400">Live ESP32 readings, plus general help</p>
          </div>
          <StatusPill tone="info" className="ml-auto">
            <Zap className="h-3 w-3" /> server-side
          </StatusPill>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "assistant" ? (
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.05] text-brand-300">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
              ) : null}
              <div className={`max-w-[80%] ${m.role === "user" ? "text-right" : ""}`}>
                <div
                  className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-brand-500/20 text-slate-100 ring-1 ring-inset ring-brand-400/25"
                      : "border border-white/10 bg-white/[0.03] text-slate-200"
                  }`}
                >
                  {m.content}
                </div>
                {m.action ? (
                  <p className="mt-1.5 text-[11px] text-emerald-300">
                    ⚡ Sent command: {m.action.label} ({m.action.command_type} = {m.action.value})
                  </p>
                ) : null}
                {m.engine ? (
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">
                    {m.engine === "llm" ? "answered by AI model" : "answered from live data"}
                  </p>
                ) : null}
              </div>
              {m.role === "user" ? (
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.05] text-slate-300">
                  <User className="h-3.5 w-3.5" />
                </span>
              ) : null}
            </div>
          ))}
          {busy ? (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> checking live readings…
            </div>
          ) : null}
          <div ref={endRef} />
        </div>

        <form
          className="flex items-center gap-2 border-t border-white/10 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={listening ? "Listening…" : "Ask about the house, or tell it to do something…"}
            className="field flex-1"
          />
          {micSupported ? (
            <button
              type="button"
              onClick={toggleListening}
              disabled={busy}
              aria-pressed={listening}
              aria-label={listening ? "Stop listening" : "Speak your question"}
              title={listening ? "Stop listening" : "Speak your question"}
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-40 ${
                listening
                  ? "border-rose-400/40 bg-rose-500/15 text-rose-300"
                  : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
              }`}
            >
              {listening ? <MicOff className="h-4 w-4 animate-pulse" /> : <Mic className="h-4 w-4" />}
            </button>
          ) : null}
          {ttsSupported ? (
            <button
              type="button"
              onClick={toggleVoiceOut}
              aria-pressed={voiceOut}
              aria-label={voiceOut ? "Mute spoken replies" : "Read replies aloud"}
              title={voiceOut ? "Mute spoken replies" : "Read replies aloud"}
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition ${
                voiceOut
                  ? "border-brand-400/40 bg-brand-500/15 text-brand-200"
                  : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
              }`}
            >
              {voiceOut ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
          ) : null}
          <button type="submit" disabled={busy || !input.trim()} className="btn-primary">
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </Card>

      <div className="space-y-4">
        <Card>
          <h3 className="text-sm font-semibold text-white">Try asking</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void ask(s)}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/[0.08]"
              >
                {s}
              </button>
            ))}
          </div>
        </Card>

        <Card className="text-[11px] leading-relaxed text-slate-400">
          <h3 className="text-sm font-semibold text-white">How this stays honest</h3>
          <ul className="mt-2 space-y-2">
            <li className="flex gap-2">
              <CornerDownLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-300" />
              The browser sends the current snapshot with your question. The server never fetches sensor data of its own.
            </li>
            <li className="flex gap-2">
              <CornerDownLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-300" />
              Sensor values always come from that snapshot — the model is never allowed to invent a reading.
            </li>
            <li className="flex gap-2">
              <CornerDownLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-300" />
              Other questions are answered normally; advice beyond the data is clearly general guidance, not a measurement.
            </li>
            <li className="flex gap-2">
              <CornerDownLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-300" />
              The AI key lives only in the server route. It is never shipped to the browser.
            </li>
            <li className="flex gap-2">
              <CornerDownLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-300" />
              Without a key the assistant still works — answers are derived directly from the snapshot.
            </li>
            <li className="flex gap-2">
              <CornerDownLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-300" />
              Control requests create a row in <code className="rounded bg-black/30 px-1">commands</code>; the ESP32 executes it and reports back.
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
