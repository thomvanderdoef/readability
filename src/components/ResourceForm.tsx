"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { resourceTypes } from "@/lib/library";
import type { Collection, Resource, ResourceStatus } from "@/lib/resources";

type ResourceFormProps = {
  collections: Collection[];
  mode: "create" | "edit";
  resource?: Resource;
};

export function ResourceForm({ collections, mode, resource }: ResourceFormProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ResourceStatus>(resource?.status ?? "unread");
  const [tags, setTags] = useState(resource?.tags ?? []);
  const [tagInput, setTagInput] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      title: stringField(formData, "title"),
      collectionSlug: stringField(formData, "collectionSlug"),
      type: stringField(formData, "type"),
      url: stringField(formData, "url"),
      authors: listField(formData, "authors"),
      publisher: stringField(formData, "publisher"),
      publishedDate: stringField(formData, "publishedDate"),
      tags,
      status,
      dateRead: stringField(formData, "dateRead"),
      cliffNotes: stringField(formData, "cliffNotes"),
      personalNotes: stringField(formData, "personalNotes"),
      coverImageUrl: stringField(formData, "coverImageUrl"),
      isEssential: formData.get("isEssential") === "on",
    };

    startTransition(async () => {
      const response = await fetch(
        mode === "create" ? "/api/resources" : `/api/resources/${resource?.slug}`,
        {
          method: mode === "create" ? "POST" : "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const result = (await response.json()) as {
        errors?: string[];
        error?: string;
        resource?: Resource;
      };

      if (!response.ok || !result.resource) {
        setError(result.errors?.join(" ") ?? result.error ?? "Could not save resource.");
        return;
      }

      router.push(`/r/${result.resource.slug}`);
      router.refresh();
    });
  }

  return (
    <form className="resource-form" id="resource-form" onSubmit={submit}>
      <div className="form-grid">
        <div className="field full">
          <label className="flabel" htmlFor="title">
            Title
          </label>
          <input
            className="finput"
            id="title"
            name="title"
            defaultValue={resource?.title ?? ""}
            required
          />
        </div>

        <div className="field">
          <label className="flabel" htmlFor="authors">
            Author(s)
          </label>
          <input
            className="finput"
            id="authors"
            name="authors"
            defaultValue={resource?.authors.join(", ") ?? ""}
            placeholder="Separate with commas"
          />
        </div>

        <div className="field">
          <label className="flabel" htmlFor="publisher">
            Publisher / Source
          </label>
          <input
            className="finput"
            id="publisher"
            name="publisher"
            defaultValue={resource?.publisher ?? ""}
          />
        </div>

        <div className="field">
          <label className="flabel" htmlFor="type">
            Type
          </label>
          <select
            className="fselect"
            id="type"
            name="type"
            defaultValue={resource?.type ?? "article"}
          >
            {resourceTypes.map((type) => (
              <option key={type} value={type}>
                {capitalize(type)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="flabel" htmlFor="publishedDate">
            Published
          </label>
          <input
            className="finput"
            id="publishedDate"
            name="publishedDate"
            type="date"
            defaultValue={resource?.publishedDate ?? ""}
          />
        </div>

        <div className="field">
          <label className="flabel" htmlFor="collectionSlug">
            Collection
          </label>
          <select
            className="fselect"
            id="collectionSlug"
            name="collectionSlug"
            defaultValue={resource?.collection.slug ?? collections[0]?.slug}
          >
            {collections.map((collection) => (
              <option key={collection.slug} value={collection.slug}>
                {collection.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="flabel" htmlFor="status">
            Status
          </label>
          <select
            className="fselect"
            id="status"
            name="status"
            value={status}
            onChange={(event) => setStatus(event.currentTarget.value as ResourceStatus)}
          >
            <option value="unread">Unread</option>
            <option value="reading">Reading</option>
            <option value="read">Read</option>
          </select>
        </div>

        <div className="field">
          <label className="flabel" htmlFor="dateRead">
            Date read
          </label>
          <input
            className="finput"
            id="dateRead"
            name="dateRead"
            type="date"
            defaultValue={resource?.dateRead ?? ""}
            disabled={status !== "read"}
          />
        </div>

        <div className="field full">
          <label className="flabel" htmlFor="url">
            URL
          </label>
          <input
            className="finput"
            id="url"
            name="url"
            type="url"
            defaultValue={resource?.url ?? ""}
          />
        </div>

        <div className="field full">
          <label className="flabel" htmlFor="coverImageUrl">
            Cover image
          </label>
          <input
            className="finput"
            id="coverImageUrl"
            name="coverImageUrl"
            type="url"
            defaultValue={resource?.coverImageUrl ?? ""}
          />
        </div>

        <div className="field full">
          <span className="flabel">
            Tags <span className="fhint">press Enter or comma to add</span>
          </span>
          <div className="tag-editor">
            {tags.map((tag) => (
              <button
                className="tagchip"
                key={tag}
                type="button"
                onClick={() => setTags(tags.filter((existingTag) => existingTag !== tag))}
              >
                {tag} <span className="x" aria-hidden="true">×</span>
              </button>
            ))}
            <input
              className="tag-add-input"
              aria-label="Add tag"
              value={tagInput}
              placeholder={tags.length ? "Add tag..." : "Add tags..."}
              onBlur={addCurrentTag}
              onChange={(event) => setTagInput(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  addCurrentTag();
                }
              }}
            />
          </div>
        </div>

        <div className="field full">
          <label className="flabel" htmlFor="cliffNotes">
            Cliff Notes
          </label>
          <textarea
            className="ftextarea"
            id="cliffNotes"
            name="cliffNotes"
            defaultValue={resource?.cliffNotes ?? ""}
          />
        </div>

        <div className="field full">
          <label className="flabel" htmlFor="personalNotes">
            My Notes
          </label>
          <textarea
            className="ftextarea personal"
            id="personalNotes"
            name="personalNotes"
            defaultValue={resource?.personalNotes ?? ""}
          />
        </div>

        <label className="check-field">
          <input
            name="isEssential"
            type="checkbox"
            defaultChecked={resource?.isEssential ?? false}
          />
          Essential resource
        </label>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
    </form>
  );

  function addCurrentTag() {
    const normalized = normalizeTag(tagInput);

    if (!normalized || tags.includes(normalized)) {
      setTagInput("");
      return;
    }

    setTags([...tags, normalized]);
    setTagInput("");
  }
}

function stringField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function listField(formData: FormData, key: string) {
  return stringField(formData, key)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeTag(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}
