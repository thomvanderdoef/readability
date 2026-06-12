import { config } from "dotenv";
import { Pool } from "pg";
import { JSDOM } from "jsdom";

config({ path: ".env.local" });
config();

type ResourceRow = {
  slug: string;
  title: string;
  url: string;
};

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to backfill covers.");
}

const databaseUrlObject = new URL(databaseUrl);
const ssl =
  databaseUrlObject.searchParams.get("sslmode") === "disable"
    ? false
    : {
        rejectUnauthorized: false,
      };

const pool = new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 30_000,
  ssl,
});

async function main() {
  const result = await pool.query<ResourceRow>(
    `
      select slug, title, url
      from public.resources
      where url is not null
        and cover_image_url is null
      order by added_at asc, title asc
    `,
  );

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const resource of result.rows) {
    try {
      const coverImageUrl = await fetchCoverImage(resource.url);

      if (!coverImageUrl || isPlaceholderImage(coverImageUrl)) {
        skipped += 1;
        console.log(`skip ${resource.slug}: no usable image found`);
        continue;
      }

      await pool.query(
        `
          update public.resources
          set cover_image_url = $2
          where slug = $1
            and cover_image_url is null
        `,
        [resource.slug, coverImageUrl],
      );

      updated += 1;
      console.log(`update ${resource.slug}: ${coverImageUrl}`);
    } catch (error) {
      failed += 1;
      console.log(
        `fail ${resource.slug}: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }

  console.log(
    `Backfill complete. updated=${updated} skipped=${skipped} failed=${failed}`,
  );
}

async function fetchCoverImage(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Readable/0.1 (+https://readable-murex.vercel.app)",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`fetch returned ${response.status}`);
  }

  const html = await response.text();
  const dom = new JSDOM(html, {
    url,
  });
  const document = dom.window.document;

  return (
    meta(document, "og:image") ??
    meta(document, "twitter:image") ??
    meta(document, "twitter:image:src")
  );
}

function meta(document: Document, property: string) {
  const value = document
    .querySelector(`meta[property="${property}"], meta[name="${property}"]`)
    ?.getAttribute("content")
    ?.trim();

  return value || null;
}

function isPlaceholderImage(url: string) {
  return [
    "s0.wp.com/i/blank.jpg",
    "secure.gravatar.com/blavatar",
    "gravatar.com/blavatar",
  ].some((placeholder) => url.includes(placeholder));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
