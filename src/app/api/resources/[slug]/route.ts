import {
  aboutUrlFor,
  hasLibraryRequestAccess,
  unauthorizedJson,
} from "@/lib/access";
import { getResourceBySlug } from "@/lib/resources";

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
