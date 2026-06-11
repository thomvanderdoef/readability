import {
  aboutUrlFor,
  hasLibraryRequestAccess,
  unauthorizedJson,
} from "@/lib/access";
import { requireAdmin } from "@/lib/admin-auth";
import {
  createResource,
  getResources,
  parseResourceQuery,
  parseResourceWriteInput,
} from "@/lib/resources";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasLibraryRequestAccess(request)) {
    return unauthorizedJson();
  }

  const url = new URL(request.url);
  const query = parseResourceQuery(url.searchParams);
  const resources = await getResources(query);

  return Response.json({
    _about: aboutUrlFor(request),
    resources,
    pagination: {
      limit: query.limit,
      offset: query.offset,
      count: resources.length,
    },
    status: "ok",
  });
}

export async function POST(request: Request) {
  const denied = await requireAdmin();

  if (denied) {
    return denied;
  }

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

  const resource = await createResource(parsed.data);

  if (!resource) {
    return jsonError("Collection not found.", 404);
  }

  return Response.json(
    {
      ok: true,
      resource,
    },
    {
      status: 201,
    },
  );
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
