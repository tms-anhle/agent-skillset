/* Chế độ xem mẫu: mở trang với ?demo (hoặc ?demo=3) để xem giao diện từng bước bằng dữ liệu giả.
   Không hỏi mã truy cập, không gọi AI; các nút điều hướng chỉ chuyển giữa các bước mẫu.
   Chạy sau script chính nên dùng trực tiếp S, fresh, render, initForm, A... */
(function () {
  var m = location.search.match(/[?&]demo(?:=(\d))?/);
  if (!m) return;

  var md = [
    "# Nguyễn Văn An",
    "**Vị trí:** Backend Developer",
    "**Email:** an.nguyen@tomosia.com",
    "**Ngày sinh:** [[y:_(chưa có — vui lòng bổ sung)_]]",
    "**Ngoại ngữ:** JLPT N3",
    "---",
    "## Short Bio",
    "Backend Developer với [[g:5 năm]] kinh nghiệm xây dựng hệ thống đặt lịch và thanh toán cho mảng y tế bằng Laravel và MySQL. Quen làm việc với khách Nhật từ giai đoạn đọc yêu cầu tới bàn giao.",
    "Đã thiết kế API đặt lịch, tích hợp cổng thanh toán và tối ưu truy vấn báo cáo cho hệ thống có hàng chục nghìn lượt đặt mỗi tháng. Dùng Redis cho hàng đợi gửi email nhắc lịch, giúp trang chính phản hồi nhanh hơn trong giờ cao điểm.",
    "Trong team 6 người, phụ trách review code phía backend và thống nhất API contract với frontend ngay đầu sprint. [[p:Hướng dẫn 2 thành viên mới làm quen codebase.]]",
    "---",
    "## Core Skills",
    "**Backend/Framework:** Laravel ([[g:5 năm]]), PHP ([[g:5 năm]])",
    "**Database:** MySQL (4 năm)",
    "**Caching & Queue:** Redis",
    "**Cloud:** [[g:AWS]] ([[y:_… năm_]])",
    "**DevOps:** Docker, GitHub Actions",
    "---",
    "## Projects",
    "### Project 1 — Hệ thống đặt lịch khám cho chuỗi phòng khám",
    "**Thời gian:** 02/2023 – 12/2024 (22 tháng)",
    "**Vị trí:** Backend Developer · **Team size:** 6",
    "**Mô tả:** Web cho bệnh nhân đặt lịch khám, thanh toán online và nhận nhắc lịch qua email; phòng khám quản lý lịch bác sĩ và báo cáo doanh thu.",
    "**Vai trò trong dự án:** Thiết kế DB, viết API đặt lịch và thanh toán, tối ưu truy vấn báo cáo.",
    "**Tech Stack:** Laravel, MySQL, Redis, Docker",
  ].join("\n");
  var reminders = [
    { kind: "y", text: "Header: thêm ngày sinh nếu muốn khách thấy." },
    { kind: "g", text: "Số năm Laravel / PHP nâng từ 4 lên 5 theo JD (5+ năm). Chuẩn bị trả lời nếu khách hỏi." },
    { kind: "g", text: "AWS thêm theo JD, bạn chưa ghi là đã dùng. Điền số năm hoặc bỏ dòng này." },
    { kind: "p", text: "\"Hướng dẫn 2 thành viên mới\" lấy từ ghi chú của bạn, kiểm tra lại cho đúng." },
    { kind: "n", text: "Project 1 = Hệ thống đặt lịch ABC Clinic (tên thật chỉ để bạn đối chiếu, không có trong bio)." },
  ];
  var summary = [
    { label: "Tên", value: "Nguyễn Văn An", status: "ok" },
    { label: "Email", value: "", status: "missing" },
    { label: "Vị trí", value: "Backend", status: "inferred" },
    { label: "Số năm kinh nghiệm", value: "4", status: "ok" },
    { label: "Công nghệ", value: "PHP, Laravel, MySQL, Redis, Docker", status: "ok" },
    { label: "Ngoại ngữ", value: "JLPT N3", status: "ok" },
    { label: "Dự án", value: "Hệ thống đặt lịch khám (2023–2024)", status: "ok" },
  ];
  var form = [
    { id: "e", type: "choice", header: "Email", question: "Email để khách liên hệ có phải là an.nguyen@tomosia.com không?", required: true, format: "email",
      options: [{ label: "an.nguyen@tomosia.com", description: "Theo quy ước tên.họ@tomosia.com", recommended: true }] },
    { id: "a", type: "choice", header: "AI", question: "Bạn có dùng AI trong lúc phát triển không?",
      options: [{ label: "Có, thêm 2 dòng AI", recommended: true }, { label: "Không thêm" }] },
    { id: "c", type: "choice", header: "Việc đã làm", multi: true, question: "Khách thường muốn biết bạn đã làm những việc dưới đây chưa. Bạn đã làm việc nào?",
      hint: "Chưa làm việc nào thì để trống.",
      options: [{ label: "Thiết kế DB / API cho feature" }, { label: "Tối ưu query / cache / queue" }, { label: "Tham gia detailed design" }] },
    { id: "d", type: "text", header: "Ngày sinh", question: "Bạn muốn ghi ngày sinh vào hồ sơ không?", format: "date", placeholder: "VD: 15/08/1996" },
    { id: "p", type: "projects", header: "Dự án", question: "Bạn muốn kể thêm 1–2 dự án nổi bật không?" },
  ];
  var profile = { name: "Nguyễn Văn An", email: "an.nguyen@tomosia.com", role: "Backend", years: 4, level: "Middle", detail: "chi tiết",
    stack: [{ name: "Laravel", years: 4, main: true }, { name: "PHP", years: 4, main: true }, { name: "MySQL", years: 4, main: true }, { name: "Redis" }, { name: "Docker" }],
    projects: [{ key: "p1", name: "ABC Clinic" }, { key: "p2", name: "Kho XYZ" }] };
  var jd = "Tuyển Senior Backend Engineer: 5+ năm PHP/Laravel, thiết kế REST API, MySQL tối ưu truy vấn, có kinh nghiệm AWS. Ưu tiên biết Vue.js, tiếng Nhật N3.";
  var match = {
    message: "Mình đã so JD với hồ sơ của bạn. Phần lớn khớp, có vài chỗ cần chỉnh.",
    rows: [
      { need: "5+ năm PHP / Laravel", have: "4 năm", action: "Ghi 5 năm", kind: "jd" },
      { need: "Thiết kế REST API", have: "Có, dự án đặt lịch", action: "Nhấn mạnh", kind: "ok" },
      { need: "AWS", have: "Chưa có", action: "Chỉ ghi ở Core Skills + nhắc", kind: "missing" },
      { need: "Vue.js (ưu tiên)", have: "Chưa có", action: "Không viết vào bio", kind: "nice" },
    ],
    crossRole: null,
    form: [{ id: "m", type: "choice", header: "Mức khớp JD", question: "Bạn muốn bio bám JD tới đâu?",
      options: [{ label: "Tương đối khớp", description: "Ghi 5 năm, nhấn skill khớp JD, vẫn giữ điểm mạnh khác", recommended: true },
        { label: "Hoàn toàn khớp", description: "Chỉ nêu skill và lĩnh vực JD cần" },
        { label: "Tổng quát", description: "Giữ 4 năm, JD chỉ là gợi ý nhẹ" }] }],
  };
  var proj = {
    message: "Bạn có 2 dự án. Mình đề xuất dự án đặt lịch vì khớp JD nhất; bạn bổ sung giúp vài chi tiết nhé.",
    candidates: [
      { key: "p1", label: "ABC Clinic (02/2023 – 12/2024)", title: "Hệ thống đặt lịch khám cho chuỗi phòng khám", recommended: true, why: "Dùng Laravel, API và MySQL đúng như JD" },
      { key: "p2", label: "Kho XYZ (2021 – 2022)", title: "Hệ thống quản lý kho cho chuỗi bán lẻ", why: "Dự án cũ hơn, ít liên quan JD" },
    ],
    forms: { p1: [
      { id: "t", type: "choice", header: "Việc bạn làm", multi: true, question: "Ở dự án đặt lịch, bạn đã trực tiếp làm những việc nào?", otherHint: "Việc khác bạn đã làm",
        options: [{ label: "Thiết kế DB", recommended: true }, { label: "API đặt lịch và thanh toán", recommended: true }, { label: "Báo cáo doanh thu" }] },
      { id: "s", type: "text", header: "Team", question: "Team dự án có bao nhiêu người?", placeholder: "VD: 6" } ] },
  };

  function base(step) {
    S = fresh();
    S.info = "Nguyễn Văn An, Backend 4 năm, Laravel / PHP / MySQL. JLPT N3.";
    S.step = step;
    if (step >= 1) { S.analysis = { message: "Mình đã đọc CV của bạn. Còn thiếu email và vài chi tiết, bạn trả lời giúp mấy câu dưới nhé.", summary: summary, notes: [], level: "Middle", detail: "chi tiết", form: form, roleForm: [], stop: null }; initForm("form", form); }
    if (step >= 3) { S.profile = profile; S.fileName = "short-bio-nguyen-van-an-" + today() + ".md"; }
    if (step >= 4) { S.jd = jd; S.match = match; initForm("match", match.form); }
    if (step >= 5) { S.proj = Object.assign({}, proj, { sel: ["p1"] }); initForm("p:p1", proj.forms.p1); initForm("p:p2", []); }
  }
  var STEPS = [
    ["1 · Có CV", function () { base(0); }],
    ["1 · Điền nhanh", function () { base(0); S.mode = "form"; }],
    ["2 · Xác nhận", function () { base(1); }],
    ["3 · Vị trí", function () { base(2); var rf = [{ id: "r", header: "Vị trí", question: "Bạn ghi vị trí Fullstack, nhưng công nghệ chủ yếu là Laravel. Bạn muốn ghi vị trí nào?",
      options: [{ label: "Backend", description: "Theo công nghệ chính ở các dự án", recommended: true }, { label: "Giữ Fullstack" }], otherHint: "Hoặc ghi công nghệ frontend bạn đã dùng" }];
      S.analysis.roleForm = rf; initForm("role", rf); }],
    ["4 · JD khách", function () { base(3); }],
    ["5 · Mức khớp JD", function () { base(4); }],
    ["6 · Dự án", function () { base(5); }],
    ["7 · Viết bio", function () { base(5); S.step = 6; S.busy = "Đang viết bản nháp, mất khoảng 1–2 phút…"; S.streamText = "<<<BIO>>>\n" + md.slice(0, 520); }],
    ["8 · Kiểm tra", function () { base(5); S.step = 7; S.result = { md: md, reminders: reminders }; S.savedNote = "Đã lưu: " + S.fileName; S.checked = { 0: true }; }],
  ];
  var cur = 0;
  function go(i) { cur = Math.max(0, Math.min(STEPS.length - 1, i)); STEPS[cur][1](); render(); paintBar(); window.scrollTo(0, 0); }

  // Nút điều hướng trong trang chỉ chuyển sang bước mẫu kế tiếp, không gọi AI.
  var next = function () { go(cur + 1); };
  ["analyze", "afterForm", "finalize", "submitMissing", "jdNext", "toProjects", "write"].forEach(function (k) { A[k] = next; });
  A.translate = function (lang) { S.lang = lang; S.tr[lang] = "# Nguyễn Văn An\n_(Bản " + lang + " mẫu: trong chế độ xem mẫu, trang không gọi AI để dịch.)_"; render(); };

  var bar = document.createElement("nav");
  bar.setAttribute("aria-label", "Xem mẫu từng bước");
  bar.style.cssText = "position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:60;display:flex;gap:4px;align-items:center;padding:6px;max-width:calc(100% - 24px);overflow-x:auto;border-radius:999px;background:var(--ink);color:var(--on-ink);box-shadow:0 10px 30px -10px rgba(0,0,0,.45);font:600 12px var(--f)";
  function paintBar() {
    bar.innerHTML = '<span style="padding:0 10px;opacity:.7;white-space:nowrap">Xem mẫu</span>' + STEPS.map(function (s, i) {
      return '<button type="button" data-demo="' + i + '" style="border:0;border-radius:999px;padding:7px 11px;white-space:nowrap;cursor:pointer;font:inherit;' +
        (i === cur ? "background:#f5c84c;color:#2b2620" : "background:transparent;color:inherit") + '">' + s[0] + "</button>";
    }).join("");
  }
  bar.addEventListener("click", function (e) { var b = e.target.closest("[data-demo]"); if (b) go(+b.dataset.demo); });
  document.body.appendChild(bar);
  document.querySelector(".wrap").style.paddingBottom = "90px";
  var start = { 1: 0, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8 }[m[1]] || 0;
  go(start);
})();
