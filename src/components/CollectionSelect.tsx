"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type { Collection } from "@/lib/resources";

type CollectionSelectProps = {
  collections: Collection[];
  defaultValue?: string;
  isAdmin: boolean;
  mode: "filter" | "field";
  name?: string;
};

const newCollectionValue = "__new_collection__";

export function CollectionSelect({
  collections,
  defaultValue = "",
  isAdmin,
  mode,
  name = "collection",
}: CollectionSelectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState(collections);
  const [value, setValue] = useState(defaultValue);
  const [isPending, startTransition] = useTransition();

  function selectCollection(nextValue: string) {
    if (nextValue === newCollectionValue) {
      createNewCollection();
      return;
    }

    setValue(nextValue);

    if (mode === "filter") {
      const params = new URLSearchParams(searchParams);
      params.delete("k");

      if (nextValue) {
        params.set("collection", nextValue);
      } else {
        params.delete("collection");
      }

      const query = params.toString();
      router.push(query ? `/?${query}` : "/");
    }
  }

  function createNewCollection() {
    const name = window.prompt("New collection name");

    if (!name?.trim()) {
      setValue(defaultValue);
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/collections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          isResearch: true,
        }),
      });

      const result = (await response.json()) as {
        collection?: Collection;
        error?: string;
      };

      if (!response.ok || !result.collection) {
        window.alert(result.error ?? "Could not create collection.");
        setValue(defaultValue);
        return;
      }

      setItems([...items, result.collection]);
      setValue(result.collection.slug);

      if (mode === "filter") {
        const params = new URLSearchParams(searchParams);
        params.delete("k");
        params.set("collection", result.collection.slug);
        router.push(`/?${params.toString()}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <select
      className="collection-select"
      name={name}
      value={value}
      aria-label="Collection"
      disabled={isPending}
      onChange={(event) => selectCollection(event.currentTarget.value)}
    >
      {mode === "filter" ? <option value="">All collections</option> : null}
      {items.map((collection) => (
        <option key={collection.slug} value={collection.slug}>
          {collection.name}
        </option>
      ))}
      {isAdmin ? (
        <option value={newCollectionValue}>+ New collection...</option>
      ) : null}
    </select>
  );
}
