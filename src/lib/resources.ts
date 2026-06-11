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
  status: ResourceStatus;
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

export type ResourceStatus = "unread" | "reading" | "read";

export type ResourceWriteInput = {
  title: string;
  collectionSlug: string;
  type: string;
  url?: string | null;
  authors?: string[];
  publisher?: string | null;
  publishedDate?: string | null;
  tags?: string[];
  status?: ResourceStatus;
  dateRead?: string | null;
  cliffNotes?: string | null;
  cliffNotesModel?: string | null;
  personalNotes?: string | null;
  coverImageUrl?: string | null;
  isEssential?: boolean;
};

export type ResourceWriteValidation =
  | {
      ok: true;
      data: ResourceWriteInput;
    }
  | {
      ok: false;
      errors: string[];
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
  status: ResourceStatus;
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

export const resourceStatuses = ["unread", "reading", "read"] as const;

const validStatuses = new Set<string>(resourceStatuses);

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

export function isResourceStatus(value: unknown): value is ResourceStatus {
  return typeof value === "string" && validStatuses.has(value);
}

export function parseResourceWriteInput(value: unknown): ResourceWriteValidation {
  if (!value || typeof value !== "object") {
    return {
      ok: false,
      errors: ["Request body must be an object."],
    };
  }

  const input = value as Record<string, unknown>;
  const errors: string[] = [];
  const title = stringValue(input.title);
  const collectionSlug = stringValue(input.collectionSlug);
  const type = stringValue(input.type);
  const status = stringValue(input.status) || "unread";

  if (!title) {
    errors.push("title is required.");
  }

  if (!collectionSlug) {
    errors.push("collectionSlug is required.");
  }

  if (!resourceTypes.includes(type as (typeof resourceTypes)[number])) {
    errors.push("type is invalid.");
  }

  if (!isResourceStatus(status)) {
    errors.push("status is invalid.");
  }

  for (const [field, rawValue] of [
    ["publishedDate", input.publishedDate],
    ["dateRead", input.dateRead],
  ] as const) {
    const date = stringValue(rawValue);

    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push(`${field} must be YYYY-MM-DD.`);
    }
  }

  if (errors.length) {
    return {
      ok: false,
      errors,
    };
  }

  return {
    ok: true,
    data: {
      title,
      collectionSlug,
      type,
      url: nullableString(stringValue(input.url)),
      authors: arrayValue(input.authors),
      publisher: nullableString(stringValue(input.publisher)),
      publishedDate: nullableDate(stringValue(input.publishedDate)),
      tags: arrayValue(input.tags),
      status: status as ResourceStatus,
      dateRead: nullableDate(stringValue(input.dateRead)),
      cliffNotes: nullableString(stringValue(input.cliffNotes)),
      cliffNotesModel: nullableString(stringValue(input.cliffNotesModel)),
      personalNotes: nullableString(stringValue(input.personalNotes)),
      coverImageUrl: nullableString(stringValue(input.coverImageUrl)),
      isEssential: input.isEssential === true,
    },
  };
}

export async function updateResourceStatus(
  slug: string,
  status?: ResourceStatus,
) {
  const current = await getPool().query<{ status: ResourceStatus }>(
    `
      select status
      from public.resources
      where slug = $1
      limit 1
    `,
    [slug],
  );

  const currentStatus = current.rows[0]?.status;

  if (!currentStatus) {
    return null;
  }

  const nextStatus = status ?? nextResourceStatus(currentStatus);
  const dateRead =
    nextStatus === "read" ? new Date().toISOString().slice(0, 10) : null;

  await getPool().query(
    `
      update public.resources
      set status = $2, date_read = $3
      where slug = $1
    `,
    [slug, nextStatus, dateRead],
  );

  return getResourceBySlug(slug);
}

export async function createResource(input: ResourceWriteInput) {
  const normalized = normalizeResourceWriteInput(input);
  const collectionId = await getCollectionId(normalized.collectionSlug);

  if (!collectionId) {
    return null;
  }

  const slug = await createUniqueSlug(slugify(normalized.title));

  await getPool().query(
    `
      insert into public.resources (
        collection_id,
        slug,
        title,
        type,
        url,
        authors,
        publisher,
        published_date,
        tags,
        status,
        date_read,
        cliff_notes,
        cliff_notes_model,
        personal_notes,
        cover_image_url,
        source_domain,
        is_essential
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    `,
    [
      collectionId,
      slug,
      normalized.title,
      normalized.type,
      normalized.url,
      normalized.authors,
      normalized.publisher,
      normalized.publishedDate,
      normalized.tags,
      normalized.status,
      normalized.dateRead,
      normalized.cliffNotes,
      normalized.cliffNotesModel,
      normalized.personalNotes,
      normalized.coverImageUrl,
      sourceDomain(normalized.url),
      normalized.isEssential,
    ],
  );

  return getResourceBySlug(slug);
}

export async function updateResource(slug: string, input: ResourceWriteInput) {
  const normalized = normalizeResourceWriteInput(input);
  const collectionId = await getCollectionId(normalized.collectionSlug);

  if (!collectionId) {
    return null;
  }

  const result = await getPool().query<{ slug: string }>(
    `
      update public.resources
      set
        collection_id = $2,
        title = $3,
        type = $4,
        url = $5,
        authors = $6,
        publisher = $7,
        published_date = $8,
        tags = $9,
        status = $10,
        date_read = $11,
        cliff_notes = $12,
        cliff_notes_model = $13,
        personal_notes = $14,
        cover_image_url = $15,
        source_domain = $16,
        is_essential = $17
      where slug = $1
      returning slug
    `,
    [
      slug,
      collectionId,
      normalized.title,
      normalized.type,
      normalized.url,
      normalized.authors,
      normalized.publisher,
      normalized.publishedDate,
      normalized.tags,
      normalized.status,
      normalized.dateRead,
      normalized.cliffNotes,
      normalized.cliffNotesModel,
      normalized.personalNotes,
      normalized.coverImageUrl,
      sourceDomain(normalized.url),
      normalized.isEssential,
    ],
  );

  if (!result.rows[0]) {
    return null;
  }

  return getResourceBySlug(slug);
}

export async function deleteResource(slug: string) {
  const result = await getPool().query<{ slug: string }>(
    `
      delete from public.resources
      where slug = $1
      returning slug
    `,
    [slug],
  );

  return Boolean(result.rows[0]);
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

function nextResourceStatus(status: ResourceStatus): ResourceStatus {
  if (status === "unread") {
    return "reading";
  }

  if (status === "reading") {
    return "read";
  }

  return "unread";
}

async function getCollectionId(slug: string) {
  const result = await getPool().query<{ id: string }>(
    `
      select id
      from public.collections
      where slug = $1
      limit 1
    `,
    [slug],
  );

  return result.rows[0]?.id ?? null;
}

async function createUniqueSlug(baseSlug: string) {
  let slug = baseSlug || "resource";
  let suffix = 2;

  while (await slugExists(slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

async function slugExists(slug: string) {
  const result = await getPool().query<{ exists: boolean }>(
    `
      select exists (
        select 1
        from public.resources
        where slug = $1
      ) as exists
    `,
    [slug],
  );

  return result.rows[0]?.exists === true;
}

function normalizeResourceWriteInput(input: ResourceWriteInput) {
  const status = input.status ?? "unread";

  return {
    title: input.title.trim(),
    collectionSlug: input.collectionSlug.trim(),
    type: input.type,
    url: nullableString(input.url),
    authors: uniqueValues(input.authors?.map((author) => author.trim()).filter(Boolean) ?? []),
    publisher: nullableString(input.publisher),
    publishedDate: nullableDate(input.publishedDate),
    tags: uniqueValues(
      input.tags?.map(normalizeTag).filter(Boolean) ?? [],
    ),
    status,
    dateRead:
      status === "read"
        ? nullableDate(input.dateRead) ?? new Date().toISOString().slice(0, 10)
        : null,
    cliffNotes: nullableString(input.cliffNotes),
    cliffNotesModel: nullableString(input.cliffNotesModel),
    personalNotes: nullableString(input.personalNotes),
    coverImageUrl: nullableString(input.coverImageUrl),
    isEssential: input.isEssential ?? false,
  };
}

function sourceDomain(url: string | null) {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function normalizeTag(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function nullableString(value: string | null | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function nullableDate(value: string | null | undefined) {
  const trimmed = value?.trim();

  return trimmed && /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function arrayValue(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
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
