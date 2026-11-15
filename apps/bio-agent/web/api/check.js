// Kiểm tra mã truy cập khi người dùng nhập ở màn hình đầu.
import { findCode, remaining, codeCount, json } from "./_lib.js";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const entry = findCode(body.code);
  if (!entry) return json(401, { error: codeCount() ? "bad_code" : "no_codes_configured" });
  return json(200, { ok: true, label: entry.label, limit: entry.limit, remaining: await remaining(entry) });
}
