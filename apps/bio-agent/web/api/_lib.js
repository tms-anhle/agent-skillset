// Mã truy cập + giới hạn lượt dùng theo ngày (Upstash Redis).
//
// ACCESS_CODES="tomosia:ma-dai-ngau-nhien:50,khach-a:ma-khac:10"  (nhãn:mã:số bio mỗi ngày)
// Số lần gọi Claude mỗi ngày bị chặn ở CALLS_PER_BIO × số bio để mã không bị dùng làm proxy tự do.
import { createHash, timingSafeEqual } from "node:crypto";
import { Redis } from "@upstash/redis";

const CALLS_PER_BIO = 12;
const DEFAULT_BIO_LIMIT = Number(process.env.DAILY_BIO_LIMIT || 20);

function codes() {
  return (process.env.ACCESS_CODES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [label, code, limit] = s.split(":").map((x) => x.trim());
      return { label, code, limit: Number(limit) || DEFAULT_BIO_LIMIT };
    })
    .filter((c) => c.label && c.code);
}

const digest = (s) => createHash("sha256").update(s).digest();

export function findCode(given) {
  if (!given) return null;
  const g = digest(String(given).trim());
  return codes().find((c) => timingSafeEqual(digest(c.code), g)) || null;
}

let redis;
function getRedis() {
  if (redis !== undefined) return redis;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

// Ngày theo giờ Việt Nam (UTC+7), để lượt dùng reset lúc 0h sáng VN.
const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

async function bump(key) {
  const r = getRedis();
  const n = await r.incr(key);
  if (n === 1) await r.expire(key, 2 * 86400);
  return n;
}

// Trả về null nếu được phép, hoặc mã lỗi.
export async function consume(entry, isBio) {
  if (!getRedis()) return process.env.RATE_LIMIT_DISABLED === "1" ? null : "limits_not_configured";
  const day = today();
  const calls = await bump(`bio-agent:${entry.label}:${day}:calls`);
  if (calls > entry.limit * CALLS_PER_BIO) return "quota";
  if (isBio) {
    const bios = await bump(`bio-agent:${entry.label}:${day}:bios`);
    if (bios > entry.limit) return "quota";
  }
  return null;
}

export async function remaining(entry) {
  const r = getRedis();
  if (!r) return null;
  const used = Number((await r.get(`bio-agent:${entry.label}:${today()}:bios`)) || 0);
  return Math.max(0, entry.limit - used);
}

export const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
