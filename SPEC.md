# SPEC.md — Personal Research Library
**Name:** *Readable*
**Version:** Draft 2 · April 2026
**Owner:** [you]
**Builder:** Claude Code, using this spec + the design mockup (`design-mockup.html`) as the visual contract

---

## 1. What this is

A personal, web-based library of resources (books, articles, blog posts, videos, papers, etc.) that the owner curates, annotates, and tracks. It is **public to read, private to edit**. It is designed from the start to be **legible to AI agents** — both as a context source the owner can point an AI chat at, and as a structured API an agent can query directly.

The platform is **general-purpose** (any topic can live in it, organized into collections), but launches with one focused collection: **"Design × AI × Learning"** — research and expert opinion at the intersection of design, AI/LLMs, and K-12 teaching & learning.

### Non-goals (V1)
- No multi-user accounts, social features, comments, or sharing workflows
- No native mobile app (responsive web only)
- No full-text storage of copyrighted works — cliff notes and metadata only
- No semantic/embedding search (V2)

---

## 2. Core concepts

**Collection** — A named shelf (e.g., "Design × AI × Learning", "Woodworking", "Family"). Every resource belongs to exactly one collection. Collections can be marked `is_research: true|false`; AI-facing endpoints default to research collections only, so personal content never pollutes the research context.

**Resource** — A single item in the library. Has metadata, cliff notes, personal notes, and read status.

**Cliff notes** — A structured summary of the resource's main insights and takeaways. AI-drafted on ingestion, human-edited. Distinct from personal notes.

**Personal notes** — The owner's own commentary, connections, disagreements. Never AI-generated.

---

## 3. Data model

```sql
-- collections
id            uuid PK
name          text UNIQUE
slug          text UNIQUE
description   text
is_research   boolean DEFAULT true
created_at    timestamptz

-- resources
id                uuid PK
collection_id     uuid FK -> collections
slug              text UNIQUE          -- for clean URLs /r/{slug}
title             text NOT NULL
type              text NOT NULL        -- enum, see below
url               text                 -- null for print-only
authors           text[]               -- ["Daniel Willingham"]
publisher         text                 -- site/journal/imprint, e.g. "Substack", "MIT Press"
published_date    date                 -- original publication (year-only ok: use Jan 1)
added_at          timestamptz
updated_at        timestamptz
tags              text[]               -- includes judgment tags if wanted (e.g. 'skeptic', 'foundational')
status            text DEFAULT 'unread'-- 'unread' | 'reading' | 'read'
date_read         date
cliff_notes       text                 -- markdown
cliff_notes_model text                 -- e.g. 'claude-haiku-4-5' (provenance)
personal_notes    text                 -- markdown
cover_image_url   text
source_domain     text                 -- derived from url, for favicon/grouping
is_essential      boolean DEFAULT false-- owner's "star" flag
```

**Resource types (enum):** `book` · `paper` · `article` · `video` · `podcast` · `website` — six types, which are also the six type filters in the UI. ("Article" covers blog posts, essays, and reports; "website" covers ongoing publications like blogs/Substacks and tools; "paper" covers academic papers and formal research reports.)

**Indexes:** full-text search index (Postgres `tsvector`) over `title + authors + tags + cliff_notes + personal_notes`; btree on `collection_id`, `status`, `type`.

---

## 4. Features — V1

### 4.1 Access model: link-key read, single-admin write

Reading is **not public and not crawlable**, but requires no login — access works like a Google Doc "anyone with the link" share:

- A long random key lives in env var `LIBRARY_KEY`. Any read URL is valid when it carries `?k={LIBRARY_KEY}` as a query parameter (e.g., `https://{domain}/?k=8fj2…`).
- On first visit with a valid `k`, the server sets a lightweight cookie so humans can navigate normally without the param appearing on every click. AI agents and API consumers simply include `?k=` on each request — which they will, because the owner hands them the full keyed URL.
- Requests without key or cookie get a minimal "this is a private library" page — no content, no resource titles.
- Anti-crawl belt-and-suspenders: `robots.txt` disallows everything; all pages send `X-Robots-Tag: noindex, nofollow` and `Referrer-Policy: no-referrer` (so the key never leaks via outbound link referrers).
- Rotating access = changing one env var; old links die instantly.
- **Known tradeoff (accepted):** keys in URLs can leak through logs or careless link-sharing. The threat model here is *casual discovery and search engines*, not determined attackers. Appropriate for this content.

Writing is separate and stricter:
- One admin password stored as env var (`ADMIN_PASSWORD_HASH`, bcrypt).
- `/admin/login` sets a signed, httpOnly session cookie (iron-session). All mutating routes verify it. The link key never grants write access.

### 4.2 Add a resource — two paths

**Path A: by URL (primary flow)**
1. Admin pastes a URL into the "Add" box.
2. Server fetches the page, extracts readable text + metadata (title, author, published date, og:image) using a readability library.
3. Server calls the Anthropic API (model from env: `INGEST_MODEL`, default `claude-haiku-4-5`) with the extracted text. One call returns structured JSON:
   - suggested `title`, `authors`, `published_date`, `type`, `publisher`
   - suggested `tags` (3–6, drawn from the collection's existing tag vocabulary where possible — pass current tags in the prompt)
   - draft `cliff_notes` (markdown: 3–6 key insights/takeaways, ~150–300 words, faithful to the source, no fluff)
4. Admin sees a **review screen** pre-filled with everything. Nothing saves without human review. Admin edits, adjusts tags, picks collection, saves.
5. On fetch failure (paywall, JS-only site): fall back to Path B with the URL pre-filled.
6. **Video/podcast URLs** (YouTube, Vimeo, etc.): use oEmbed for metadata (title, channel/creator, publish date, thumbnail → cover image). Cliff notes drafted from the video description plus transcript when one can be fetched; when no transcript is available, fall back to model-knowledge drafting (labeled as such) or let the admin paste a transcript into the review screen.

**Path B: manual (books, print, paywalled)**
Blank form, same fields. Optional "Draft cliff notes with AI" button: sends title + authors to the API, model drafts notes from its knowledge of the work, clearly labeled as drafted-from-model-knowledge for the admin to verify. Cover image: allow paste-a-URL.

### 4.3 Tags: stored globally, presented per-collection
Tags are plain strings on resources (no tags table). The *vocabulary* shown anywhere — autocomplete in the editor, suggested tags during ingestion, filter options — is always computed from tags actually in use **within the current collection**. Result: tags behave as collection-specific without schema rigidity; the same string (e.g., `design`) may appear in multiple collections, which is occasionally useful. Editorial judgments that were once dedicated fields (stance, authoritativeness) are expressed as ordinary tags when wanted (e.g., `skeptic`, `optimist`, `foundational`, `landmark`).

### 4.4 Browse, search, filter
- Library view: a single-column feed (Substack-style rows: text left, cover thumbnail right), max-width ~720px. Filters in two stacked rows: **Status** as a single-select segmented control (All / Unread / Reading / Read), and **Type** as a row of **multi-select** toggle pills (Books / Papers / Articles / Video / Podcasts / Websites) — all pills always visible, wrapping on narrow screens, never scroll-clipped; no pills selected = all types. Tag filtering via tapping tags on detail pages or a tag picker. Sort: added date (default), published date, title.
- Typography system: exactly two text sizes outside headers — 17px for anything read or typed (serif for reading content, sans for inputs), 14px for all labels/bylines/buttons/meta — differentiated by weight, caps, and color, never by additional sizes. Secondary grays must stay ≥4.5:1 contrast on white.
- Search box in the header: Postgres full-text across title/authors/tags/notes. Debounced, instant.
- Resource detail page at `/r/{slug}`: full metadata, cover, tags, cliff notes, personal notes, link out, read-status control.
- Read tracking: a tri-state status dot on rows and detail (empty = unread, half = reading, filled = read); tapping cycles (admin only — display-only for visitors). "Read" sets `date_read` to today (editable).

### 4.5 The AI access layer
| Endpoint | Purpose |
|---|---|
| `/llms.txt` | Markdown doc explaining what this library is, who owns it, what collections exist, and how to use the endpoints below. Written for an AI reader. |
| `/api/resources` | JSON list. Query params: `collection`, `type`, `status`, `tag`, `q` (full-text), `limit`, `offset`. Defaults to research collections only; `include_personal=true` overrides. |
| `/api/resources/{slug}` | Single resource, full JSON incl. cliff notes + personal notes. |
| `/api/meta` | Library description, collection list, tag vocabulary, counts. |
| `/export.md` | Entire library (or `?collection=`) as one clean markdown doc: each resource = heading + metadata line + cliff notes + personal notes. This is the "paste into any AI chat" artifact. |

All read-only, requiring the `?k=` link key (CORS-open, lightly rate-limited, e.g., 60 req/min/IP). Responses include an `_about` field linking to the keyed `/llms.txt` URL.

**Usage pattern this enables:** owner (or anyone they've shared the keyed link with) starts an AI chat and pastes `https://{domain}/llms.txt?k=…` or `/export.md?k=…&collection=design-ai-learning`. The AI can fetch, understand the library, query the API with the same key, answer "what does my library say about formative assessment?", and point to specific resources by their keyed URLs.

### 4.6 UX requirements
- Responsive: gracious on phone (single column, compact filters — apply lessons from the reading-list mockup: no sticky filter bloat, light theme forced via `color-scheme` to defeat in-app browser dark-inversion).
- Fast: server-render list views; optimistic UI on status toggles.
- The design mockup (`design-mockup.html`) is the binding visual reference: typography, palette, card anatomy, filter pattern.
- Empty states, loading states, and error states designed, not default.

---

## 5. Tech stack & deployment

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router, TypeScript) | Server components for list/detail; route handlers for API |
| Database | Supabase (Postgres) | Use supabase-js server-side only; full-text via `tsvector` |
| Hosting | Vercel | Owner's existing account, GitHub integration |
| AI | Anthropic API | `INGEST_MODEL` env, default `claude-haiku-4-5`; swappable to `claude-sonnet-4-6` |
| Content extraction | `@mozilla/readability` + `jsdom` (or `unfluff`) | In a route handler; 10s timeout |
| Auth/session | `iron-session` | Signed cookie, bcrypt password check |
| Styling | Tailwind or vanilla CSS — match the mockup either way | No component library required |

**Env vars:** `DATABASE_URL` (or Supabase keys), `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, `LIBRARY_KEY`, `ANTHROPIC_API_KEY`, `INGEST_MODEL`.

**Supabase free-tier note:** free projects pause after 7 days of database inactivity. Mitigation built into V1: a Vercel cron job (Hobby plan includes daily crons) hits `/api/keepalive` once a day, which runs a trivial `SELECT 1` against the database, resetting the inactivity timer. Zero cost, zero maintenance.

**Repo conventions for Claude Code:** keep this file at repo root; maintain `CHANGELOG.md`; seed script (`/scripts/seed.ts`) imports the starter dataset (§7).

---

## 6. Build milestones (suggested order for Claude Code)

1. **Skeleton** — Next.js app, Supabase schema + migrations, seed script, deploy pipeline green on Vercel.
2. **Read path** — library view with filters/search, resource detail page, matching the mockup.
3. **Admin path** — login, manual add/edit/delete, read-status tracking.
4. **Ingestion** — URL fetch → extraction → Haiku draft → review screen flow.
5. **AI access layer** — llms.txt, JSON API, export.md, rate limiting.
6. **Polish** — mobile pass, empty/error states, favicon/OG tags, Lighthouse check.

Each milestone independently shippable. Owner tests on real phone after milestones 2, 4, 6.

---

## 7. Seed content

Initial dataset: the ~45 resources from the "Learning, Teaching & AI" reading list (already compiled, with descriptions, stances, types, links). Provide as `seed/resources.json`. Cliff notes for these may be drafted in bulk via the ingestion pipeline after launch.

---

## 8. V2 roadmap (explicitly out of scope for V1)

- **AI suggestions:** "based on this library, recommend resources I'm missing" (Anthropic API + web search tool)
- **Semantic search** via embeddings (pgvector is available in Supabase — schema-ready, just unused in V1)
- **MCP server** so the library appears as a first-class connector in Claude
- **RSS/Substack monitoring:** auto-detect new posts from followed blogs, queue for triage
- **Reading queue / priorities**, highlights capture, multi-collection resources
- **Public share pages** per collection with custom intro text

---

## 9. Decisions log

| # | Decision | Resolution |
|---|---|---|
| 1 | App name | **Readable** (vercel.app subdomain to start; custom domain optional later) |
| 2 | Read access | **Link-key model** (§4.1) — not public, not crawlable, agent-accessible via `?k=` |
| 3 | Visual direction | **Substack-inspired minimalism** — white field, Helvetica for UI/titles, Source Serif 4 for reading text, single orange accent, whitespace over borders; `design-mockup.html` (v2) is the binding reference |
| 4 | Cover images | Hotlink URLs in V1 (Supabase storage available for V2 if needed) |
| 5 | Database | Supabase free tier + daily keepalive cron (§5) |
| 6 | Cliff notes model | `claude-haiku-4-5` default, swappable via env (~1¢/article) |
