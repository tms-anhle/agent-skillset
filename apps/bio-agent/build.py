"""Đóng gói skill generate-short-bio vào trang Bio Agent.

Chạy từ gốc repo: python3 -I apps/bio-agent/build.py
Đọc SKILL.md + references/ của skill, chèn vào template.html, ghi ra bio-agent.html cạnh script.
"""
import json
import pathlib
import sys

here = pathlib.Path(__file__).resolve().parent
repo = pathlib.Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else here.parent.parent
skill = repo / "generate-short-bio"

files = {
    "skill": "SKILL.md",
    "collect": "references/collect-info.md",
    "checklist": "references/checklist.md",
    "jd": "references/jd-match.md",
    "projects": "references/projects.md",
    "companions": "references/companions.md",
    "write": "references/write-bio.md",
    "output": "references/output.md",
}
sk = {k: {"path": p, "text": (skill / p).read_text(encoding="utf-8")} for k, p in files.items()}
payload = json.dumps(sk, ensure_ascii=False).replace("</", "<\\/")

tpl = (here / "template.html").read_text(encoding="utf-8")
marker = '"__SKILL__"'
assert tpl.count(marker) == 1, "template phải có đúng 1 chỗ __SKILL__"
out = tpl.replace(marker, payload)
(here / "bio-agent.html").write_text(out, encoding="utf-8")
print(f"bio-agent.html: {len(out.encode()) // 1024} KiB, skill {len(payload.encode()) // 1024} KiB")
