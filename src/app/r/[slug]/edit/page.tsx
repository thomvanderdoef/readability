import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ResourceForm } from "@/components/ResourceForm";
import { hasAdminSession } from "@/lib/admin-auth";
import { getCollections, getResourceBySlug } from "@/lib/resources";

type EditResourcePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function EditResourcePage({ params }: EditResourcePageProps) {
  if (!(await hasAdminSession())) {
    redirect("/admin/login");
  }

  const { slug } = await params;
  const [collections, resource] = await Promise.all([
    getCollections(),
    getResourceBySlug(slug),
  ]);

  if (!resource) {
    notFound();
  }

  return (
    <main>
      <header className="app-header form-header">
        <Link className="wordmark" href="/">
          Readable<span className="wordmark-dot">.</span>
        </Link>
        <span className="header-spacer" />
        <button className="btn primary" form="resource-form" type="submit">
          Save
        </button>
        <Link className="btn ghost" href={`/r/${resource.slug}`}>
          Cancel
        </Link>
      </header>

      <section className="add-wrap">
        <h1 className="add-title">Edit resource</h1>
        <p className="add-sub">Update metadata, notes, tags, and read status.</p>
        <ResourceForm collections={collections} mode="edit" resource={resource} />
      </section>
    </main>
  );
}
