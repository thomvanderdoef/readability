import { requireAdmin } from "@/lib/admin-auth";
import {
  createCollection,
  parseCollectionWriteInput,
} from "@/lib/resources";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await requireAdmin();

  if (denied) {
    return denied;
  }

  const body = await parseJsonBody(request);

  if (!body.ok) {
    return jsonError(body.error, 400);
  }

  const parsed = parseCollectionWriteInput(body.data);

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

  try {
    const collection = await createCollection(parsed.data);

    return Response.json(
      {
        ok: true,
        collection,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      return jsonError("A collection with that name already exists.", 409);
    }

    throw error;
  }
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

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}
