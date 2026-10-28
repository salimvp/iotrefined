import { NextResponse } from "next/server";
import { buildSystemPrompt, confirmAction, localAnswer, parseAction, type AssistantTurn } from "@/lib/assistant";
import type { HomeSnapshot } from "@/lib/types";

/**
 * Server-side AI assistant.
 *
 * The API key NEVER leaves this file: the browser only sends the conversation
 * and the current snapshot. If no key is configured we fall back to a
 * deterministic answer built purely from that snapshot, so the assistant is
 * still useful (and still never invents readings) without any cloud AI.
 *
 * Requests that ask for a physical change are turned into a device command on
 * the client, exactly like pressing a button. The AI never writes to hardware.
 */

export const runtime = "nodejs";

const AI_KEY = process.env.AI_API_KEY ?? "";
const AI_MODEL = process.env.AI_MODEL ?? "gpt-4o-mini";
// Strip any trailing slash: the provider base is joined with "/chat/completions",
// and a trailing slash (the documented Gemini URL ends in one) yields a double
// slash that providers reject with a 404.
const AI_BASE_URL = (process.env.AI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");

export async function POST(req: Request) {
  let body: { messages?: AssistantTurn[]; context?: HomeSnapshot };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  const context = body.context;
  if (!context || !context.sensors || !context.state) {
    return NextResponse.json({ error: "Missing device context" }, { status: 400 });
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  // Intent parsing always runs locally, in both modes, so "turn on the light"
  // reliably produces a command even if the model replies with prose.
  const action = parseAction(lastUser);

  let reply: string | null = null;
  let engine: "llm" | "local" = "local";

  if (!AI_KEY) {
    // Expected in demo setups, but it is also the #1 cause of "the AI seems dumb":
    // without a key every answer comes from the keyword matcher in localAnswer().
    console.warn("[assistant] AI_API_KEY is not set — answering from the live snapshot only");
  }

  if (action) {
    // A control request is executed as a command and confirmed, never described in
    // prose. Skipping the model here also avoids spending a provider request (free
    // tiers are rate limited) and guarantees the reply cannot contradict the action
    // that was just sent.
    reply = confirmAction(action);
  } else if (AI_KEY && lastUser) {
    try {
      const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${AI_KEY}` },
        body: JSON.stringify({
          model: AI_MODEL,
          temperature: 0.2,
          // Reasoning models (e.g. gemini-2.5-*) spend part of the output budget on
          // internal thinking, so a small cap truncates the visible answer mid-sentence.
          max_tokens: 2048,
          messages: [{ role: "system", content: buildSystemPrompt(context) }, ...messages],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const finish = (data as { choices?: { finish_reason?: string }[] }).choices?.[0]?.finish_reason;
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) {
          reply = text;
          engine = "llm";
          if (finish === "length") {
            console.warn(`[assistant] answer hit the token cap (model=${AI_MODEL}); the reply may be cut off`);
          }
        } else {
          console.error(`[assistant] provider returned an empty completion (model=${AI_MODEL}, finish=${finish}); falling back to the local answer`);
        }
      } else {
        const detail = await res.text().catch(() => "");
        console.error(
          `[assistant] provider request failed: HTTP ${res.status} (model=${AI_MODEL}, base=${AI_BASE_URL}) — ${detail.slice(0, 500)}`,
        );
      }
    } catch (err) {
      // Network/API failure — fall through to the local answering path, but say why.
      console.error(`[assistant] provider request threw (base=${AI_BASE_URL}):`, err instanceof Error ? err.message : err);
      reply = null;
    }
  }

  if (!reply) reply = localAnswer(lastUser, context);

  return NextResponse.json({ reply, action, engine });
}
