// Gọi AI cho trang Bio Agent bằng key của server, stream kết quả về dạng NDJSON:
//   {"d":"đoạn text"} ... {"done":true,"stop":"end_turn","text":"toàn bộ câu trả lời"}
//   hoặc {"error":"mã lỗi","status":...,"type":...} khi lỗi giữa chừng.
//
// AI_PROVIDER = claude | gemini. Bỏ trống: có ANTHROPIC_API_KEY thì dùng Claude, không thì Gemini.
import { findCode, consume, json } from "./_lib.js";
import { runClaude } from "./_claude.js";
import { runGemini } from "./_gemini.js";

const MAX_PROMPT_CHARS = 400_000;
const BIO_TASK = "===== NHIỆM VỤ: bước 7–8"; // prompt viết bio, tính là 1 lượt bio

function provider() {
  const want = (process.env.AI_PROVIDER || "").trim().toLowerCase();
  const hasClaude = !!process.env.ANTHROPIC_API_KEY, hasGemini = !!process.env.GEMINI_API_KEY;
  if (want === "claude") return hasClaude ? ["claude", runClaude] : null;
  if (want === "gemini") return hasGemini ? ["gemini", runGemini] : null;
  if (hasClaude) return ["claude", runClaude];
  if (hasGemini) return ["gemini", runGemini];
  return null;
}

export async function POST(request) {
  const entry = findCode(request.headers.get("x-access-code"));
  if (!entry) return json(401, { error: "bad_code" });
  const ai = provider();
  if (!ai) return json(500, { error: "missing_key" });
  const [name, run] = ai;

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
  if (limited) return json(429, { error: limited });

  const abort = new AbortController();
  request.signal?.addEventListener("abort", () => abort.abort());
  const enc = new TextEncoder();
  const out = new ReadableStream({
    async start(ctrl) {
      const send = (o) => ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        const r = await run(prompt, abort.signal, (d) => send({ d }));
        send({ done: true, stop: r.stop, text: r.text });
        console.log(JSON.stringify({ code: entry.label, provider: name, model: r.model, stop: r.stop, usage: r.usage }));
      } catch (err) {
        if (!abort.signal.aborted) {
          console.error(name, err);
          // Kèm mã HTTP và loại lỗi (không có nội dung nhạy cảm) để chẩn đoán từ trình duyệt.
          send({ error: err.code || "upstream_error", provider: name, status: err.status ?? null, type: err.type ?? err.name ?? null });
        }
      }
      ctrl.close();
    },
    cancel() {
      abort.abort();
    },
  });
  return new Response(out, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
