import { requireAdmin } from "@/lib/admin-auth";
import {
  isResourceStatus,
  updateResourceStatus,
} from "@/lib/resources";

type Context = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: Context) {
  const denied = await requireAdmin();

  if (denied) {
    return denied;
  }

  const { slug } = await context.params;
  const body = await parseJsonBody(request);

  if (!body.ok) {
    return Response.json(
      {
        ok: false,
        error: body.error,
      },
      {
        status: 400,
      },
    );
  }

  const status = body.data.status;

  if (status !== undefined && !isResourceStatus(status)) {
    return Response.json(
      {
        ok: false,
        error: "Invalid resource status.",
      },
      {
        status: 422,
      },
    );
  }

  const resource = await updateResourceStatus(slug, status);

  if (!resource) {
    return Response.json(
      {
        ok: false,
        error: "Resource not found.",
      },
      {
        status: 404,
      },
    );
  }

  return Response.json({
    ok: true,
    resource,
  });
}

async function parseJsonBody(request: Request) {
  const text = await request.text();

  if (!text.trim()) {
    return {
      ok: true as const,
      data: {} as Record<string, unknown>,
    };
  }

  try {
    const data = JSON.parse(text) as Record<string, unknown>;

    return {
      ok: true as const,
      data,
    };
  } catch {
    return {
      ok: false as const,
      error: "Invalid JSON body.",
    };
  }
}
