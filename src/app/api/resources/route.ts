import {
  aboutUrlFor,
  hasLibraryRequestAccess,
  unauthorizedJson,
} from "@/lib/access";
import { getResources, parseResourceQuery } from "@/lib/resources";

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
