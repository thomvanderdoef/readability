import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteResourceButton } from "@/components/DeleteResourceButton";
import { StatusDot } from "@/components/StatusDot";
import { hasAdminSession } from "@/lib/admin-auth";
import { hasLibraryCookieAccess, isValidLibraryKey } from "@/lib/access";
import { getResourceBySlug, Resource } from "@/lib/resources";

type ResourcePageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function ResourcePage({
  params,
  searchParams,
}: ResourcePageProps) {
  const resolvedSearchParams = await searchParams;
  const key = stringParam(resolvedSearchParams?.k);
  const isAdmin = await hasAdminSession();
  const isAuthorized =
    isAdmin || isValidLibraryKey(key) || (await hasLibraryCookieAccess());

  if (!isAuthorized) {
    return <LockedPage />;
  }

  const { slug } = await params;
  const resource = await getResourceBySlug(slug);

  if (!resource) {
    notFound();
  }

  return (
    <main>
      <header className="app-header">
        <Link className="wordmark" href="/">
          Readable<span className="wordmark-dot">.</span>
        </Link>
        <span className="header-spacer" />
        {isAdmin ? (
          <div className="admin-actions">
            <Link className="btn ghost" href={`/r/${resource.slug}/edit`}>
              Edit
            </Link>
            <DeleteResourceButton slug={resource.slug} title={resource.title} />
            <form action="/api/admin/logout" method="post">
              <button className="btn ghost" type="submit">
                Log out
              </button>
            </form>
          </div>
        ) : (
          <Link className="btn ghost" href="/admin/login">
            Admin
          </Link>
        )}
      </header>

      <article className="detail-wrap">
        <Link className="back-link" href="/">
          ← Library
        </Link>

        <div className="detail-head">
          <div className="detail-head-main">
            <p className="detail-over">{detailOver(resource)}</p>
            <h1 className="detail-title">{resource.title}</h1>
            <p className="detail-byline">
              {resource.authors.join(", ") || "Unknown author"}
              {resource.url ? (
                <>
                  {" · "}
                  <a href={resource.url}>{resource.sourceDomain ?? "Source"} ↗</a>
                </>
              ) : null}
            </p>
          </div>
          <div className="detail-thumb" aria-hidden="true">
            {resource.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resource.coverImageUrl} alt="" />
            ) : (
              resource.title.slice(0, 1)
            )}
          </div>
        </div>

        <div className="detail-statusrow">
          <StatusDot
            isAdmin={isAdmin}
            showLabel
            slug={resource.slug}
            status={resource.status}
          />
        </div>

        {resource.tags.length ? (
          <div className="dtags" aria-label="Tags">
            {resource.tags.map((tag) => (
              <Link key={tag} className="dtag" href={`/?tag=${encodeURIComponent(tag)}`}>
                {tag}
              </Link>
            ))}
          </div>
        ) : null}

        <NotesSection title="Cliff Notes" value={resource.cliffNotes} />
        <NotesSection title="My Notes" value={resource.personalNotes} isPersonal />

        <p className="provenance">
          {resource.cliffNotesModel
            ? `Cliff notes drafted by ${resource.cliffNotesModel} · `
            : ""}
          Added {formatDate(resource.addedAt)}
        </p>
      </article>
    </main>
  );
}

function LockedPage() {
  return (
    <main>
      <section className="locked-wrap" aria-labelledby="locked-heading">
        <Link className="wordmark" href="/">
          Readable<span className="wordmark-dot">.</span>
        </Link>
        <div className="lock-glyph" aria-hidden="true" />
        <h1 className="locked-msg" id="locked-heading">
          This is a private library.
        </h1>
        <p className="locked-sub">
          Access requires a link from its owner. If you arrived here by accident,
          there is nothing to see, politely, not even the shelves.
        </p>
      </section>
    </main>
  );
}

function NotesSection({
  isPersonal = false,
  title,
  value,
}: {
  isPersonal?: boolean;
  title: string;
  value: string | null;
}) {
  if (!value) {
    return null;
  }

  return (
    <section className="notes-section">
      <h2 className="notes-label">{title}</h2>
      <div className={isPersonal ? "personal-notes" : "notes-body"}>
        <MarkdownLite value={value} />
      </div>
    </section>
  );
}

function MarkdownLite({ value }: { value: string }) {
  const blocks = value
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <>
      {blocks.map((block) => {
        const lines = block.split("\n").map((line) => line.trim());
        const isList = lines.every((line) => /^[-*]\s+/.test(line));

        if (isList) {
          return (
            <ul key={block}>
              {lines.map((line) => (
                <li key={line}>
                  <InlineMarkdown value={line.replace(/^[-*]\s+/, "")} />
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={block}>
            <InlineMarkdown value={block} />
          </p>
        );
      })}
    </>
  );
}

function InlineMarkdown({ value }: { value: string }) {
  const parts = value.split(/(\*\*[^*]+\*\*)/g);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={index}>{part.slice(2, -2)}</strong>;
        }

        return part;
      })}
    </>
  );
}

function detailOver(resource: Resource) {
  return [
    capitalize(resource.type),
    resource.publishedDate ? new Date(resource.publishedDate).getFullYear() : null,
    resource.publisher,
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
