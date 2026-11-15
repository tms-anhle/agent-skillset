/* Bio Agent web runtime: thay window.claude của artifact claude.ai bằng API của server.
   - sample  → POST /api/sample (stream NDJSON), gửi kèm mã truy cập
   - user    → người dùng ẩn danh trên máy này
   - db      → lịch sử bio trong localStorage của trình duyệt
   - downloads → tải file trực tiếp */
(function () {
  var CODE_KEY = "bioagent.code", HIST_KEY = "bioagent.history";
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  window.BIO_ERR = {
    need_code: "Bạn nhập mã truy cập để dùng Bio Agent nhé.",
    bad_code: "Mã truy cập không đúng hoặc đã bị thu hồi. Bạn nhập lại mã nhé.",
    no_codes_configured: "Máy chủ chưa có mã truy cập nào (biến ACCESS_CODES trống hoặc chưa redeploy). Báo người quản trị nhé.",
    quota: "Mã truy cập này đã hết lượt hôm nay. Thử lại vào ngày mai hoặc liên hệ người cấp mã.",
    too_large: "CV hoặc JD quá dài. Hãy rút gọn rồi thử lại.",
    missing_key: "Máy chủ chưa có API key (ANTHROPIC_API_KEY hoặc GEMINI_API_KEY). Báo người quản trị nhé.",
    bad_key: "API key trên máy chủ không hợp lệ hoặc hết hạn mức. Báo người quản trị nhé.",
    server_error: "Máy chủ Bio Agent gặp lỗi. Thử lại sau ít phút."
  };
  function fail(code) { var e = new Error(code); e.code = code; return e; }

  /* ---------- mã truy cập ---------- */
  var gate = null;
  function showGate(msg) {
    if (!gate) {
      gate = document.createElement("div");
      gate.setAttribute("role", "dialog");
      gate.setAttribute("aria-modal", "true");
      gate.style.cssText = "position:fixed;inset:0;z-index:50;display:grid;place-items:center;padding:16px;background:rgba(16,19,24,.55)";
      gate.innerHTML =
        '<form class="card" style="width:min(420px,100%);gap:14px">' +
        '<div class="sh"><span class="k">Bio Agent</span><h2>Nhập mã truy cập</h2></div>' +
        '<p style="color:var(--muted)">Mã do người quản lý Bio Agent của tổ chức bạn cấp.</p>' +
        '<input class="tx" name="code" autocomplete="off" spellcheck="false" placeholder="Mã truy cập" aria-label="Mã truy cập" required>' +
        '<p data-msg style="color:var(--danger);font-size:.84rem" hidden></p>' +
        '<button class="btn" type="submit">Vào Bio Agent</button></form>';
      gate.querySelector("form").addEventListener("submit", function (ev) {
        ev.preventDefault();
        var input = gate.querySelector("input"), btn = gate.querySelector("button");
        var code = input.value.trim();
        if (!code) return;
        btn.disabled = true;
        fetch("/api/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: code }) })
          .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (res) {
            btn.disabled = false;
            if (!res.ok) { showGate(window.BIO_ERR[res.j.error] || window.BIO_ERR.server_error); return; }
            store.set(CODE_KEY, code);
            gate.hidden = true;
          })
          .catch(function () { btn.disabled = false; showGate(window.BIO_ERR.server_error); });
      });
      document.body.appendChild(gate);
    }
    var m = gate.querySelector("[data-msg]");
    m.textContent = msg || "";
    m.hidden = !msg;
    gate.hidden = false;
    setTimeout(function () { gate.querySelector("input").focus(); }, 0);
  }
  function addCodeButton() {
    var who = document.getElementById("who");
    if (!who || document.getElementById("codeBtn")) return;
    var b = document.createElement("button");
    b.type = "button"; b.id = "codeBtn"; b.className = "btn ghost sm"; b.textContent = "Mã truy cập";
    b.addEventListener("click", function () { showGate(""); });
    who.parentNode.insertBefore(b, who);
  }
  function boot() { addCodeButton(); if (!store.get(CODE_KEY)) showGate(""); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  /* ---------- gọi Claude qua server ---------- */
  function sample(input, opts) {
    opts = opts || {};
    var code = store.get(CODE_KEY);
    if (!code) { showGate(""); return Promise.reject(fail("need_code")); }
    var prompt = typeof input === "string" ? input : (input[input.length - 1] || {}).content || "";
    return fetch("/api/sample", {
      method: "POST",
      headers: { "content-type": "application/json", "x-access-code": code },
      body: JSON.stringify({ prompt: prompt }),
      signal: opts.signal
    }).then(function (r) {
      if (!r.ok) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          var c = j.error || "server_error";
          if (c === "bad_code") { store.del(CODE_KEY); showGate(window.BIO_ERR.bad_code); }
          throw fail(c);
        });
      }
      return readStream(r, opts.onText);
    }, function (e) {
      throw fail(e && e.name === "AbortError" ? "cancelled" : "upstream_error");
    });
  }
  function readStream(r, onText) {
    var reader = r.body.getReader(), dec = new TextDecoder(), buf = "", text = "", final = null;
    function line(l) {
      if (!l.trim()) return;
      var m = JSON.parse(l);
      if (m.d) { text += m.d; if (onText) onText({ text: text, delta: m.d }); }
      if (m.error) throw fail(m.error);
      if (m.done) final = m;
    }
    function pump() {
      return reader.read().then(function (x) {
        if (x.done) {
          line(buf);
          if (!final) throw fail("upstream_error");
          if (final.stop === "refusal") throw fail("refused");
          var out = typeof final.text === "string" ? final.text : text;
          if (!out.trim()) throw fail("empty_completion");
          return { text: out, truncated: final.stop === "max_tokens" };
        }
        buf += dec.decode(x.value, { stream: true });
        var parts = buf.split("\n");
        buf = parts.pop();
        parts.forEach(line);
        return pump();
      });
    }
    return pump().catch(function (e) {
      if (e && e.name === "AbortError") throw fail("cancelled");
      throw e && e.code ? e : fail("upstream_error");
    });
  }
  sample.json = function (input, opts) {
    return sample(input, opts).then(function (r) { return parseJson(r.text); });
  };
  function parseJson(t) {
    var s = t.trim(), m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) s = m[1].trim();
    var a = s.search(/[\[{]/), b = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
    if (a < 0 || b < a) throw fail("invalid_json");
    try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { throw fail("invalid_json"); }
  }

  /* ---------- lịch sử trong localStorage ---------- */
  function readHist() { try { return JSON.parse(store.get(HIST_KEY) || "[]"); } catch (e) { return []; } }
  function writeHist(rows) { if (!store.set(HIST_KEY, JSON.stringify(rows))) throw fail("storage_full"); }
  var db = {
    collection: function () {
      return {
        add: function (data) {
          var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          var rows = readHist(); rows.push({ id: id, data: data });
          writeHist(rows.slice(-50));
          return Promise.resolve({ id: id });
        },
        doc: function (id) {
          return {
            update: function (patch) {
              var rows = readHist();
              rows.forEach(function (r) { if (r.id === id) Object.assign(r.data, patch); });
              writeHist(rows);
              return Promise.resolve();
            }
          };
        },
        orderBy: function (field, dir) {
          return {
            limit: function (n) {
              return {
                get: function () {
                  var rows = readHist().slice().sort(function (x, y) {
                    var d = (x.data[field] || 0) - (y.data[field] || 0);
                    return dir === "desc" ? -d : d;
                  }).slice(0, n);
                  return Promise.resolve({ docs: rows.map(function (r) { return { id: r.id, data: function () { return r.data; } }; }) });
                }
              };
            }
          };
        }
      };
    }
  };

  /* ---------- tải file ---------- */
  var downloads = {
    save: function (req) {
      var url = URL.createObjectURL(new Blob([req.data], { type: "text/markdown;charset=utf-8" }));
      var a = document.createElement("a");
      a.href = url; a.download = req.filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      return Promise.resolve({ status: "saved" });
    }
  };

  var user = { me: function () { return Promise.resolve({ id: "local", name: "", email: "" }); } };
  var caps = { sample: sample, user: user, db: db, downloads: downloads };
  window.claude = { use: function (name) { return Promise.resolve(caps[name] || null); } };
})();
