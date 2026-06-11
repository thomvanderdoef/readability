import {
  aboutUrlFor,
  hasLibraryRequestAccess,
  unauthorizedJson,
} from "@/lib/access";
import { requireAdmin } from "@/lib/admin-auth";
import {
  deleteResource,
  getResourceBySlug,
  parseResourceWriteInput,
  updateResource,
} from "@/lib/resources";

type Context = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: Context) {
  if (!hasLibraryRequestAccess(request)) {
    return unauthorizedJson();
  }

  const { slug } = await context.params;
  const resource = await getResourceBySlug(slug);

  if (!resource) {
    return Response.json(
      {
        _about: aboutUrlFor(request),
        error: "Resource not found.",
      },
      {
        status: 404,
      },
    );
  }

  return Response.json({
    _about: aboutUrlFor(request),
    resource,
    status: "ok",
  });
}

export async function PUT(request: Request, context: Context) {
  const denied = await requireAdmin();

  if (denied) {
    return denied;
  }

  const { slug } = await context.params;
  const body = await parseJsonBody(request);

  if (!body.ok) {
    return jsonError(body.error, 400);
  }

  const parsed = parseResourceWriteInput(body.data);

  if (!parsed.ok) {
    return Response.json(
      {
        ok: false,
        errors: parsed.errors,
      },
      {
        status: 422,
      },
    );
  }

  const resource = await updateResource(slug, parsed.data);

  if (!resource) {
    return jsonError("Resource or collection not found.", 404);
  }

  return Response.json({
    ok: true,
    resource,
  });
}

export async function DELETE(_request: Request, context: Context) {
  const denied = await requireAdmin();

  if (denied) {
    return denied;
  }

  const { slug } = await context.params;
  const deleted = await deleteResource(slug);

  if (!deleted) {
    return jsonError("Resource not found.", 404);
  }

  return Response.json({
    ok: true,
    deleted: slug,
  });
}

async function parseJsonBody(request: Request) {
  try {
    return {
      ok: true as const,
      data: (await request.json()) as unknown,
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
