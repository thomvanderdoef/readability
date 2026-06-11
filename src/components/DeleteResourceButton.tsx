"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type DeleteResourceButtonProps = {
  slug: string;
  title: string;
};

export function DeleteResourceButton({ slug, title }: DeleteResourceButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function deleteResource() {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/resources/${slug}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        window.alert("Could not delete this resource.");
        return;
      }

      router.push("/");
      router.refresh();
    });
  }

  return (
    <button
      className="btn ghost"
      type="button"
      disabled={isPending}
      onClick={deleteResource}
    >
      {isPending ? "Deleting..." : "Delete"}
    </button>
  );
}
