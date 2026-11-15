# Bio Agent

Giao diện web cho skill [`generate-short-bio`](../../generate-short-bio/). Cùng một giao diện (`template.html`) chạy theo hai cách:

| Bản | Gọi Claude bằng | Ai dùng được | Lịch sử bio |
|---|---|---|---|
| Artifact claude.ai | Tài khoản Claude của người xem | Chủ artifact và người được mời qua email | Lưu riêng từng người trên claude.ai |
| Web trên Vercel (`web/`) | API key của công ty | Ai có link và mã truy cập | Lưu trong trình duyệt (localStorage) |

## File

| File | Vai trò |
|---|---|
| `template.html` | Giao diện + flow 8 bước; chỗ `"__SKILL__"` được thay bằng nội dung skill khi build |
| `build.mjs` | Nhúng `SKILL.md` + `references/` vào template. `node build.mjs` → `bio-agent.html`; `node build.mjs web` → `web/public/index.html` |
| `web/404.html`, `web/favicon.svg` | Trang "Không tìm thấy trang" và favicon, build chép vào `public/` |
| `web/runtime.js` | Bản web: thay `window.claude` của artifact bằng API server, màn hình nhập mã, lịch sử localStorage |
| `web/api/sample.js` | Kiểm tra mã và lượt dùng, chọn AI theo `AI_PROVIDER`, stream kết quả về trang |
| `web/api/_claude.js`, `web/api/_gemini.js` | Gọi Claude (`ANTHROPIC_API_KEY`) hoặc Gemini (`GEMINI_API_KEY`) |
| `web/api/check.js` | Kiểm tra mã truy cập |
| `web/api/_lib.js` | Đọc `ACCESS_CODES`, đếm lượt theo ngày bằng Upstash Redis (nếu có) |

File build ra (`bio-agent.html`, `web/public/`) không commit.

## Bản artifact claude.ai

```bash
node apps/bio-agent/build.mjs
```

Đăng `apps/bio-agent/bio-agent.html` lên cùng artifact cũ để giữ link và lịch sử, capabilities:

```json
{"sample": {}, "user": {"scopes": ["profile", "email"]}, "db": {}, "downloads": true}
```

Link công khai không đủ: tài khoản ngoài tổ chức mở được trang nhưng không gọi được Claude. Mời từng email qua menu Share.

## Bản web trên Vercel

1. **Anthropic Console:** tạo API key riêng cho Bio Agent, đặt giới hạn chi tiêu theo tháng cho workspace của key.
2. **Vercel → New Project:** chọn repo, đặt **Root Directory** là `apps/bio-agent/web`, Framework Preset `Other`. Giữ bật tùy chọn cho phép đọc file ngoài Root Directory (build cần thư mục `generate-short-bio/`).
3. **Tùy chọn, Storage → Upstash Redis (Marketplace):** gắn vào project để giới hạn số bio mỗi mã mỗi ngày; Vercel tự thêm `KV_REST_API_URL`, `KV_REST_API_TOKEN`. Không gắn thì không giới hạn lượt, chỉ còn hạn mức chi tiêu đặt trên Anthropic Console.
4. **Settings → Environment Variables:** thêm các biến trong `web/.env.example`:
   - `ANTHROPIC_API_KEY`: key ở bước 1. Chưa có key trả phí thì thay bằng `GEMINI_API_KEY` lấy miễn phí ở aistudio.google.com (gói miễn phí giới hạn lượt gọi và có thể dùng dữ liệu để cải thiện mô hình, nên chỉ thử bằng dữ liệu giả lập). Có cả hai key thì chọn bằng `AI_PROVIDER=claude|gemini`.
   - `ACCESS_CODES`: `nhãn:mã:số-bio-mỗi-ngày`, nhiều mã cách nhau bằng dấu phẩy. Ví dụ `tomosia:<mã ngẫu nhiên>:50,khach-a:<mã khác>:10`. Tạo mã bằng `openssl rand -base64 18`.
   - Tùy chọn: `ANTHROPIC_MODEL` (mặc định `claude-opus-5-5`), `ANTHROPIC_EFFORT` (mặc định `medium`), `GEMINI_MODEL` (mặc định `gemini-2.5-flash`), `DAILY_BIO_LIMIT` (mặc định 20).
5. **Deploy**, mở link, nhập mã, thử tạo một bio.

Đổi hoặc thu hồi mã: sửa `ACCESS_CODES` rồi redeploy. Khi có Redis, lượt dùng tính theo ngày giờ Việt Nam; mỗi mã có tối đa `số bio × 12` lần gọi Claude mỗi ngày để mã không bị dùng làm proxy tự do. Log của function ghi số token mỗi lần gọi (Vercel → Logs) để theo dõi chi phí.

Chạy thử ở máy: `npm i -g vercel`, trong `apps/bio-agent/web` chạy `vercel link`, `vercel env pull`, rồi `vercel dev`.

## Bảo mật

- API key chỉ nằm trong biến môi trường của Vercel, không ra trình duyệt.
- Nội dung skill nằm trong mã nguồn trang, ai mở được trang đều đọc được (repo cũng public).
- CV và JD gửi qua server tới Claude API, server không lưu lại; lịch sử bio chỉ nằm trong trình duyệt của người dùng.
