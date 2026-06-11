import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local" });
config();

type CollectionSeed = {
  name: string;
  slug: string;
  description: string | null;
  is_research: boolean;
};

type ResourceSeed = {
  slug: string;
  collection: string;
  title: string;
  type: "book" | "paper" | "article" | "video" | "podcast" | "website";
  url: string | null;
  authors: string[];
  publisher: string | null;
  published_date: string | null;
  tags: string[];
  status: "unread" | "reading" | "read";
  is_essential: boolean;
  cliff_notes: string | null;
  personal_notes: string | null;
  cover_image_url?: string | null;
};

type SeedFile = {
  collections: CollectionSeed[];
  resources: ResourceSeed[];
};

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

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function main() {
  const seed = JSON.parse(
    await readFile(new URL("../seed/resources.json", import.meta.url), "utf8"),
  ) as SeedFile;

  const client = await pool.connect();

  try {
    await client.query("begin");

    const collectionIds = new Map<string, string>();

    for (const collection of seed.collections) {
      const result = await client.query<{ id: string }>(
        `
          insert into public.collections (name, slug, description, is_research)
          values ($1, $2, $3, $4)
          on conflict (slug) do update set
            name = excluded.name,
            description = excluded.description,
            is_research = excluded.is_research
          returning id
        `,
        [
          collection.name,
          collection.slug,
          collection.description,
          collection.is_research,
        ],
      );

      collectionIds.set(collection.slug, result.rows[0].id);
    }

    for (const resource of seed.resources) {
      const collectionId = collectionIds.get(resource.collection);

      if (!collectionId) {
        throw new Error(`Unknown collection slug: ${resource.collection}`);
      }

      await client.query(
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
            cliff_notes,
            personal_notes,
            cover_image_url,
            source_domain,
            is_essential
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          on conflict (slug) do update set
            collection_id = excluded.collection_id,
            title = excluded.title,
            type = excluded.type,
            url = excluded.url,
            authors = excluded.authors,
            publisher = excluded.publisher,
            published_date = excluded.published_date,
            tags = excluded.tags,
            status = excluded.status,
            cliff_notes = excluded.cliff_notes,
            personal_notes = excluded.personal_notes,
            cover_image_url = excluded.cover_image_url,
            source_domain = excluded.source_domain,
            is_essential = excluded.is_essential
        `,
        [
          collectionId,
          resource.slug,
          resource.title,
          resource.type,
          resource.url,
          resource.authors,
          resource.publisher,
          resource.published_date,
          resource.tags,
          resource.status,
          resource.cliff_notes,
          resource.personal_notes,
          resource.cover_image_url ?? null,
          sourceDomain(resource.url),
          resource.is_essential,
        ],
      );
    }

    await client.query("commit");

    console.log(
      `Seeded ${seed.collections.length} collection(s) and ${seed.resources.length} resource(s).`,
    );
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
