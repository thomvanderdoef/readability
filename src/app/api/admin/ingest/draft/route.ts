import { requireAdmin } from "@/lib/admin-auth";
import { draftResourceFromUrl } from "@/lib/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const denied = await requireAdmin();

  if (denied) {
    return denied;
  }

  const body = await parseJsonBody(request);

  if (!body.ok) {
    return jsonError(body.error, 400);
  }

  const url = typeof body.data.url === "string" ? body.data.url.trim() : "";

  if (!url) {
    return jsonError("url is required.", 422);
  }

  try {
    const draft = await draftResourceFromUrl(url);

    return Response.json({
      ok: true,
      draft,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not draft this URL.",
      502,
    );
  }
}

async function parseJsonBody(request: Request) {
  try {
    return {
      ok: true as const,
      data: (await request.json()) as Record<string, unknown>,
    };
  } catch {
    return {
      ok: false as const,
      error: "Invalid JSON body.",
    };
  }
}

function jsonError(error: string, status: number) {
  return Response.json(
    {
      ok: false,
      error,
    },
    {
      status,
    },
  );
}
