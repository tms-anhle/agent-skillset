// Đóng gói skill generate-short-bio vào trang Short Bio Agent.
//
//   node apps/bio-agent/build.mjs           → apps/bio-agent/bio-agent.html (artifact claude.ai)
//   node apps/bio-agent/build.mjs web       → apps/bio-agent/web/public/index.html (Vercel)
//
// Đọc SKILL.md + references/ của skill, chèn vào template.html. Bản web bọc thêm
// khung HTML và web/runtime.js (thay window.claude bằng API của server).
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const skill = join(here, "..", "..", "generate-short-bio");
const target = process.argv[2] || "artifact";

const files = {
  skill: "SKILL.md",
  collect: "references/collect-info.md",
  checklist: "references/checklist.md",
  jd: "references/jd-match.md",
  projects: "references/projects.md",
  companions: "references/companions.md",
  write: "references/write-bio.md",
  output: "references/output.md",
};
const sk = Object.fromEntries(
  Object.entries(files).map(([k, p]) => [k, { path: p, text: readFileSync(join(skill, p), "utf8") }]),
);
// Giữ đúng định dạng json.dumps của bản Python cũ để artifact build ra giống hệt.
const payload = pyJson(sk).replaceAll("</", "<\\/");

const tpl = readFileSync(join(here, "template.html"), "utf8");
const marker = '"__SKILL__"';
if (tpl.split(marker).length !== 2) throw new Error("template phải có đúng 1 chỗ __SKILL__");
let out = tpl.replace(marker, () => payload);
let dest = join(here, "bio-agent.html");

if (target === "web") {
  const runtime = readFileSync(join(here, "web", "runtime.js"), "utf8").replaceAll("</", "<\\/");
  out = out
    .replace("<script>\nconst SK", () => `<script>\n${runtime}\n</script>\n<script>\nconst SK`);
  if (!out.includes("window.claude = { use")) throw new Error("không chèn được runtime.js");
  out =
    '<!doctype html><html lang="vi"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml">' +
    // Reset mà claude.ai tự chèn cho artifact; thiếu nó thì [hidden] không ẩn được phần tử có display riêng.
    "<style>body{margin:0}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style>" +
    "</head><body>\n" + out + "</body></html>\n";
  mkdirSync(join(here, "web", "public"), { recursive: true });
  dest = join(here, "web", "public", "index.html");
  // Vercel tự trả public/404.html cho đường dẫn không tồn tại.
  for (const f of ["404.html", "favicon.svg"]) copyFileSync(join(here, "web", f), join(here, "web", "public", f));
} else if (target !== "artifact") {
  throw new Error(`target không hợp lệ: ${target} (artifact | web)`);
}

writeFileSync(dest, out);
const kib = (s) => Math.floor(Buffer.byteLength(s) / 1024);
console.log(`${dest}: ${kib(out)} KiB, skill ${kib(payload)} KiB`);

// JSON giống Python json.dumps(ensure_ascii=False): ", " và ": " làm dấu phân cách.
function pyJson(v) {
  if (Array.isArray(v)) return "[" + v.map(pyJson).join(", ") + "]";
  if (v && typeof v === "object")
    return "{" + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ": " + pyJson(x)).join(", ") + "}";
  return JSON.stringify(v);
}
