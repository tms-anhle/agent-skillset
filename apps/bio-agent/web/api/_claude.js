// Gọi Claude (Anthropic API) và stream text qua onDelta.
import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const EFFORT = process.env.ANTHROPIC_EFFORT || "medium";
let client;

export async function runClaude(prompt, signal, onDelta) {
  client ??= new Anthropic(); // đọc ANTHROPIC_API_KEY từ biến môi trường
  const stream = client.beta.messages.stream(
    {
      model: MODEL,
      max_tokens: 32000,
      output_config: { effort: EFFORT },
      // Bị từ chối nhầm (refusal) thì server tự chạy lại trên model dự phòng.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content: splitForCache(prompt) }],
    },
    { signal },
  );
  try {
    for await (const ev of stream) {
      if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") onDelta(ev.delta.text);
    }
    const msg = await stream.finalMessage();
    const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    return { stop: msg.stop_reason, text, model: msg.model, usage: msg.usage };
  } catch (err) {
    throw Object.assign(err, { code: errorCode(err), type: err?.error?.error?.type ?? err?.name });
  }
}

// Phần đầu prompt (hướng dẫn + nội dung skill) giống nhau giữa các member ở cùng một bước,
// nên tách thành block riêng có cache_control để các lần gọi sau đọc từ cache, rẻ hơn.
function splitForCache(prompt) {
  const lastFile = prompt.lastIndexOf("===== FILE: ");
  const cut = lastFile < 0 ? -1 : prompt.indexOf("\n\n===== ", lastFile + 1);
  if (cut < 0) return prompt;
  return [
    { type: "text", text: prompt.slice(0, cut), cache_control: { type: "ephemeral" } },
    { type: "text", text: prompt.slice(cut) },
  ];
}

function errorCode(err) {
  if (err instanceof Anthropic.RateLimitError) return "rate_limited";
  if (err instanceof Anthropic.BadRequestError) return /too long|too large/i.test(err.message) ? "too_large" : "server_error";
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return "bad_key";
  return "upstream_error";
}
