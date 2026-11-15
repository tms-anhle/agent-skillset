# Bio Agent

Giao diện web cho skill [`generate-short-bio`](../../generate-short-bio/), chạy dưới dạng artifact trên claude.ai. Trang gọi Claude bằng tài khoản của chính người xem (capability `sample`), lưu lịch sử bio riêng cho từng người (`db`, `data/users/<id>/`) và tải file `.md` (`downloads`).

## File

| File | Vai trò |
|---|---|
| `template.html` | Giao diện + flow 8 bước; chỗ `"__SKILL__"` được thay bằng nội dung skill khi build |
| `build.py` | Đọc `SKILL.md` + `references/`, nhúng vào template, ghi ra `bio-agent.html` (không commit) |

## Build và đăng

```bash
python3 -I apps/bio-agent/build.py
```

Đăng `apps/bio-agent/bio-agent.html` thành artifact với capabilities:

```json
{"sample": {}, "user": {"scopes": ["profile", "email"]}, "db": {}, "downloads": true}
```

Sửa skill xong thì build và đăng lại lên cùng artifact để giữ link và lịch sử.

## Chia sẻ

- Người được mời đích danh qua email (menu Share) dùng được đầy đủ.
- Link công khai: tài khoản ngoài tổ chức mở được trang nhưng không gọi được Claude.
- Nội dung skill nằm trong mã nguồn trang, ai mở được trang đều đọc được.
