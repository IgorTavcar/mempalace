export const meta = {
  name: 'mempalace-wiki',
  description: 'Deep-analyze the MemPalace codebase and author a richly cross-linked static wiki (content fragments + JSON sidecars)',
  whenToUse: 'Generate the wiki/ knowledge base for the MemPalace repository',
  phases: [
    { title: 'Analyze', detail: 'one agent per area reads its source files deeply and returns structured findings' },
    { title: 'Author', detail: 'turn each area analysis into a polished HTML content fragment + data sidecar' },
    { title: 'Synthesize', detail: 'landing page, glossary, and surprises page from the aggregated sidecars' },
  ],
}

/* ----------------------------------------------------------------------------
   Shared reference passed to every agent.
---------------------------------------------------------------------------- */
const REPO = '/Users/tigor/Projects/_forked/mempalace'
const PARTS = REPO + '/wiki/_parts'
const DATA = REPO + '/wiki/_data'
const GEN_DATE = args && args.date ? args.date : '2026-06-01'

const PAGES_REF = `
Overview group:
  index            -> Home / Overview (index.html)
  architecture     -> System Architecture (architecture.html)
  palace-model     -> The Palace Model: wings/rooms/drawers/closets/hallways/tunnels/diary (palace-model.html)
  glossary         -> Glossary (glossary.html)
Ingestion group:
  mining-projects        -> Project Mining (mining-projects.html)
  mining-conversations   -> Conversation Mining (mining-conversations.html)
  entities               -> Entity System (entities.html)
  aaak-dialect           -> AAAK Dialect & Closets (aaak-dialect.html)
Retrieval group:
  search           -> Search & Retrieval (search.html)
  knowledge-graph  -> Temporal Knowledge Graph (knowledge-graph.html)
  backends         -> Storage Backends (backends.html)
Interfaces group:
  cli              -> CLI & Onboarding (cli.html)
  mcp-server       -> MCP Server & Tools (mcp-server.html)
  hooks            -> Hooks & Auto-save (hooks.html)
Cross-cutting group:
  llm-integration  -> LLM Integration (llm-integration.html)
  i18n             -> Internationalization (i18n.html)
  security-privacy -> Security & Privacy (security-privacy.html)
  maintenance      -> Repair, Sync & Maintenance (maintenance.html)
  benchmarks       -> Benchmarks (benchmarks.html)
  surprises        -> Surprises & Gotchas (surprises.html)
`.trim()

const CLASS_CONTRACT = `
You are writing the INNER CONTENT FRAGMENT of one wiki page (the HTML that goes inside <main>).
Do NOT emit <html>, <head>, <body>, <main>, sidebar nav, breadcrumb, or <script> tags — those are added
by the build step. Output ONLY the content fragment, in this order (omit a section only if you truly have
nothing accurate to put in it):

  <header class="page-head">
    <div class="page-kicker">GROUP_NAME</div>
    <h1>Page Title</h1>
    <p class="lead">one-sentence subtitle</p>
  </header>
  <div class="summary">2–4 sentence executive summary (the TL;DR).</div>
  <div id="toc"></div>
  <h2>How it works</h2> ... narrative with <h3> subsections, <p>, <ul> ...
  <h2>Key concepts</h2>
  <dl class="concepts"><dt>term</dt><dd>definition</dd> ...</dl>
  <h2>Implementation highlights</h2> ... prose + code blocks + callouts ...
  <h2>Key symbols</h2>
  <table class="symbols"><thead><tr><th>Symbol</th><th>Kind</th><th>Location</th><th>Role</th></tr></thead><tbody>
    <tr><td>name</td><td>class/func/const</td><td><code>file.py:123</code></td><td>what it does</td></tr> ...
  </tbody></table>
  <h2>Design decisions</h2> ... decision → rationale (a <dl class="concepts"> or <table class="data">) ...
  <h2>Data flow</h2> ... how data moves through this area ...
  <div class="related"><h2>See also</h2><div class="related-grid">
    <a class="related-card" href="OTHER-SLUG.html"><span class="rc-group">GROUP</span><div class="rc-title">Title</div><div class="rc-desc">why it relates</div></a>
    ... 3–6 cards ...
  </div></div>

Callouts (use them to surface insights/gotchas/perf/security — this is REQUIRED, every page needs at least
2 callouts that highlight non-obvious value):
  <div class="callout insight"><div class="callout-title">💡 Insight</div><p>…</p></div>
  <div class="callout gotcha"><div class="callout-title">⚠️ Gotcha</div><p>…</p></div>
  <div class="callout perf"><div class="callout-title">⚡ Performance</div><p>…</p></div>
  <div class="callout security"><div class="callout-title">🔒 Security</div><p>…</p></div>

Code blocks (ALWAYS HTML-escape &, <, > inside code; keep snippets short, 3–18 lines, verbatim from source):
  <div class="code-caption">miner.py:412 · incremental upsert</div>
  <pre><code class="language-python">def mine(...):
      ...</code></pre>

Collapsible optional depth:
  <details class="collapsible"><summary>Edge cases &amp; details</summary> ... </details>

Cross-linking rules:
 - Link generously. Reference other pages by their slug filename, e.g. <a href="search.html">hybrid search</a>.
 - Use ONLY slugs from the page list below. Inline-link related concepts in prose AND provide related-cards.
 - Refer to code locations as <code>module.py:line</code> (real lines you verified).

Available page slugs for cross-links:
${PAGES_REF}
`.trim()

const ANALYSIS_SCHEMA = {
  type: 'object',
  required: ['slug', 'title', 'group', 'lead', 'summary', 'keyConcepts', 'howItWorks', 'keySymbols'],
  properties: {
    slug: { type: 'string' },
    title: { type: 'string' },
    group: { type: 'string' },
    lead: { type: 'string', description: 'one-sentence subtitle' },
    summary: { type: 'string', description: '2-4 sentence executive summary' },
    keyConcepts: { type: 'array', items: { type: 'object', required: ['term', 'definition'], properties: { term: { type: 'string' }, definition: { type: 'string' } } } },
    howItWorks: { type: 'array', items: { type: 'object', required: ['heading', 'detail'], properties: { heading: { type: 'string' }, detail: { type: 'string', description: 'rich prose, 2-6 sentences' }, points: { type: 'array', items: { type: 'string' } } } } },
    implementationHighlights: { type: 'array', items: { type: 'object', required: ['title', 'detail'], properties: { title: { type: 'string' }, detail: { type: 'string' }, file: { type: 'string' }, line: { type: 'integer' } } } },
    surprises: { type: 'array', items: { type: 'object', required: ['title', 'detail', 'kind'], properties: { title: { type: 'string' }, detail: { type: 'string' }, kind: { type: 'string', enum: ['insight', 'gotcha', 'perf', 'security'] }, file: { type: 'string' }, line: { type: 'integer' } } } },
    designDecisions: { type: 'array', items: { type: 'object', required: ['decision', 'rationale'], properties: { decision: { type: 'string' }, rationale: { type: 'string' } } } },
    dataFlow: { type: 'string' },
    keySymbols: { type: 'array', items: { type: 'object', required: ['name', 'kind', 'file', 'role'], properties: { name: { type: 'string' }, kind: { type: 'string' }, file: { type: 'string' }, line: { type: 'integer' }, role: { type: 'string' } } } },
    codeSnippets: { type: 'array', items: { type: 'object', required: ['caption', 'language', 'code'], properties: { caption: { type: 'string' }, language: { type: 'string' }, code: { type: 'string' }, file: { type: 'string' }, line: { type: 'integer' } } } },
    uses: { type: 'array', items: { type: 'string' } },
    usedBy: { type: 'array', items: { type: 'string' } },
    related: { type: 'array', items: { type: 'object', required: ['slug', 'why'], properties: { slug: { type: 'string' }, why: { type: 'string' } } } },
    keywords: { type: 'array', items: { type: 'string' } },
    stats: { type: 'array', items: { type: 'object', required: ['label', 'value'], properties: { label: { type: 'string' }, value: { type: 'string' } } } },
  },
}

const DONE_SCHEMA = {
  type: 'object',
  required: ['slug', 'wroteFragment', 'wroteData'],
  properties: {
    slug: { type: 'string' },
    wroteFragment: { type: 'boolean' },
    wroteData: { type: 'boolean' },
    sectionCount: { type: 'integer' },
    snippetCount: { type: 'integer' },
    note: { type: 'string' },
  },
}

/* ----------------------------------------------------------------------------
   The 17 area pages.
---------------------------------------------------------------------------- */
const AREAS = [
  { slug: 'architecture', title: 'System Architecture', group: 'Overview',
    lead: 'The component map, the wake-up stack, and the non-negotiable design principles.',
    focus: ['mempalace/palace.py', 'mempalace/layers.py', 'mempalace/__init__.py', 'mempalace/_stdio.py', 'mempalace/version.py', 'CLAUDE.md', 'MISSION.md'],
    scope: 'The big picture: how CLI / MCP server sit on top of a pluggable storage backend plus a SQLite knowledge graph. The L0–L3 "wake-up" memory stack in layers.py. Core request/data flows (mine -> store, search -> retrieve, wake-up -> context injection). The package layout and module responsibilities. The design principles from CLAUDE.md (verbatim-always, incremental-only, entity-first, local-first/zero-external-API, performance budgets, privacy-by-architecture, background-everything) and HOW the code enforces them.' },

  { slug: 'palace-model', title: 'The Palace Model', group: 'Overview',
    lead: 'Method-of-loci + Zettelkasten mapped onto concrete data structures.',
    focus: ['mempalace/palace.py', 'mempalace/palace_graph.py', 'mempalace/hallways.py', 'mempalace/dynamics.py', 'docs/CLOSETS.md'],
    scope: 'The spatial metaphor turned into real structures: WINGS (people/projects), ROOMS (day/topic/session), DRAWERS (verbatim chunks), CLOSETS (compressed index cards), HALLWAYS (within-wing connectors), TUNNELS (cross-wing links), and agent DIARIES. Collection/ID naming schemes and delimiters, how rooms are traversed (palace_graph), how hallways/tunnels are formed and decay (dynamics.py). Make the metaphor->implementation mapping crisp.' },

  { slug: 'mining-projects', title: 'Project Mining', group: 'Ingestion',
    lead: 'Turning a project directory of files into verbatim, searchable drawers.',
    focus: ['mempalace/miner.py', 'mempalace/format_miner.py', 'mempalace/general_extractor.py', 'mempalace/project_scanner.py', 'mempalace/split_mega_files.py', 'docs/format-coverage.md', 'docs/virtual-line-numbering.md'],
    scope: 'How `mempalace mine <dir>` walks a project, detects file formats, extracts content, applies virtual line numbering, splits mega-files, and writes incremental/idempotent drawers. project_scanner entity detection. Format coverage. Emphasize incremental-only ingest and idempotency (re-mining the same file must not duplicate).' },

  { slug: 'mining-conversations', title: 'Conversation Mining', group: 'Ingestion',
    lead: 'Normalizing AI chat transcripts and filing them verbatim, message by message.',
    focus: ['mempalace/convo_miner.py', 'mempalace/convo_scanner.py', 'mempalace/normalize.py', 'mempalace/sweeper.py', 'mempalace/diary_ingest.py', 'mempalace/sources/base.py', 'mempalace/sources/registry.py', 'mempalace/sources/transforms.py', 'mempalace/sources/context.py'],
    scope: 'The `--mode convos` path: transcript format detection/normalization across Claude Code, ChatGPT, Gemini CLI, OpenCode SQLite, etc. (normalize.py). Per-message sweeping (sweeper.py) for verbatim drawer-per-message. Additive diary writes (diary_ingest.py). The RFC-002 source-adapter plugin scaffolding (sources/). Idempotent/resume-safe behavior.' },

  { slug: 'entities', title: 'Entity System', group: 'Ingestion',
    lead: 'Auto-detecting and disambiguating the people, projects, and systems in your text.',
    focus: ['mempalace/entity_detector.py', 'mempalace/entity_registry.py', 'mempalace/room_detector_local.py', 'mempalace/corpus_origin.py', 'mempalace/data/coca_content_words.json'],
    scope: 'Entity-first design: detecting people/projects/known-systems from content, the COCA content-word filter (data/coca_content_words.json) to suppress common words, disambiguation (DOB/ID/context), the entity registry storage, non-latin word boundaries, and corpus-origin tiering. How entities key wings.' },

  { slug: 'aaak-dialect', title: 'AAAK Dialect & Closets', group: 'Ingestion',
    lead: 'A compact symbolic index an LLM can scan in one pass to know which drawer to open.',
    focus: ['mempalace/dialect.py', 'mempalace/closet_llm.py', 'docs/CLOSETS.md'],
    scope: 'The AAAK compression dialect (dialect.py): what it encodes (names, repeated words, concepts, key moments), the encode/decode model, and how closets act as Zettelkasten index cards pointing to drawers. closet_llm.py LLM-assisted closet building. Non-latin handling in the dialect. Make the "scan closets -> open drawer" retrieval idea concrete.' },

  { slug: 'search', title: 'Search & Retrieval', group: 'Retrieval',
    lead: 'Hybrid BM25 + vector retrieval tuned for 100% recall.',
    focus: ['mempalace/searcher.py', 'mempalace/embedding.py', 'mempalace/dedup.py', 'mempalace/fact_checker.py', 'mempalace/query_sanitizer.py'],
    scope: 'The hybrid pipeline: BM25/keyword + vector candidate union, ranking and boosting (keyword, temporal-proximity, preference patterns), the collection metric invariant, embedding model abstraction (embedding.py), dedup of results, fact-checking, and query sanitization. Tie to the benchmarks page for the recall numbers. Explain WHY hybrid beats pure-vector for recall.' },

  { slug: 'knowledge-graph', title: 'Temporal Knowledge Graph', group: 'Retrieval',
    lead: 'Entity→predicate→entity facts with validity windows, over local SQLite.',
    focus: ['mempalace/knowledge_graph.py', 'mempalace/dynamics.py', 'docs/schema.sql'],
    scope: 'The temporal KG: add/query/invalidate/timeline operations, valid_from/valid_to validity windows (bitemporal-ish), the SQLite schema (docs/schema.sql), thread-safety, and how it complements vector search. dynamics.py decay if relevant. Concrete examples of facts and timeline queries.' },

  { slug: 'backends', title: 'Storage Backends', group: 'Retrieval',
    lead: 'A pluggable storage interface — ChromaDB today, anything tomorrow.',
    focus: ['mempalace/backends/base.py', 'mempalace/backends/chroma.py', 'mempalace/backends/registry.py', 'mempalace/backends/__init__.py', 'mempalace/migrate.py'],
    scope: 'The abstract backend interface (base.py) you implement to add a store, the ChromaDB implementation (chroma.py) with HNSW capacity/health handling and the collection metric invariant, the entry-point-based registry, and ChromaDB version migration (migrate.py). Why the interface boundary matters (swap retrieval without touching the rest).' },

  { slug: 'cli', title: 'CLI & Onboarding', group: 'Interfaces',
    lead: 'The human entry point: init, mine, search, wake-up, run, status.',
    focus: ['mempalace/cli.py', 'mempalace/onboarding.py', 'mempalace/instructions_cli.py', 'mempalace/instructions/help.md', 'mempalace/instructions/init.md', 'mempalace/instructions/mine.md', 'mempalace/instructions/search.md', 'mempalace/instructions/status.md'],
    scope: 'The CLI dispatcher and each subcommand (init, mine, search, wake-up, run, status — plus sweep and any others you find). The interactive + agent-friendly zero-interactive onboarding (onboarding.py) and embedding-model choice. The instructions/*.md surfaced to agents. wake-up context injection.' },

  { slug: 'mcp-server', title: 'MCP Server & Tools', group: 'Interfaces',
    lead: 'Around 29 Model-Context-Protocol tools that let an agent live inside the palace.',
    focus: ['mempalace/mcp_server.py', 'mempalace/_stdio.py'],
    scope: 'The MCP server (mcp_server.py, the largest module). Catalog the tools grouped by purpose: palace reads (list_wings/rooms/drawers, get_drawer, search, status, traverse), writes (add/update/delete_drawer), knowledge graph (kg_add/query/invalidate/timeline/stats), tunnels (create/delete/find/follow/list), diaries (diary_read/write), taxonomy/AAAK spec/hook settings, reconnect/sync/memories_filed_away. Cover stdio protection (_stdio.py), collection reopen/reconnect crash handling, and agent diaries. Provide a tool reference table.' },

  { slug: 'hooks', title: 'Hooks & Auto-save', group: 'Interfaces',
    lead: 'Background filing that keeps memory off the chat window and under budget.',
    focus: ['mempalace/hooks_cli.py', 'hooks/mempal_save_hook.sh', 'hooks/mempal_precompact_hook.sh', 'hooks/README.md'],
    scope: 'The Claude Code hooks: Stop hook (mempal_save_hook.sh) that triggers background diary saves and auto-mining, and the PreCompact hook (mempal_precompact_hook.sh) that saves state before context compression. hooks_cli.py install/management, the silent-mode / auto_save config toggle, shallow-path guards, performance budgets (<500ms hook, <100ms injection), and why work is pushed to a background subagent (token savings story from MISSION.md).' },

  { slug: 'llm-integration', title: 'LLM Integration', group: 'Cross-cutting',
    lead: 'Local-first LLM assistance — Ollama and friends by default, BYOK external never silently.',
    focus: ['mempalace/llm_client.py', 'mempalace/llm_refine.py', 'mempalace/closet_llm.py', 'mempalace/fact_checker.py', 'mempalace/room_detector_local.py'],
    scope: 'How optional LLM steps work without ever being required: the llm_client abstraction (local runtimes Ollama/LM Studio/llama.cpp/vLLM; external Anthropic/OpenAI/Google only via explicit BYOK), retry-on-JSON-decode, entity/closet refinement (llm_refine, closet_llm), reranking and fact-checking, local room detection. Stress the local-first/never-silent-fallback principle and where the code guards it.' },

  { slug: 'i18n', title: 'Internationalization', group: 'Cross-cutting',
    lead: 'A multilingual memory: 14 UI locales, 100+ embedding languages, non-Latin entities.',
    focus: ['mempalace/i18n/__init__.py', 'mempalace/i18n/en.json', 'mempalace/i18n/ja.json', 'mempalace/i18n/zh-CN.json', 'mempalace/embedding.py', 'mempalace/dialect.py', 'mempalace/entity_detector.py'],
    scope: 'The i18n system: the JSON locale catalogs (14 languages) and i18n/__init__.py loader (case handling), the embeddinggemma-300m multilingual model vs all-MiniLM (embedding.py), and non-Latin script support in dialect + entity_detector (word boundaries, non-latin topics). Keep it concrete about what is and is not localized.' },

  { slug: 'security-privacy', title: 'Security & Privacy', group: 'Cross-cutting',
    lead: 'Privacy by architecture, plus the input-validation and hardening layers.',
    focus: ['mempalace/config.py', 'mempalace/query_sanitizer.py', 'mempalace/_stdio.py', 'mempalace/exporter.py', 'SECURITY.md', 'hooks/mempal_save_hook.sh'],
    scope: 'The privacy-by-architecture stance (no telemetry, no phone-home, data never leaves the machine) and the concrete guards: input validation sanitize_name()/sanitize_content() in config.py, prompt-contamination prevention (query_sanitizer.py), MCP stdio protection (_stdio.py), exporter symlink rejection, hardened shell hooks, and SSL handling. Frame as defense-in-depth on top of the architectural guarantee.' },

  { slug: 'maintenance', title: 'Repair, Sync & Maintenance', group: 'Cross-cutting',
    lead: 'Keeping a long-lived palace consistent, deduplicated, and recoverable.',
    focus: ['mempalace/repair.py', 'mempalace/sync.py', 'mempalace/migrate.py', 'mempalace/exporter.py', 'mempalace/dedup.py', 'mempalace/spellcheck.py', 'mempalace/sweeper.py'],
    scope: 'The operational tooling: repair.py (largest here — palace consistency checks, HNSW capacity-divergence repair, extraction-cap detection, blob heuristics), sync.py, migrate.py, exporter.py (export + symlink safety), dedup.py, spellcheck.py, sweeper.py. Emphasize crash-safety and the incremental-only / never-destroy promise.' },

  { slug: 'benchmarks', title: 'Benchmarks', group: 'Cross-cutting',
    lead: 'Reproducible recall numbers — and an unusually honest methodology.',
    focus: ['benchmarks/longmemeval_bench.py', 'benchmarks/convomem_bench.py', 'README.md'],
    scope: 'The benchmark suite and the headline claims: LongMemEval 96.6% R@5 raw (no LLM), 98.4% hybrid held-out, ≥99% with rerank; LoCoMo, ConvoMem 92.9%, MemBench 80.3%. Explain the raw-vs-hybrid-vs-rerank distinction, the held-out methodology, and the deliberate refusal to teach-to-the-test or post misleading cross-tool comparisons (the "honest benchmarks" ethos). List the bench scripts and how to reproduce.' },
]

/* ----------------------------------------------------------------------------
   Prompts.
---------------------------------------------------------------------------- */
function analystPrompt(area) {
  return [
    `You are a senior code archaeologist documenting the MemPalace repository at ${REPO}.`,
    `Your assignment: the "${area.title}" area (slug: ${area.slug}, nav group: ${area.group}).`,
    ``,
    `Read these source files in depth (use Read; use Grep/Glob to follow references you find):`,
    area.focus.map((f) => `  - ${f}`).join('\n'),
    `Also skim adjacent modules if a reference leads there. Ground EVERY claim in code you actually read.`,
    ``,
    `Scope to cover:`,
    area.scope,
    ``,
    `Return a structured analysis (the StructuredOutput tool will be enforced). Requirements:`,
    ` - slug="${area.slug}", title="${area.title}", group="${area.group}", lead="${area.lead}".`,
    ` - summary: 2-4 sentences, dense and accurate (the page TL;DR).`,
    ` - keyConcepts: 4-9 precise term/definition pairs (the vocabulary a reader needs).`,
    ` - howItWorks: 3-6 narrative sections (heading + 2-6 sentence detail, optional bullet "points"). This is the backbone of the page — explain mechanism, not marketing.`,
    ` - implementationHighlights: 2-6 notable implementation facts with file + line.`,
    ` - surprises: 2-5 genuinely non-obvious things — clever patterns, "looks simple but does X", perf tricks, gotchas, security decisions. Tag each kind = insight|gotcha|perf|security with file+line where possible. These are the highest-value items; hunt for them.`,
    ` - designDecisions: 2-5 decision/rationale pairs (WHY it is built this way; tie to CLAUDE.md principles where relevant).`,
    ` - dataFlow: one paragraph on how data moves through this area.`,
    ` - keySymbols: 4-12 important classes/functions/constants with name, kind, file, line, role.`,
    ` - codeSnippets: 1-4 SHORT (3-18 line) VERBATIM excerpts from the source, each with caption (e.g. "miner.py:412 — incremental upsert"), language, code, file, line. Copy exactly; do not paraphrase code.`,
    ` - uses / usedBy: module or page slugs this area depends on / is used by.`,
    ` - related: 3-6 {slug, why} cross-links chosen from the page slug list below.`,
    ` - keywords: 6-14 search keywords (module names, concept terms, function names).`,
    ` - stats: 0-4 small factual figures if natural (e.g. {label:"MCP tools", value:"29"}, {label:"LOC", value:"2,869"}).`,
    ``,
    `Accuracy beats completeness. If something is uncertain, omit it rather than guess. Cite real line numbers.`,
    ``,
    `Page slugs available for related[].slug and cross-links:`,
    PAGES_REF,
  ].join('\n')
}

function authorPrompt(analysis, area) {
  const a = JSON.stringify(analysis)
  return [
    `You are a technical writer producing one page of the MemPalace wiki. You are given a verified structured`,
    `analysis of the "${area.title}" area as JSON. Turn it into a polished, scannable HTML content fragment.`,
    ``,
    `You MAY Read a couple of the source files (under ${REPO}) to grab an extra exact code snippet or confirm a`,
    `line number, but do NOT invent facts beyond the analysis. Stay accurate.`,
    ``,
    `=== ANALYSIS JSON ===`,
    a,
    `=== END ANALYSIS ===`,
    ``,
    CLASS_CONTRACT,
    ``,
    `Quality bar:`,
    ` - Lead with the <div class="summary"> TL;DR, then layered depth (how it works -> highlights -> symbols -> decisions -> data flow).`,
    ` - Convert keyConcepts -> <dl class="concepts">, keySymbols -> <table class="symbols"> with <code>file.py:line</code> locations, codeSnippets -> <div class="code-caption"> + <pre><code class="language-LANG"> (HTML-escape the code!).`,
    ` - Weave each surprise into a matching <div class="callout KIND"> with an evocative title. At least 2 callouts.`,
    ` - 3-6 related-cards plus inline cross-links in the prose. Use real slugs only.`,
    ` - Dense but readable. No marketing fluff. British/American spelling either is fine; match the repo (American).`,
    ``,
    `WRITE TWO FILES (use the Write tool), then return the DONE summary:`,
    ``,
    `1) Fragment: ${PARTS}/${area.slug}.inc.html`,
    `   -> exactly the content fragment described above (no <html>/<head>/<main>/nav/script).`,
    ``,
    `2) Data sidecar: ${DATA}/${area.slug}.json`,
    `   -> a single MINIFIED valid JSON object (no comments, no trailing commas) with these keys:`,
    `      slug, title, group, file (="${area.slug}.html"), lead, summary,`,
    `      keywords (array), concepts (= keyConcepts array of {term,definition}),`,
    `      symbols (= keySymbols), surprises (array of {title,detail,kind,file,line}),`,
    `      designDecisions, stats, related (array of {slug,why}), uses, usedBy,`,
    `      searchDoc: { url:"${area.slug}.html", title, group, headings:[the <h2> texts you used],`,
    `                   keywords:[...], summary, body:"250-500 words of PLAIN text (no HTML) summarizing the page for full-text search" }`,
    ``,
    `Return DONE: {slug, wroteFragment, wroteData, sectionCount, snippetCount, note}.`,
  ].join('\n')
}

/* ----------------------------------------------------------------------------
   Phase 1 + 2: analyze -> author, pipelined per area.
---------------------------------------------------------------------------- */
log(`Analyzing & authoring ${AREAS.length} area pages…`)
const areaResults = await pipeline(
  AREAS,
  (area) => agent(analystPrompt(area), { schema: ANALYSIS_SCHEMA, phase: 'Analyze', label: `analyze:${area.slug}`, agentType: 'Explore' }),
  (analysis, area) =>
    agent(authorPrompt(analysis, area), { schema: DONE_SCHEMA, phase: 'Author', label: `author:${area.slug}` })
      .then((done) => ({ slug: area.slug, done }))
)
const okAreas = areaResults.filter(Boolean)
log(`Area pages authored: ${okAreas.length}/${AREAS.length}`)

/* ----------------------------------------------------------------------------
   Phase 3: synthesis pages that aggregate the sidecars.
---------------------------------------------------------------------------- */
phase('Synthesize')

const synthCommon = `
All area sidecars now exist as JSON at ${DATA}/*.json (one per page: ${AREAS.map((a) => a.slug).join(', ')}).
Read them (and the repo files you need under ${REPO}) to aggregate. Then write a content fragment + a data
sidecar following the SAME conventions as the other pages.

${CLASS_CONTRACT}
`.trim()

function synthWriteInstructions(slug, title, group, file) {
  return [
    `WRITE TWO FILES then return DONE {slug, wroteFragment, wroteData, sectionCount, snippetCount, note}:`,
    `1) ${PARTS}/${slug}.inc.html  -> the content fragment (no <html>/<head>/<main>/nav/script).`,
    `2) ${DATA}/${slug}.json -> minified valid JSON: { slug:"${slug}", title:"${title}", group:"${group}",`,
    `   file:"${file}", lead, summary, keywords:[...],`,
    `   searchDoc:{ url:"${file}", title:"${title}", group:"${group}", headings:[...], keywords:[...], summary, body:"250-500 words plain text" } }`,
  ].join('\n')
}

const indexPrompt = [
  `You are building the LANDING PAGE (Home) of the MemPalace wiki (slug: index, group: Overview, file index.html).`,
  ``,
  `Read ${REPO}/README.md, ${REPO}/MISSION.md, ${REPO}/CLAUDE.md, and ALL ${DATA}/*.json sidecars.`,
  ``,
  `The fragment must include, in this order:`,
  ` 1. <header class="page-head"> with kicker "MemPalace Wiki", <h1>MemPalace</h1>, and a <p class="lead"> one-liner`,
  `    ("Local-first AI memory — verbatim storage, pluggable retrieval, ~96.6% R@5 with zero API calls.").`,
  ` 2. A <div class="summary"> explaining in 3-4 sentences what MemPalace is and what this wiki is for (humans AND agents).`,
  ` 3. A <div class="stat-grid"> of 5-6 <div class="stat"><div class="num">N</div><div class="lbl">label</div></div>`,
  `    using real figures you can verify: ~30k lines of Python, ~48 modules, 29 MCP tools, 14 UI locales, 96.6% R@5 raw, version 3.3.6.`,
  ` 4. <h2>The knowledge graph</h2> with a <div class="graph-wrap"><pre class="mermaid">…</pre></div> Mermaid 'graph LR' (or TD)`,
  `    diagram connecting the major areas. Use node ids = slugs and label them; draw real relationships`,
  `    (e.g. mining-projects --> search, search --> backends, mcp-server --> knowledge-graph, hooks --> mining-conversations,`,
  `    aaak-dialect --> search, entities --> palace-model, etc.). Make node clicks navigate by adding lines like`,
  `    \`click search "search.html"\`. Keep it readable (12-20 nodes grouped sensibly). IMPORTANT: inside the mermaid`,
  `    block, write plain diagram text only — no HTML entities; node labels in [brackets] or quotes.`,
  ` 5. <h2>Explore the palace</h2> with a <div class="tile-grid"> of <a class="tile" href="SLUG.html"><div class="tile-icon">EMOJI</div><h3>Title</h3><p>one-line</p></a>`,
  `    — one tile per major area (all 19 other pages incl. glossary & surprises). Pick a fitting emoji each.`,
  ` 6. <h2>Design principles</h2> summarizing the non-negotiables from CLAUDE.md (verbatim-always, incremental-only,`,
  `    entity-first, local-first/zero-external-API, performance budgets, privacy-by-architecture, background-everything),`,
  `    each as a <dl class="concepts"> entry or a callout.`,
  ` 7. A <div class="related"> linking to architecture, palace-model, glossary, surprises.`,
  `Include at least one <div class="callout insight"> highlighting the core idea (verbatim storage + structured index + unstructured retrieval).`,
  ``,
  synthCommon,
  ``,
  synthWriteInstructions('index', 'MemPalace', 'Overview', 'index.html'),
].join('\n')

const glossaryPrompt = [
  `You are building the GLOSSARY page of the MemPalace wiki (slug: glossary, group: Overview, file glossary.html).`,
  ``,
  `Read ALL ${DATA}/*.json sidecars and aggregate every distinct domain term from their "concepts" arrays, plus`,
  `the core palace vocabulary (wing, room, drawer, closet, hallway, tunnel, diary, AAAK, method of loci, Zettelkasten,`,
  `L0–L3 wake-up stack, HNSW, BM25, hybrid search, embedding, BYOK, local-first, verbatim, incremental ingest,`,
  `entity disambiguation, corpus origin, validity window / temporal KG, sweep, mega-file split, virtual line numbering,`,
  `COCA content-word filter, MCP, hook, precompact, idempotent). Resolve duplicates; keep the best definition.`,
  ``,
  `Fragment requirements:`,
  ` - header (kicker "Overview", <h1>Glossary</h1>, lead "Every term in the palace, defined and linked.").`,
  ` - <div class="summary"> one-liner.`,
  ` - A short "jump to letter" note is optional. Then group terms under <h2>A</h2>, <h2>B</h2>, … letter headings`,
  `   (only letters that have terms), each with a <dl class="concepts">. For EACH term, end its <dd> with a`,
  `   "→ <a href='SLUG.html'>Page Title</a>" pointer to the page that best covers it (choose from the sidecars).`,
  ` - 40+ terms if the material supports it. Accurate definitions only.`,
  ` - a <div class="related"> to architecture, palace-model, index, surprises.`,
  ``,
  synthCommon,
  ``,
  synthWriteInstructions('glossary', 'Glossary', 'Overview', 'glossary.html'),
].join('\n')

const surprisesPrompt = [
  `You are building the SURPRISES & GOTCHAS page (slug: surprises, group: Cross-cutting, file surprises.html) —`,
  `the highest-signal page in the wiki: the clever, non-obvious, and "watch out" findings from across the codebase.`,
  ``,
  `Read ALL ${DATA}/*.json sidecars and aggregate their "surprises" arrays. You MAY also Grep/Read the repo to add`,
  `a few genuinely surprising findings the per-area agents missed. Deduplicate and curate hard — keep the best.`,
  ``,
  `Fragment requirements:`,
  ` - header (kicker "Cross-cutting", <h1>Surprises &amp; Gotchas</h1>, lead "The clever, the subtle, and the watch-outs.").`,
  ` - <div class="summary"> explaining what this page collects.`,
  ` - Group findings under <h2>💡 Insights &amp; clever patterns</h2>, <h2>⚠️ Gotchas</h2>, <h2>⚡ Performance</h2>,`,
  `   <h2>🔒 Security</h2>. Under each, render every finding as a <div class="callout KIND"> with a bold title,`,
  `   the explanation, the <code>file.py:line</code>, and a "See <a href='SLUG.html'>Page</a>" cross-link to the`,
  `   owning area page.`,
  ` - Aim for 18-30 curated findings total. Each must be accurate and traceable to code.`,
  ` - a <div class="related"> linking to several relevant area pages.`,
  ``,
  synthCommon,
  ``,
  synthWriteInstructions('surprises', 'Surprises & Gotchas', 'Cross-cutting', 'surprises.html'),
].join('\n')

const synth = await parallel([
  () => agent(indexPrompt, { schema: DONE_SCHEMA, phase: 'Synthesize', label: 'synth:index' }),
  () => agent(glossaryPrompt, { schema: DONE_SCHEMA, phase: 'Synthesize', label: 'synth:glossary' }),
  () => agent(surprisesPrompt, { schema: DONE_SCHEMA, phase: 'Synthesize', label: 'synth:surprises' }),
])

const summary = {
  generated: GEN_DATE,
  areaPages: okAreas.map((r) => r.slug),
  synthPages: synth.filter(Boolean).map((s) => s.slug),
  areaCount: okAreas.length,
  synthCount: synth.filter(Boolean).length,
}
log(`Done. Area pages: ${summary.areaCount}, synthesis pages: ${summary.synthCount}.`)
return summary
