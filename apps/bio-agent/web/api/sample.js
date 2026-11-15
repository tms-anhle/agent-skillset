// Gọi Claude cho trang Bio Agent bằng API key của công ty, stream kết quả về dạng NDJSON:
//   {"d":"đoạn text"} ... {"done":true,"stop":"end_turn","text":"toàn bộ câu trả lời"}
//   hoặc {"error":"mã lỗi"} khi lỗi giữa chừng.
import Anthropic from "@anthropic-ai/sdk";
import { findCode, consume, json } from "./_lib.js";

const client = new Anthropic(); // đọc ANTHROPIC_API_KEY từ biến môi trường
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const EFFORT = process.env.ANTHROPIC_EFFORT || "medium";
const MAX_PROMPT_CHARS = 400_000;
const BIO_TASK = "===== NHIỆM VỤ: bước 7–8"; // prompt viết bio, tính là 1 lượt bio

export async function POST(request) {
  const entry = findCode(request.headers.get("x-access-code"));
  if (!entry) return json(401, { error: "bad_code" });
  if (!process.env.ANTHROPIC_API_KEY) return json(500, { error: "missing_key" });

  const body = await request.json().catch(() => ({}));
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  if (!prompt.trim()) return json(400, { error: "server_error" });
  if (prompt.length > MAX_PROMPT_CHARS) return json(413, { error: "too_large" });

  let limited;
  try {
    limited = await consume(entry, prompt.includes(BIO_TASK));
  } catch (err) {
    console.error("rate limit store", err);
    return json(500, { error: "server_error" });
  }
  if (limited) return json(limited === "quota" ? 429 : 500, { error: limited });

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
    { signal: request.signal },
  );

  const enc = new TextEncoder();
  const out = new ReadableStream({
    async start(ctrl) {
      const send = (o) => ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        for await (const ev of stream) {
          if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") send({ d: ev.delta.text });
        }
        const msg = await stream.finalMessage();
        const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
        send({ done: true, stop: msg.stop_reason, text });
        console.log(JSON.stringify({ code: entry.label, model: msg.model, stop: msg.stop_reason, usage: msg.usage }));
      } catch (err) {
        if (!request.signal.aborted) {
          console.error("claude", err);
          // Kèm mã HTTP và loại lỗi (không có nội dung nhạy cảm) để chẩn đoán từ trình duyệt.
          send({ error: errorCode(err), status: err?.status ?? null, type: err?.error?.error?.type ?? err?.name ?? null });
        }
      }
      ctrl.close();
    },
    cancel() {
      stream.abort();
    },
  });
  return new Response(out, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
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
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return "server_error";
  if (err instanceof Anthropic.APIError) return "upstream_error";
  return "upstream_error";
}
