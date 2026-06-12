import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { resourceTypes } from "@/lib/library";

export type ResourceDraft = {
  title: string;
  type: string;
  url: string;
  authors: string[];
  publisher: string | null;
  publishedDate: string | null;
  tags: string[];
  cliffNotes: string | null;
  coverImageUrl: string | null;
  draftSource: "ai" | "fallback";
  draftWarning: string | null;
};

type AnthropicResponse = {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
};

export async function draftResourceFromUrl(url: string): Promise<ResourceDraft> {
  const extracted = await extractReadablePage(url);
  const result = await draftWithAnthropic(extracted);
  const aiDraft = result.draft;

  return {
    title: aiDraft.title || extracted.title || url,
    type: validType(aiDraft.type) ? aiDraft.type : "article",
    url,
    authors: aiDraft.authors ?? [],
    publisher: aiDraft.publisher ?? extracted.siteName ?? extracted.domain,
    publishedDate: validDate(aiDraft.publishedDate) ? aiDraft.publishedDate : null,
    tags: aiDraft.tags ?? [],
    cliffNotes: aiDraft.cliffNotes ?? null,
    coverImageUrl: aiDraft.coverImageUrl ?? extracted.imageUrl,
    draftSource: result.source,
    draftWarning: result.warning,
  };
}

async function extractReadablePage(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Readable/0.1 (+https://readable-murex.vercel.app)",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Could not fetch URL: ${response.status}`);
  }

  const html = await response.text();
  const dom = new JSDOM(html, {
    url,
  });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  const document = dom.window.document;

  return {
    url,
    title:
      article?.title ??
      meta(document, "og:title") ??
      document.querySelector("title")?.textContent ??
      "",
    text: cleanExtractedText(article?.textContent ?? document.body.textContent ?? "").slice(
      0,
      20_000,
    ),
    byline: article?.byline ?? meta(document, "author"),
    siteName: meta(document, "og:site_name"),
    domain: new URL(url).hostname.replace(/^www\./, ""),
    imageUrl: meta(document, "og:image"),
    publishedDate: extractPublishedDate(document, article?.textContent ?? ""),
  };
}

async function draftWithAnthropic(extracted: Awaited<ReturnType<typeof extractReadablePage>>) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return fallbackDraft(extracted, "ANTHROPIC_API_KEY is not configured.");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      model: process.env.INGEST_MODEL || "claude-haiku-4-5",
      max_tokens: 1200,
      messages: [
        {
          role: "user",
          content: `Draft metadata for this personal research-library resource. Return only valid JSON with keys: title, authors, publishedDate, type, publisher, tags, cliffNotes, coverImageUrl.

Rules:
- type must be one of: ${resourceTypes.join(", ")}
- authors is an array of strings
- publishedDate is YYYY-MM-DD or null.
- Use the source page's published date when available. Prefer explicit article metadata, byline dates, time elements, or visible publication dates over guessing.
- Do not infer a date from today's date or unrelated site/footer dates.
- tags is 3-6 lowercase hyphenated strings
- cliffNotes is required and must be a non-empty markdown string.
- cliffNotes must contain 3-6 concise bullet points, 150-300 words total.
- Never return null for cliffNotes when article text is available.
- Summarize only the primary article/resource body.
- Ignore sponsor blurbs, subscription CTAs, site navigation, author bios, related headlines, comments, previous/next links, and footer material.
- Do not mention that the source was scraped, extracted, sponsored, or paywalled.

Source URL: ${extracted.url}
Extracted title: ${extracted.title}
Extracted byline: ${extracted.byline ?? ""}
Site: ${extracted.siteName ?? extracted.domain}
Image: ${extracted.imageUrl ?? ""}
Extracted published date: ${extracted.publishedDate ?? ""}

Text:
${extracted.text}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    return fallbackDraft(
      extracted,
      `Anthropic returned ${response.status}: ${errorText.slice(0, 180)}`,
    );
  }

  const json = (await response.json()) as AnthropicResponse;
  const text = json.content?.find((part) => part.type === "text")?.text ?? "";

  try {
    const draft = normalizeAiDraft(JSON.parse(extractJsonObject(text)) as Record<string, unknown>, extracted);

    if (!draft.cliffNotes) {
      return fallbackDraft(extracted, "Anthropic returned no cliffNotes.");
    }

    return {
      draft,
      source: "ai" as const,
      warning: null,
    };
  } catch {
    return fallbackDraft(extracted, "Anthropic response was not valid JSON.");
  }
}

function normalizeAiDraft(
  draft: Record<string, unknown>,
  extracted: Awaited<ReturnType<typeof extractReadablePage>>,
) {
  return {
    title: stringValue(draft.title),
    type: stringValue(draft.type),
    authors: stringArray(draft.authors),
    publisher: nullableString(draft.publisher) ?? extracted.siteName ?? extracted.domain,
    publishedDate: nullableString(draft.publishedDate) ?? extracted.publishedDate,
    tags: stringArray(draft.tags).map(normalizeTag).filter(Boolean).slice(0, 6),
    cliffNotes: nullableString(draft.cliffNotes),
    coverImageUrl: nullableString(draft.coverImageUrl) ?? extracted.imageUrl,
  };
}

function fallbackDraft(
  extracted: Awaited<ReturnType<typeof extractReadablePage>>,
  warning: string,
) {
  return {
    draft: {
      title: extracted.title,
      type: "article",
      authors: extracted.byline ? [extracted.byline] : [],
      publisher: extracted.siteName ?? extracted.domain,
      publishedDate: extracted.publishedDate,
      tags: [],
      cliffNotes: null,
      coverImageUrl: extracted.imageUrl,
    },
    source: "fallback" as const,
    warning,
  };
}

function cleanExtractedText(text: string) {
  return text
    .replace(/Thanks for reading![\s\S]*$/i, "")
    .replace(/Top Edtech Headlines[\s\S]*$/i, "")
    .replace(/Discussion about this post[\s\S]*$/i, "")
    .replace(/Ready for more\?[\s\S]*$/i, "")
    .replace(/Thanks to our Presenting Sponsors[\s\S]*?possible\./i, "")
    .replace(/To learn more about becoming a sponsor[\s\S]*?org/i, "")
    .replace(/Sponsored by [^\n.]+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractJsonObject(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return candidate;
  }

  return candidate.slice(start, end + 1);
}

function meta(document: Document, property: string) {
  return (
    document
      .querySelector(`meta[property="${property}"], meta[name="${property}"]`)
      ?.getAttribute("content")
      ?.trim() || null
  );
}

function extractPublishedDate(document: Document, readableText: string) {
  const candidates = [
    meta(document, "article:published_time"),
    meta(document, "date"),
    meta(document, "pubdate"),
    meta(document, "publish_date"),
    meta(document, "parsely-pub-date"),
    meta(document, "sailthru.date"),
    meta(document, "article:modified_time"),
    document.querySelector("time[datetime]")?.getAttribute("datetime") ?? null,
    document.querySelector("time")?.textContent ?? null,
    ...jsonLdDates(document),
    visibleDate(document.body.textContent ?? ""),
    visibleDate(readableText),
  ];

  for (const candidate of candidates) {
    const parsed = parseDate(candidate);

    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function jsonLdDates(document: Document) {
  return Array.from(
    document.querySelectorAll('script[type="application/ld+json"]'),
  ).flatMap((script) => {
    try {
      const parsed = JSON.parse(script.textContent ?? "") as unknown;
      return collectJsonLdDates(parsed);
    } catch {
      return [];
    }
  });
}

function collectJsonLdDates(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectJsonLdDates);
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  const dates = [
    record.datePublished,
    record.dateCreated,
    record.uploadDate,
  ].filter((item): item is string => typeof item === "string");

  if (Array.isArray(record["@graph"])) {
    dates.push(...record["@graph"].flatMap(collectJsonLdDates));
  }

  return dates;
}

function visibleDate(text: string) {
  const match = text.match(
    /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},\s+\d{4}\b/i,
  );

  return match?.[0] ?? null;
}

function parseDate(value: string | null) {
  if (!value) {
    return null;
  }

  const isoMatch = value.match(/\d{4}-\d{2}-\d{2}/);

  if (isoMatch) {
    return isoMatch[0];
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableString(value: unknown) {
  const string = stringValue(value);

  return string || null;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function normalizeTag(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function validType(value: string) {
  return resourceTypes.includes(value as (typeof resourceTypes)[number]);
}

function validDate(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}
