// Gọi Google Gemini (REST streamGenerateContent, SSE) và stream text qua onDelta.
// Key lấy ở aistudio.google.com. Gói miễn phí giới hạn số lần gọi và có thể dùng dữ liệu
// để cải thiện mô hình: chỉ nên thử bằng dữ liệu giả lập.
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const BASE = process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/models";

const STOP = { STOP: "end_turn", MAX_TOKENS: "max_tokens" }; // còn lại (SAFETY, RECITATION...) coi là từ chối

const call = (prompt, signal) =>
  fetch(`${BASE}/${encodeURIComponent(MODEL)}:streamGenerateContent?alt=sse`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 32000 },
    }),
    signal,
  });

// Gói miễn phí giới hạn theo phút và theo ngày. Lỗi 429 có RetryInfo.retryDelay (VD "23s"):
// giới hạn theo phút thì chờ rồi thử lại tối đa 2 lần; hết hạn mức ngày thì báo quota_day.
const retryDelay = (body) => {
  const d = (body?.error?.details || []).find((x) => /RetryInfo/.test(x?.["@type"] || ""))?.retryDelay;
  const s = parseFloat(String(d || ""));
  return Number.isFinite(s) ? s : null;
};
const isDaily = (body) => /per ?day|PerDay|requests_per_day|daily/i.test(JSON.stringify(body?.error || {}));
const sleep = (ms, signal) => new Promise((ok, no) => {
  const t = setTimeout(ok, ms);
  signal?.addEventListener("abort", () => { clearTimeout(t); no(Object.assign(new Error("aborted"), { name: "AbortError" })); });
});

export async function runGemini(prompt, signal, onDelta) {
  let res, body;
  for (let attempt = 0; ; attempt++) {
    res = await call(prompt, signal);
    if (res.ok) break;
    body = await res.json().catch(() => ({}));
    const wait = retryDelay(body);
    if (res.status === 429 && !isDaily(body) && attempt < 2) {
      await sleep(Math.min(Math.max(wait ?? 20, 5), 60) * 1000, signal);
      continue;
    }
    break;
  }
  if (!res.ok) {
    const type = body?.error?.status || null; // VD INVALID_ARGUMENT, RESOURCE_EXHAUSTED
    const code =
      res.status === 429 ? (isDaily(body) ? "quota_day" : "rate_limited")
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
