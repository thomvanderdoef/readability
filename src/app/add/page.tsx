import Link from "next/link";
import { redirect } from "next/navigation";
import { AddResourcePanel } from "@/components/AddResourcePanel";
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
          Paste a URL and Readable drafts the entry, or fill the form manually.
        </p>
        <AddResourcePanel collections={collections} />
      </section>
    </main>
  );
}
