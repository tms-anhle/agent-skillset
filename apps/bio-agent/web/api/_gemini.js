// Gọi Google Gemini (REST streamGenerateContent, SSE) và stream text qua onDelta.
// Key lấy ở aistudio.google.com. Gói miễn phí giới hạn số lần gọi và có thể dùng dữ liệu
// để cải thiện mô hình: chỉ nên thử bằng dữ liệu giả lập.
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const BASE = process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/models";

const STOP = { STOP: "end_turn", MAX_TOKENS: "max_tokens" }; // còn lại (SAFETY, RECITATION...) coi là từ chối

export async function runGemini(prompt, signal, onDelta) {
  const res = await fetch(`${BASE}/${encodeURIComponent(MODEL)}:streamGenerateContent?alt=sse`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 32000 },
    }),
    signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const type = body?.error?.status || null; // VD INVALID_ARGUMENT, RESOURCE_EXHAUSTED
    const code =
      res.status === 429 ? "rate_limited"
      : /API key/i.test(body?.error?.message || "") || res.status === 401 || res.status === 403 ? "bad_key"
      : res.status === 400 && /token/i.test(body?.error?.message || "") ? "too_large"
      : "upstream_error";
    throw Object.assign(new Error(body?.error?.message || `HTTP ${res.status}`), { code, status: res.status, type });
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "", finish = null, usage = null, blocked = false;
  const handle = (line) => {
    if (!line.startsWith("data:")) return;
    const ev = JSON.parse(line.slice(5));
    if (ev.promptFeedback?.blockReason) blocked = true;
    if (ev.usageMetadata) usage = ev.usageMetadata;
    for (const c of ev.candidates || []) {
      if (c.finishReason) finish = c.finishReason;
      for (const p of c.content?.parts || []) {
        if (p.text && !p.thought) {
          text += p.text;
          onDelta(p.text);
        }
      }
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split(/\r?\n/);
    buf = lines.pop();
    lines.forEach(handle);
  }
  handle(buf);
  const stop = blocked ? "refusal" : STOP[finish] || (finish ? "refusal" : "end_turn");
  return { stop, text, model: MODEL, usage };
}
