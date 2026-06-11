# Readable

Readable is a private, AI-legible personal research library. It is public to the
people who have the link key, private to crawlers, and editable only by the
owner.

This repository is currently at the bootstrap milestone: Next.js App Router,
TypeScript, Tailwind CSS, Vercel deployment config, Supabase schema files, and
starter seed data.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Supabase Postgres
- Vercel hosting
- Anthropic for future ingestion drafts

## Setup

Install dependencies:

```bash
npm install
```

Create local env values from the template:

```bash
cp .env.example .env.local
```

Required env keys:

- `DATABASE_URL`
- `ADMIN_PASSWORD_HASH`
- `SESSION_SECRET`
- `LIBRARY_KEY`
- `ANTHROPIC_API_KEY`
- `INGEST_MODEL`

Apply the SQL in `supabase/migrations` to the Supabase project, then seed:

```bash
npm run db:seed
```

Run locally:

```bash
npm run dev
```

## Current Scope

The skeleton exposes placeholder versions of the V1 routes:

- `/`
- `/llms.txt`
- `/api/meta`
- `/api/resources`
- `/api/resources/[slug]`
- `/export.md`
- `/api/keepalive`

The full read path, admin editing, ingestion flow, and AI access layer will be
implemented in later milestones.
