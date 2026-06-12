"use client";

import { FormEvent, useState, useTransition } from "react";
import { ResourceForm } from "@/components/ResourceForm";
import type { Collection, Resource } from "@/lib/resources";

type AddResourcePanelProps = {
  collections: Collection[];
};

type DraftResponse = {
  draft?: DraftResource;
  error?: string;
};

type DraftResource = Partial<Resource> & {
  draftSource?: "ai" | "fallback";
  draftWarning?: string | null;
};

export function AddResourcePanel({ collections }: AddResourcePanelProps) {
  const [url, setUrl] = useState("");
  const [draft, setDraft] = useState<DraftResource | undefined>();
  const [draftKey, setDraftKey] = useState("blank");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function draftFromUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/admin/ingest/draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
        }),
      });

      const result = (await response.json()) as DraftResponse;

      if (!response.ok || !result.draft) {
        setError(result.error ?? "Could not draft this URL.");
        return;
      }

      setDraft({
        ...result.draft,
        collection: collections[0]
          ? {
              name: collections[0].name,
              slug: collections[0].slug,
            }
          : undefined,
        status: "unread",
      });
      setDraftKey(`${result.draft.url}-${Date.now()}`);
    });
  }

  return (
    <>
      <form className="url-row" onSubmit={draftFromUrl}>
        <input
          className="url-input"
          type="url"
          value={url}
          placeholder="Paste a URL to draft metadata"
          onChange={(event) => setUrl(event.currentTarget.value)}
          required
        />
        <button className="btn ghost" type="submit" disabled={isPending}>
          {isPending ? "Drafting..." : draft ? "Re-fetch" : "Draft"}
        </button>
      </form>

      {draft ? (
        <div className="draft-banner">
          <span className="ai-chip">
            {draft.draftSource === "fallback" ? "Needs review" : "AI draft"}
          </span>
          <span>
            {draft.draftWarning
              ? `Drafting fell back to extracted metadata: ${draft.draftWarning}`
              : "Review and edit the draft below. Nothing is saved until you approve."}
          </span>
        </div>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}

      <ResourceForm
        key={draftKey}
        collections={collections}
        draftKey={draftKey}
        mode="create"
        resource={draft}
      />
    </>
  );
}
