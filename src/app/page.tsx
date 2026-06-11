import Link from "next/link";
import type { ReactNode } from "react";
import { hasLibraryCookieAccess, isValidLibraryKey } from "@/lib/access";
import { resourceTypes } from "@/lib/library";
import {
  getCollections,
  getResources,
  parseResourceQuery,
  Resource,
} from "@/lib/resources";

type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

const statuses = ["unread", "reading", "read"] as const;

export default async function Home({ searchParams }: HomeProps) {
  const resolvedSearchParams = await searchParams;
  const params = toURLSearchParams(resolvedSearchParams);
  const isAuthorized =
    isValidLibraryKey(params.get("k")) || (await hasLibraryCookieAccess());

  if (!isAuthorized) {
    return <LockedPage />;
  }

  const query = parseResourceQuery(params);
  const [collections, resources] = await Promise.all([
    getCollections(),
    getResources({
      ...query,
      limit: query.limit ?? 100,
    }),
  ]);
  const hasActiveFilters = Boolean(
    query.collection || query.status || query.types?.length || query.tags?.length || query.q,
  );

  return (
    <main>
      <header className="app-header">
        <Link className="wordmark" href="/">
          Readable<span className="wordmark-dot">.</span>
        </Link>
        <form className="header-form" action="/">
          {query.status ? (
            <input type="hidden" name="status" value={query.status} />
          ) : null}
          {query.types?.map((type) => (
            <input key={type} type="hidden" name="type" value={type} />
          ))}
          {query.tags?.map((tag) => (
            <input key={tag} type="hidden" name="tag" value={tag} />
          ))}
          <select
            className="collection-select"
            name="collection"
            defaultValue={query.collection ?? ""}
            aria-label="Collection"
          >
            <option value="">All collections</option>
            {collections.map((collection) => (
              <option key={collection.slug} value={collection.slug}>
                {collection.name}
              </option>
            ))}
          </select>
          <input
            className="header-search"
            name="q"
            placeholder="Search..."
            defaultValue={query.q ?? ""}
          />
          <button className="btn ghost" type="submit">
            Go
          </button>
        </form>
      </header>

      <section className="filter-bar" aria-label="Library filters">
        <div className="seg-control" aria-label="Read status">
          <FilterLink
            href={withParam(params, "status", undefined)}
            isActive={!query.status}
            className="seg-link"
          >
            All
          </FilterLink>
          {statuses.map((status) => (
            <FilterLink
              key={status}
              href={withParam(params, "status", status)}
              isActive={query.status === status}
              className="seg-link"
            >
              {capitalize(status)}
            </FilterLink>
          ))}
        </div>

        <div className="type-chips" aria-label="Resource types">
          {resourceTypes.map((type) => {
            const activeTypes = query.types ?? [];
            const isActive = activeTypes.includes(type);
            const nextTypes = isActive
              ? activeTypes.filter((activeType) => activeType !== type)
              : [...activeTypes, type];

            return (
              <FilterLink
                key={type}
                href={withParam(params, "type", nextTypes)}
                isActive={isActive}
              >
                {typeLabel(type)}
              </FilterLink>
            );
          })}
        </div>
        {hasActiveFilters ? (
          <Link className="clear-filters" href="/">
            Clear filters · showing {resources.length}
          </Link>
        ) : null}
      </section>

      <section className="library" aria-label="Library resources">
        {resources.length > 0 ? (
          resources.map((resource) => (
            <ResourceRow key={resource.id} resource={resource} />
          ))
        ) : (
          <div className="empty-state">
            No resources match these filters yet.
          </div>
        )}
      </section>
    </main>
  );
}

function LockedPage() {
  return (
    <main>
      <header className="app-header">
        <Link className="wordmark" href="/">
          Readable<span className="wordmark-dot">.</span>
        </Link>
      </header>

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

        <div className="setup-panel">
          <p className="setup-kicker">Private read path</p>
          <p>
            Use the owner&apos;s shared link to unlock this browser. API callers
            can include the same key on each request.
          </p>
        </div>
      </section>
    </main>
  );
}

function ResourceRow({ resource }: { resource: Resource }) {
  const year = resource.publishedDate
    ? new Date(resource.publishedDate).getFullYear()
    : null;
  const byline = resource.authors.join(", ");

  return (
    <article className="row">
      <div className="row-main">
        <p className="row-over">
          {capitalize(resource.type)}
          {year ? ` · ${year}` : ""}
        </p>
        <h2 className="row-title">
          <Link href={`/api/resources/${resource.slug}`}>{resource.title}</Link>
        </h2>
        {byline ? <p className="row-byline">{byline}</p> : null}
        {resource.cliffNotes ? (
          <p className="row-desc">{truncate(resource.cliffNotes, 240)}</p>
        ) : null}
      </div>
      <div className="row-side">
        <span className="status-dot" data-s={resource.status} aria-label={resource.status} />
        <div className="thumb" aria-hidden="true">
          {resource.title.slice(0, 1)}
        </div>
      </div>
    </article>
  );
}

function FilterLink({
  children,
  className = "tchip",
  href,
  isActive,
}: {
  children: ReactNode;
  className?: string;
  href: string;
  isActive: boolean;
}) {
  return (
    <Link className={`${className}${isActive ? " active" : ""}`} href={href}>
      {children}
    </Link>
  );
}

function toURLSearchParams(
  searchParams: Record<string, string | string[] | undefined> | undefined,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
    } else if (value) {
      params.set(key, value);
    }
  }

  return params;
}

function withParam(
  currentParams: URLSearchParams,
  key: string,
  value: string | string[] | undefined,
) {
  const params = new URLSearchParams(currentParams);
  params.delete("k");
  params.delete(key);

  if (Array.isArray(value)) {
    for (const item of value) {
      params.append(key, item);
    }
  } else if (value) {
    params.set(key, value);
  }

  const query = params.toString();

  return query ? `/?${query}` : "/";
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function typeLabel(type: string) {
  const labels: Record<string, string> = {
    article: "Articles",
    book: "Books",
    paper: "Papers",
    podcast: "Podcasts",
    video: "Video",
    website: "Websites",
  };

  return labels[type] ?? capitalize(type);
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trim()}...`;
}
