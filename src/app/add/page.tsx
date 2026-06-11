import Link from "next/link";
import { redirect } from "next/navigation";
import { ResourceForm } from "@/components/ResourceForm";
import { hasAdminSession } from "@/lib/admin-auth";
import { getCollections } from "@/lib/resources";

export const dynamic = "force-dynamic";

export default async function AddResourcePage() {
  if (!(await hasAdminSession())) {
    redirect("/admin/login");
  }

  const collections = await getCollections();

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
        <Link className="btn ghost" href="/">
          Cancel
        </Link>
      </header>

      <section className="add-wrap">
        <h1 className="add-title">Add a resource</h1>
        <p className="add-sub">
          Add manually for books, papers, articles, videos, podcasts, and sites.
        </p>
        <ResourceForm collections={collections} mode="create" />
      </section>
    </main>
  );
}
