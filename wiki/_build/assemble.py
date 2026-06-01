#!/usr/bin/env python3
"""Assemble the MemPalace wiki: wrap each content fragment in the canonical shell
and build concepts.json + search-index.json from the per-page JSON sidecars.

Run after the authoring workflow completes:
    python3 wiki/_build/assemble.py
"""
from __future__ import annotations

import html
import json
import sys
from pathlib import Path

WIKI = Path(__file__).resolve().parent.parent          # .../wiki
PARTS = WIKI / "_parts"
DATA = WIKI / "_data"
VERSION = "3.3.6"
GENERATED = "2026-06-01"

# slug, title, group, icon  — single source of truth for nav + order
PAGES = [
    ("index",                "Home",                     "Overview",      "\U0001F3DB️"),
    ("architecture",         "System Architecture",       "Overview",      "\U0001F5FA️"),
    ("palace-model",         "The Palace Model",          "Overview",      "\U0001F9ED"),
    ("glossary",             "Glossary",                  "Overview",      "\U0001F4D6"),
    ("mining-projects",      "Project Mining",            "Ingestion",     "⛏️"),
    ("mining-conversations", "Conversation Mining",       "Ingestion",     "\U0001F4AC"),
    ("entities",             "Entity System",             "Ingestion",     "\U0001F9E9"),
    ("aaak-dialect",         "AAAK Dialect & Closets",    "Ingestion",     "\U0001F521"),
    ("search",               "Search & Retrieval",        "Retrieval",     "\U0001F50D"),
    ("knowledge-graph",      "Temporal Knowledge Graph",  "Retrieval",     "\U0001F578️"),
    ("backends",             "Storage Backends",          "Retrieval",     "\U0001F5C4️"),
    ("cli",                  "CLI & Onboarding",          "Interfaces",    "⌨️"),
    ("mcp-server",           "MCP Server & Tools",        "Interfaces",    "\U0001F50C"),
    ("hooks",                "Hooks & Auto-save",         "Interfaces",    "\U0001FA9D"),
    ("llm-integration",      "LLM Integration",           "Cross-cutting", "\U0001F916"),
    ("i18n",                 "Internationalization",      "Cross-cutting", "\U0001F310"),
    ("security-privacy",     "Security & Privacy",        "Cross-cutting", "\U0001F512"),
    ("maintenance",          "Repair, Sync & Maintenance","Cross-cutting", "\U0001F527"),
    ("benchmarks",           "Benchmarks",                "Cross-cutting", "\U0001F4CA"),
    ("surprises",            "Surprises & Gotchas",       "Cross-cutting", "✨"),
]
GROUP_ORDER = ["Overview", "Ingestion", "Retrieval", "Interfaces", "Cross-cutting"]
TITLE = {s: t for s, t, _g, _i in PAGES}
GROUP = {s: g for s, _t, g, _i in PAGES}
ICON = {s: i for s, _t, _g, i in PAGES}


def nav_html(active: str) -> str:
    by_group: dict[str, list[tuple[str, str, str]]] = {g: [] for g in GROUP_ORDER}
    for slug, title, group, icon in PAGES:
        by_group[group].append((slug, title, icon))
    out = ['<aside class="sidebar">']
    out.append(
        '<a class="brand" href="index.html">'
        '<span class="logo">\U0001F3DB️</span>'
        '<span>MemPalace<small>Codebase Wiki</small></span></a>'
    )
    out.append(
        '<button class="search-trigger" data-search-open type="button">'
        '<span>\U0001F50D Search…</span>'
        '<span class="st-key"><kbd>⌘</kbd><kbd>K</kbd></span></button>'
    )
    out.append('<nav>')
    for group in GROUP_ORDER:
        out.append(f'<div class="nav-group"><div class="nav-group-title">{group}</div>')
        for slug, title, icon in by_group[group]:
            cls = "nav-link active" if slug == active else "nav-link"
            label = "Overview" if slug == "index" else title
            out.append(
                f'<a class="{cls}" href="{slug}.html">'
                f'<span class="ic">{icon}</span><span>{html.escape(label)}</span></a>'
            )
        out.append('</div>')
    out.append('</nav>')
    out.append(
        '<div style="margin-top:18px;padding:10px;border-top:1px solid var(--border)">'
        '<button class="theme-toggle" type="button" title="Toggle theme">◐ theme</button></div>'
    )
    out.append('</aside>')
    return "\n".join(out)


def breadcrumb(slug: str) -> str:
    if slug == "index":
        return '<nav class="breadcrumb"><span>Home</span></nav>'
    return (
        '<nav class="breadcrumb">'
        '<a href="index.html">Home</a><span class="sep">/</span>'
        f'<span>{html.escape(GROUP[slug])}</span><span class="sep">/</span>'
        f'<span>{html.escape(TITLE[slug])}</span></nav>'
    )


def shell(slug: str, fragment: str, description: str) -> str:
    title = TITLE[slug]
    page_title = "MemPalace Wiki" if slug == "index" else f"{title} · MemPalace Wiki"
    desc = html.escape(description or f"{title} — MemPalace codebase wiki.", quote=True)
    ld = {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        "headline": title,
        "name": title,
        "description": description or f"{title} — MemPalace codebase wiki.",
        "about": "MemPalace — local-first AI memory",
        "isPartOf": {"@type": "Collection", "name": "MemPalace Codebase Wiki"},
        "inLanguage": "en",
        "version": VERSION,
    }
    prism = "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0"
    langs = ["python", "bash", "json", "sql", "yaml", "toml", "markdown", "diff"]
    lang_scripts = "\n  ".join(
        f'<script src="{prism}/components/prism-{l}.min.js"></script>' for l in langs
    )
    return f"""<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{html.escape(page_title)}</title>
  <meta name="description" content="{desc}">
  <meta name="mp:slug" content="{slug}">
  <meta name="mp:group" content="{html.escape(GROUP[slug])}">
  <meta name="generator" content="mempalace-wiki">
  <meta property="og:title" content="{html.escape(title)} · MemPalace Wiki">
  <meta property="og:description" content="{desc}">
  <link rel="preconnect" href="https://cdnjs.cloudflare.com">
  <link rel="stylesheet" href="style.css">
  <link rel="stylesheet" href="{prism}/themes/prism-tomorrow.min.css">
  <script type="application/ld+json">{json.dumps(ld)}</script>
</head>
<body class="with-sidebar">
  <div class="scrim"></div>
  <header class="topbar">
    <button class="nav-toggle" type="button" aria-label="Menu">☰</button>
    <a class="brand" href="index.html" style="border:none;padding:0"><span class="logo">\U0001F3DB️</span> MemPalace</a>
    <button class="theme-toggle" type="button" title="Toggle theme" style="margin-left:auto">◐</button>
    <button class="theme-toggle" data-search-open type="button" title="Search" style="margin-left:8px">\U0001F50D</button>
  </header>
  {nav_html(slug)}
  <div class="content">
    <div class="content-inner">
      {breadcrumb(slug)}
      <main>
{fragment}
      </main>
      <footer class="site-footer">
        <span>MemPalace v{VERSION}</span>
        <span>·</span>
        <a href="index.html">Wiki home</a>
        <a href="https://github.com/MemPalace/mempalace">GitHub</a>
        <a href="concepts.json">concepts.json</a>
        <span style="margin-left:auto">Generated {GENERATED} · press <kbd>/</kbd> to search</span>
      </footer>
    </div>
  </div>
  <script src="{prism}/components/prism-core.min.js"></script>
  <script src="{prism}/components/prism-clike.min.js"></script>
  {lang_scripts}
  <script src="app.js"></script>
</body>
</html>
"""


def load_sidecar(slug: str) -> dict | None:
    p = DATA / f"{slug}.json"
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:  # tolerate a malformed sidecar
        print(f"  ! sidecar parse failed for {slug}: {e}", file=sys.stderr)
        return None


def main() -> int:
    missing_frag, missing_data, built = [], [], []
    sidecars: dict[str, dict] = {}

    for slug, *_ in PAGES:
        frag_path = PARTS / f"{slug}.inc.html"
        data = load_sidecar(slug)
        if data:
            sidecars[slug] = data
        else:
            missing_data.append(slug)
        if not frag_path.exists():
            missing_frag.append(slug)
            continue
        fragment = frag_path.read_text(encoding="utf-8").strip()
        description = (data or {}).get("summary", "") if data else ""
        (WIKI / f"{slug}.html").write_text(shell(slug, fragment, description), encoding="utf-8")
        built.append(slug)

    # ---- concepts.json (agent-friendly knowledge graph) ----
    nodes, edges, concepts, symbols, surprises = [], [], [], [], []
    seen_edges = set()
    valid = {s for s, *_ in PAGES}
    for slug, *_ in PAGES:
        d = sidecars.get(slug)
        if not d:
            continue
        nodes.append({
            "id": slug,
            "label": TITLE[slug],
            "group": GROUP[slug],
            "url": f"{slug}.html",
            "summary": d.get("summary", ""),
            "keywords": d.get("keywords", []),
        })
        for rel in d.get("related", []) or []:
            tgt = rel.get("slug") if isinstance(rel, dict) else rel
            if tgt in valid and tgt != slug:
                key = (slug, tgt, "related")
                if key not in seen_edges:
                    seen_edges.add(key)
                    edges.append({"source": slug, "target": tgt, "rel": "related",
                                  "label": (rel.get("why", "") if isinstance(rel, dict) else "")})
        for u in d.get("uses", []) or []:
            if u in valid and u != slug and (slug, u, "uses") not in seen_edges:
                seen_edges.add((slug, u, "uses"))
                edges.append({"source": slug, "target": u, "rel": "uses", "label": ""})
        for c in d.get("concepts", []) or []:
            if isinstance(c, dict) and c.get("term"):
                concepts.append({"term": c["term"], "definition": c.get("definition", ""), "page": slug})
        for s in d.get("symbols", []) or []:
            if isinstance(s, dict) and s.get("name"):
                symbols.append({"name": s["name"], "kind": s.get("kind", ""),
                                "file": s.get("file", ""), "line": s.get("line"), "page": slug})
        for sp in d.get("surprises", []) or []:
            if isinstance(sp, dict) and sp.get("title"):
                surprises.append({"title": sp["title"], "kind": sp.get("kind", ""),
                                  "detail": sp.get("detail", ""), "file": sp.get("file", ""),
                                  "line": sp.get("line"), "page": slug})

    concepts.sort(key=lambda x: x["term"].lower())
    symbols.sort(key=lambda x: x["name"].lower())
    concepts_doc = {
        "project": "MemPalace",
        "version": VERSION,
        "generated": GENERATED,
        "description": "Machine-readable knowledge graph of the MemPalace codebase wiki.",
        "counts": {"nodes": len(nodes), "edges": len(edges), "concepts": len(concepts),
                   "symbols": len(symbols), "surprises": len(surprises)},
        "nodes": nodes,
        "edges": edges,
        "concepts": concepts,
        "symbols": symbols,
        "surprises": surprises,
    }
    (WIKI / "concepts.json").write_text(json.dumps(concepts_doc, indent=2, ensure_ascii=False), encoding="utf-8")

    # ---- search-index.json ----
    search = []
    for slug, *_ in PAGES:
        d = sidecars.get(slug)
        if not d:
            continue
        sd = d.get("searchDoc") or {}
        search.append({
            "url": sd.get("url", f"{slug}.html"),
            "title": sd.get("title", TITLE[slug]),
            "group": sd.get("group", GROUP[slug]),
            "headings": sd.get("headings", []),
            "keywords": sd.get("keywords", d.get("keywords", [])),
            "summary": sd.get("summary", d.get("summary", "")),
            "body": sd.get("body", d.get("summary", "")),
        })
    (WIKI / "search-index.json").write_text(json.dumps(search, ensure_ascii=False), encoding="utf-8")

    # ---- report ----
    print(f"Built {len(built)}/{len(PAGES)} pages.")
    print(f"concepts.json: {len(nodes)} nodes, {len(edges)} edges, {len(concepts)} concepts, "
          f"{len(symbols)} symbols, {len(surprises)} surprises.")
    print(f"search-index.json: {len(search)} docs.")
    if missing_frag:
        print(f"MISSING fragments ({len(missing_frag)}): {', '.join(missing_frag)}")
    if missing_data:
        print(f"MISSING sidecars ({len(missing_data)}): {', '.join(missing_data)}")
    return 0 if not missing_frag else 2


if __name__ == "__main__":
    raise SystemExit(main())
