/* ==========================================================================
   MemPalace Wiki — shared client script
   - theme toggle (persisted)         - mobile sidebar
   - active nav highlight             - auto table-of-contents
   - heading anchor links             - code copy buttons
   - client-side search (search-index.json)  [ "/" or Cmd/Ctrl-K ]
   - lazy Mermaid init (only if a .mermaid block exists)
   ========================================================================== */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }

  /* ---------- theme ---------- */
  var root = document.documentElement;
  try {
    var saved = localStorage.getItem("mp-theme");
    if (saved) root.setAttribute("data-theme", saved);
  } catch (e) {}
  function toggleTheme() {
    var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("mp-theme", next); } catch (e) {}
  }

  /* ---------- active nav link ---------- */
  function markActiveNav() {
    var here = location.pathname.split("/").pop() || "index.html";
    $$(".sidebar .nav-link").forEach(function (a) {
      var href = (a.getAttribute("href") || "").split("/").pop();
      if (href === here) { a.classList.add("active"); }
    });
  }

  /* ---------- mobile sidebar ---------- */
  function wireSidebar() {
    var t = $(".nav-toggle");
    if (t) t.addEventListener("click", function () { document.body.classList.toggle("nav-open"); });
    var scrim = $(".scrim");
    if (scrim) scrim.addEventListener("click", function () { document.body.classList.remove("nav-open"); });
    $$(".sidebar .nav-link").forEach(function (a) {
      a.addEventListener("click", function () { document.body.classList.remove("nav-open"); });
    });
  }

  /* ---------- heading anchors + TOC ---------- */
  function slugify(s) { return s.toLowerCase().replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, ""); }
  function buildAnchorsAndToc() {
    var main = $("main"); if (!main) return;
    var heads = $$("h2, h3", main).filter(function (h) {
      return !h.closest("#toc") && !h.closest(".tile-grid") && !h.closest(".related") &&
             !h.closest(".stat-grid") && !h.closest(".graph-wrap") && !h.closest(".callout");
    });
    var tocMount = $("#toc");
    var list = tocMount ? el("ul") : null;
    heads.forEach(function (h) {
      if (!h.id) h.id = slugify(h.textContent);
      if (!h.querySelector(".anchor")) {
        var a = el("a", "anchor", "#"); a.href = "#" + h.id; a.setAttribute("aria-label", "Link to section");
        h.appendChild(a);
      }
      if (list) {
        var li = el("li", "lvl-" + (h.tagName === "H3" ? "3" : "2"));
        var link = el("a"); link.href = "#" + h.id; link.textContent = h.textContent.replace(/#$/, "").trim();
        li.appendChild(link); list.appendChild(li);
      }
    });
    if (tocMount && list && heads.length > 2) {
      tocMount.innerHTML = '<div class="toc-title">On this page</div>';
      tocMount.appendChild(list);
    } else if (tocMount) {
      tocMount.style.display = "none";
    }
  }

  /* ---------- copy buttons ---------- */
  function wireCopy() {
    $$("pre[class*='language-']").forEach(function (pre) {
      if (pre.querySelector(".copy-btn")) return;
      var b = el("button", "copy-btn", "copy");
      b.addEventListener("click", function () {
        var code = pre.querySelector("code"); if (!code) return;
        navigator.clipboard.writeText(code.innerText).then(function () {
          b.textContent = "copied"; setTimeout(function () { b.textContent = "copy"; }, 1200);
        });
      });
      pre.appendChild(b);
    });
  }

  /* ---------- search ---------- */
  var INDEX = null, overlay, input, resultsBox, sel = -1, current = [];
  function ensureOverlay() {
    if (overlay) return;
    overlay = el("div"); overlay.id = "search-overlay";
    overlay.innerHTML =
      '<div class="search-box" role="dialog" aria-label="Search">' +
        '<input id="search-input" type="text" autocomplete="off" spellcheck="false" placeholder="Search the palace… (modules, concepts, gotchas)">' +
        '<div id="search-results"></div>' +
        '<div class="search-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></div>' +
      '</div>';
    document.body.appendChild(overlay);
    input = $("#search-input", overlay); resultsBox = $("#search-results", overlay);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) closeSearch(); });
    input.addEventListener("input", function () { runSearch(input.value); });
    input.addEventListener("keydown", onSearchKey);
  }
  function loadIndex() {
    if (INDEX) return Promise.resolve(INDEX);
    return fetch("search-index.json").then(function (r) { return r.json(); }).then(function (d) { INDEX = d || []; return INDEX; }).catch(function () { INDEX = []; return INDEX; });
  }
  function openSearch() {
    ensureOverlay(); loadIndex();
    overlay.classList.add("open"); input.value = ""; input.focus();
    resultsBox.innerHTML = '<div class="search-empty">Type to search ' + (INDEX ? INDEX.length : "") + ' indexed sections…</div>';
    sel = -1; current = [];
  }
  function closeSearch() { if (overlay) overlay.classList.remove("open"); }
  function scoreDoc(doc, terms) {
    var hay = (doc.title + " " + (doc.group || "") + " " + (doc.keywords || []).join(" ") + " " + (doc.headings || []).join(" ") + " " + (doc.body || "")).toLowerCase();
    var titleL = doc.title.toLowerCase(), kwL = (doc.keywords || []).join(" ").toLowerCase(), headL = (doc.headings || []).join(" ").toLowerCase();
    var score = 0;
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i]; if (!t) continue;
      if (hay.indexOf(t) === -1) return 0;            // AND semantics
      if (titleL.indexOf(t) !== -1) score += 12;
      if (titleL.split(/\s+/).indexOf(t) !== -1) score += 8;
      if (kwL.indexOf(t) !== -1) score += 6;
      if (headL.indexOf(t) !== -1) score += 4;
      score += 1;
    }
    return score;
  }
  function snippet(doc, terms) {
    var body = doc.body || doc.summary || "";
    var low = body.toLowerCase(), pos = -1;
    for (var i = 0; i < terms.length; i++) { var p = low.indexOf(terms[i]); if (p !== -1) { pos = p; break; } }
    var start = pos > 60 ? pos - 50 : 0;
    var frag = body.slice(start, start + 150);
    frag = esc(frag);
    terms.forEach(function (t) { if (t) frag = frag.replace(new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"), "<mark>$1</mark>"); });
    return (start > 0 ? "…" : "") + frag + "…";
  }
  function runSearch(q) {
    q = (q || "").trim().toLowerCase();
    if (!q) { resultsBox.innerHTML = '<div class="search-empty">Type to search…</div>'; current = []; return; }
    loadIndex().then(function (idx) {
      var terms = q.split(/\s+/);
      var ranked = idx.map(function (d) { return { d: d, s: scoreDoc(d, terms) }; })
                      .filter(function (x) { return x.s > 0; })
                      .sort(function (a, b) { return b.s - a.s; })
                      .slice(0, 12);
      current = ranked; sel = ranked.length ? 0 : -1;
      if (!ranked.length) { resultsBox.innerHTML = '<div class="search-empty">No matches for “' + esc(q) + '”.</div>'; return; }
      resultsBox.innerHTML = "";
      ranked.forEach(function (x, i) {
        var a = el("a", "search-result" + (i === 0 ? " sel" : ""));
        a.href = x.d.url;
        a.innerHTML = '<div class="sr-group">' + esc(x.d.group || "") + '</div>' +
                      '<div class="sr-title">' + esc(x.d.title) + '</div>' +
                      '<div class="sr-snip">' + snippet(x.d, terms) + '</div>';
        resultsBox.appendChild(a);
      });
    });
  }
  function onSearchKey(e) {
    if (e.key === "Escape") { closeSearch(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Enter") { e.preventDefault(); var r = $$(".search-result", resultsBox)[sel]; if (r) location.href = r.href; }
  }
  function move(d) {
    var items = $$(".search-result", resultsBox); if (!items.length) return;
    if (sel >= 0 && items[sel]) items[sel].classList.remove("sel");
    sel = (sel + d + items.length) % items.length;
    items[sel].classList.add("sel"); items[sel].scrollIntoView({ block: "nearest" });
  }

  /* ---------- mermaid (lazy) ---------- */
  function initMermaid() {
    if (!$(".mermaid")) return;
    var s = el("script");
    s.src = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";
    s.onload = function () {
      var dark = root.getAttribute("data-theme") !== "light";
      window.mermaid.initialize({
        startOnLoad: true,
        theme: dark ? "dark" : "neutral",
        themeVariables: {
          primaryColor: "#16202d", primaryTextColor: "#d4e2f0", primaryBorderColor: "#2a3a4f",
          lineColor: "#4dc9f6", fontFamily: "ui-monospace, monospace", fontSize: "14px"
        },
        flowchart: { curve: "basis", useMaxWidth: true }
      });
    };
    document.head.appendChild(s);
  }

  /* ---------- global keys + triggers ---------- */
  function wireGlobal() {
    document.addEventListener("keydown", function (e) {
      if ((e.key === "/" && !/input|textarea/i.test((e.target.tagName || ""))) ||
          ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault(); openSearch();
      }
    });
    $$("[data-search-open]").forEach(function (b) { b.addEventListener("click", openSearch); });
    $$(".theme-toggle").forEach(function (tt) { tt.addEventListener("click", toggleTheme); });
  }

  function init() {
    markActiveNav(); wireSidebar(); buildAnchorsAndToc(); wireCopy(); wireGlobal(); initMermaid();
    // expose for inline handlers / debugging
    window.MP = { openSearch: openSearch, toggleTheme: toggleTheme };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
