import { QueryResultRow } from "pg";
import { getPool } from "@/lib/db";
import { resourceTypes } from "@/lib/library";

export type Collection = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isResearch: boolean;
  createdAt: string;
};

export type Resource = {
  id: string;
  collection: {
    name: string;
    slug: string;
  };
  slug: string;
  title: string;
  type: string;
  url: string | null;
  authors: string[];
  publisher: string | null;
  publishedDate: string | null;
  addedAt: string;
  updatedAt: string;
  tags: string[];
  status: string;
  dateRead: string | null;
  cliffNotes: string | null;
  cliffNotesModel: string | null;
  personalNotes: string | null;
  coverImageUrl: string | null;
  sourceDomain: string | null;
  isEssential: boolean;
};

export type ResourceQuery = {
  collection?: string;
  types?: string[];
  status?: string;
  tags?: string[];
  q?: string;
  limit?: number;
  offset?: number;
};

type CollectionRow = QueryResultRow & {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_research: boolean;
  created_at: string;
};

type ResourceRow = QueryResultRow & {
  id: string;
  collection_name: string;
  collection_slug: string;
  slug: string;
  title: string;
  type: string;
  url: string | null;
  authors: string[];
  publisher: string | null;
  published_date: string | null;
  added_at: string;
  updated_at: string;
  tags: string[];
  status: string;
  date_read: string | null;
  cliff_notes: string | null;
  cliff_notes_model: string | null;
  personal_notes: string | null;
  cover_image_url: string | null;
  source_domain: string | null;
  is_essential: boolean;
};

type MetaCountRow = QueryResultRow & {
  collection_slug: string;
  type_counts: Record<string, number> | null;
  status_counts: Record<string, number> | null;
  resource_count: string;
};

type TagRow = QueryResultRow & {
  collection_slug: string;
  tag: string;
  count: string;
};

const validStatuses = new Set(["unread", "reading", "read"]);

export function parseResourceQuery(searchParams: URLSearchParams): ResourceQuery {
  const types = uniqueValues([
    ...splitParam(searchParams.get("type")),
    ...searchParams.getAll("type").flatMap(splitParam),
  ]).filter((type) => resourceTypes.includes(type as (typeof resourceTypes)[number]));

  const tags = uniqueValues([
    ...splitParam(searchParams.get("tag")),
    ...searchParams.getAll("tag").flatMap(splitParam),
  ]);

  const status = searchParams.get("status")?.trim();
  const limit = clampInteger(searchParams.get("limit"), 50, 1, 100);
  const offset = clampInteger(searchParams.get("offset"), 0, 0, 10_000);

  return {
    collection: optionalString(searchParams.get("collection")),
    types,
    status: status && validStatuses.has(status) ? status : undefined,
    tags,
    q: optionalString(searchParams.get("q")),
    limit,
    offset,
  };
}

export async function getCollections() {
  const result = await getPool().query<CollectionRow>(
    `
      select id, name, slug, description, is_research, created_at
      from public.collections
      order by created_at asc, name asc
    `,
  );

  return result.rows.map(toCollection);
}

export async function getLibraryMeta() {
  const [collections, counts, tags] = await Promise.all([
    getCollections(),
    getPool().query<MetaCountRow>(
      `
        select
          c.slug as collection_slug,
          count(r.id) as resource_count,
          jsonb_object_agg(r.type, type_count) filter (where r.type is not null) as type_counts,
          jsonb_object_agg(r.status, status_count) filter (where r.status is not null) as status_counts
        from public.collections c
        left join (
          select
            collection_id,
            type,
            status,
            count(*) over (partition by collection_id, type) as type_count,
            count(*) over (partition by collection_id, status) as status_count,
            id
          from public.resources
        ) r on r.collection_id = c.id
        group by c.slug
        order by c.slug
      `,
    ),
    getPool().query<TagRow>(
      `
        select c.slug as collection_slug, tag, count(*) as count
        from public.resources r
        join public.collections c on c.id = r.collection_id
        cross join lateral unnest(r.tags) as tag
        group by c.slug, tag
        order by count(*) desc, tag asc
      `,
    ),
  ]);

  return collections.map((collection) => ({
    ...collection,
    resourceCount:
      Number(
        counts.rows.find((row) => row.collection_slug === collection.slug)
          ?.resource_count,
      ) || 0,
    typeCounts:
      counts.rows.find((row) => row.collection_slug === collection.slug)
        ?.type_counts ?? {},
    statusCounts:
      counts.rows.find((row) => row.collection_slug === collection.slug)
        ?.status_counts ?? {},
    tags: tags.rows
      .filter((row) => row.collection_slug === collection.slug)
      .map((row) => ({
        tag: row.tag,
        count: Number(row.count),
      })),
  }));
}

export async function getResources(query: ResourceQuery = {}) {
  const filters = buildResourceFilters(query);

  const result = await getPool().query<ResourceRow>(
    `
      ${resourceSelectSql()}
      ${filters.where}
      order by r.is_essential desc, r.added_at desc, r.title asc
      limit $${filters.values.length + 1}
      offset $${filters.values.length + 2}
    `,
    [...filters.values, query.limit ?? 50, query.offset ?? 0],
  );

  return result.rows.map(toResource);
}

export async function getResourceBySlug(slug: string) {
  const result = await getPool().query<ResourceRow>(
    `
      ${resourceSelectSql()}
      where r.slug = $1
      limit 1
    `,
    [slug],
  );

  return result.rows[0] ? toResource(result.rows[0]) : null;
}

function buildResourceFilters(query: ResourceQuery) {
  const where = ["c.is_research = true"];
  const values: Array<string | string[]> = [];

  if (query.collection) {
    values.push(query.collection);
    where.push(`c.slug = $${values.length}`);
  }

  if (query.types?.length) {
    values.push(query.types);
    where.push(`r.type = any($${values.length})`);
  }

  if (query.status) {
    values.push(query.status);
    where.push(`r.status = $${values.length}`);
  }

  if (query.tags?.length) {
    values.push(query.tags);
    where.push(`r.tags @> $${values.length}::text[]`);
  }

  if (query.q) {
    values.push(query.q);
    where.push(`
      to_tsvector(
        'simple',
        concat_ws(
          ' ',
          r.title,
          array_to_string(r.authors, ' '),
          array_to_string(r.tags, ' '),
          r.publisher,
          r.cliff_notes,
          r.personal_notes
        )
      ) @@ plainto_tsquery('simple', $${values.length})
    `);
  }

  return {
    values,
    where: `where ${where.join(" and ")}`,
  };
}

function resourceSelectSql() {
  return `
    select
      r.id,
      c.name as collection_name,
      c.slug as collection_slug,
      r.slug,
      r.title,
      r.type,
      r.url,
      r.authors,
      r.publisher,
      r.published_date,
      r.added_at,
      r.updated_at,
      r.tags,
      r.status,
      r.date_read,
      r.cliff_notes,
      r.cliff_notes_model,
      r.personal_notes,
      r.cover_image_url,
      r.source_domain,
      r.is_essential
    from public.resources r
    join public.collections c on c.id = r.collection_id
  `;
}

function toCollection(row: CollectionRow): Collection {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    isResearch: row.is_research,
    createdAt: row.created_at,
  };
}

function toResource(row: ResourceRow): Resource {
  return {
    id: row.id,
    collection: {
      name: row.collection_name,
      slug: row.collection_slug,
    },
    slug: row.slug,
    title: row.title,
    type: row.type,
    url: row.url,
    authors: row.authors ?? [],
    publisher: row.publisher,
    publishedDate: row.published_date,
    addedAt: row.added_at,
    updatedAt: row.updated_at,
    tags: row.tags ?? [],
    status: row.status,
    dateRead: row.date_read,
    cliffNotes: row.cliff_notes,
    cliffNotesModel: row.cliff_notes_model,
    personalNotes: row.personal_notes,
    coverImageUrl: row.cover_image_url,
    sourceDomain: row.source_domain,
    isEssential: row.is_essential,
  };
}

function splitParam(value: string | null) {
  return value
    ? value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
    : [];
}

function optionalString(value: string | null) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values));
}

function clampInteger(
  value: string | null,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  if (value === null) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, minimum), maximum);
}
