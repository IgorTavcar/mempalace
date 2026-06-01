# MemPalace Codebase Wiki

A self-contained, static knowledge base for the [MemPalace](https://github.com/MemPalace/mempalace)
repository — a condensed, richly cross-linked map of the codebase for both humans and AI agents.

## Serve it

It's fully static. Open `index.html` directly, or serve the folder (recommended, so
`search-index.json` / `concepts.json` load over `fetch`):

```bash
cd wiki
python3 -m http.server 8000
# open http://localhost:8000
```

## What's inside

| File | Purpose |
|---|---|
| `index.html` | Landing page: overview, an interactive Mermaid knowledge graph, stat tiles, quick-access cards, design principles. |
| `architecture.html`, `palace-model.html`, … | One focused page per major area of the codebase, each densely cross-linked. |
| `glossary.html` | Every domain term, defined and linked to the page that covers it. |
| `surprises.html` | Curated cross-codebase insights, gotchas, performance tricks, and security decisions. |
| `style.css` | Shared dark-first (light-toggle) theme and the component class vocabulary. |
| `app.js` | Client-side search, nav, theme, auto table-of-contents, copy buttons, lazy Mermaid. |
| `concepts.json` | **Machine-readable** knowledge graph: nodes, edges, concepts, symbols, surprises. For agents. |
| `search-index.json` | Full-text search index consumed by `app.js`. |

## Navigation & search

- **Search:** press <kbd>/</kbd> or <kbd>⌘/Ctrl</kbd>+<kbd>K</kbd> anywhere.
- **Theme:** toggle in the sidebar footer / top bar (persisted in `localStorage`).
- Every page has a sidebar, breadcrumb trail, an auto-generated "On this page" table of contents,
  and a "See also" cross-link grid.

## For agents

Start from `concepts.json` — it encodes the page graph (`nodes` + `edges`), a flat `concepts`
glossary (term → definition → page), a `symbols` index (name → `file:line` → page), and the
`surprises` list. Each HTML page also carries `<meta name="mp:slug">` / `mp:group` and a JSON-LD
`TechArticle` block for structured parsing.

## Rebuilding

The pages are assembled from per-area content fragments (`_parts/`) and JSON sidecars (`_data/`)
by `_build/assemble.py`, which owns the canonical shell, nav, and the two index files. The content
fragments are produced by the authoring workflow in `_build/wiki_workflow.js`.

```bash
python3 wiki/_build/assemble.py
```

_Generated 2026-06-01 for MemPalace v3.3.6._
