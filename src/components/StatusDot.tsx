"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ResourceStatus } from "@/lib/resources";

type StatusDotProps = {
  isAdmin: boolean;
  showLabel?: boolean;
  slug: string;
  status: ResourceStatus;
};

const nextStatus: Record<ResourceStatus, ResourceStatus> = {
  unread: "reading",
  reading: "read",
  read: "unread",
};

export function StatusDot({
  isAdmin,
  showLabel = false,
  slug,
  status,
}: StatusDotProps) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState(status);
  const [isPending, startTransition] = useTransition();

  if (!isAdmin) {
    return (
      <>
        <span
          className="status-dot"
          data-s={currentStatus}
          aria-label={`Status: ${currentStatus}`}
        />
        {showLabel ? <span className="slabel">{capitalize(currentStatus)}</span> : null}
      </>
    );
  }

  function cycleStatus() {
    const previousStatus = currentStatus;
    const optimisticStatus = nextStatus[currentStatus];

    setCurrentStatus(optimisticStatus);

    startTransition(async () => {
      const response = await fetch(`/api/resources/${slug}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: optimisticStatus,
        }),
      });

      if (!response.ok) {
        setCurrentStatus(previousStatus);
        return;
      }

      const result = (await response.json()) as {
        resource?: {
          status?: ResourceStatus;
        };
      };

      setCurrentStatus(result.resource?.status ?? optimisticStatus);
      router.refresh();
    });
  }

  return (
    <>
      <button
        className="status-dot status-dot-button"
        data-s={currentStatus}
        type="button"
        aria-label={`Change status: ${currentStatus}`}
        disabled={isPending}
        onClick={cycleStatus}
      />
      {showLabel ? <span className="slabel">{capitalize(currentStatus)}</span> : null}
    </>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
